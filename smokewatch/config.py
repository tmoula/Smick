import os
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "streamers.db")

TWITCH_BOT_TOKEN = os.getenv("TWITCH_BOT_TOKEN", "")
TWITCH_BOT_USERNAME = os.getenv("TWITCH_BOT_USERNAME", "")
KICK_SESSION_TOKEN = os.getenv("KICK_SESSION_TOKEN", "")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "changeme")
COOLDOWN_MINUTES = int(os.getenv("COOLDOWN_MINUTES", "5"))
CHAT_LINK = os.getenv("CHAT_LINK", "allencart.com")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8765"))

CHAT_MESSAGES = [
    f"I smoked for 15 years — quitting changed my life. If you're curious how, this book helped me more than anything: {CHAT_LINK}",
    f"Fun fact: my first week without cigarettes I slept better than I had in a decade. Story + the book that helped: {CHAT_LINK}",
    f"Quitting smoking was the hardest and best thing I ever did. One book made it click for me: {CHAT_LINK}",
    f"Not judging — just sharing. I was a pack-a-day smoker. This changed everything for me: {CHAT_LINK}",
    f"Someone once sent me a link that quietly changed my relationship with cigarettes. Paying it forward: {CHAT_LINK}",
]


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS streamers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                platform TEXT NOT NULL CHECK(platform IN ('twitch', 'kick')),
                stream_url TEXT NOT NULL,
                chat_credentials TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                cooldown_last_fired TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS detection_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                streamer_name TEXT NOT NULL,
                platform TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                confidence REAL NOT NULL,
                message_sent TEXT,
                dry_run INTEGER NOT NULL DEFAULT 0
            )
        """)
        await db.commit()


async def get_active_streamers():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM streamers WHERE active = 1"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def update_cooldown(streamer_name: str, timestamp: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE streamers SET cooldown_last_fired = ? WHERE name = ?",
            (timestamp, streamer_name),
        )
        await db.commit()


async def log_detection(
    streamer_name: str,
    platform: str,
    timestamp: str,
    confidence: float,
    message_sent: str,
    dry_run: bool,
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO detection_log
               (streamer_name, platform, timestamp, confidence, message_sent, dry_run)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (streamer_name, platform, timestamp, confidence, message_sent, int(dry_run)),
        )
        await db.commit()
