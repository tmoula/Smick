import logging
import random
import os
import aiohttp

logger = logging.getLogger(__name__)

DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
TWITCH_BOT_TOKEN = os.getenv("TWITCH_BOT_TOKEN", "")
TWITCH_BOT_USERNAME = os.getenv("TWITCH_BOT_USERNAME", "")
KICK_SESSION_TOKEN = os.getenv("KICK_SESSION_TOKEN", "")


def pick_message(messages: list[str]) -> str:
    return random.choice(messages)


async def send_twitch_message(channel: str, message: str) -> bool:
    """Send a message to a Twitch channel using IRC over WebSocket."""
    if DRY_RUN:
        logger.info(f"[DRY RUN] Twitch #{channel}: {message}")
        return True

    if not TWITCH_BOT_TOKEN or not TWITCH_BOT_USERNAME:
        logger.error("Twitch credentials not set — cannot send message.")
        return False

    try:
        import twitchio
        from twitchio.ext import commands

        class _BotOnce(commands.Bot):
            def __init__(self):
                super().__init__(
                    token=TWITCH_BOT_TOKEN,
                    prefix="!",
                    initial_channels=[channel],
                )
                self._sent = False

            async def event_ready(self):
                ch = self.get_channel(channel)
                if ch:
                    await ch.send(message)
                    logger.info(f"[Twitch] Sent to #{channel}: {message}")
                self._sent = True
                await self.close()

            async def event_message(self, msg):
                pass

        bot = _BotOnce()
        await bot.start()
        return True
    except Exception as exc:
        logger.error(f"[Twitch] Failed to send message: {exc}")
        return False


async def send_kick_message(channel: str, message: str) -> bool:
    """
    Send a message to a Kick channel via the unofficial API.
    This is fragile — Kick actively changes their private API.
    """
    if DRY_RUN:
        logger.info(f"[DRY RUN] Kick #{channel}: {message}")
        return True

    if not KICK_SESSION_TOKEN:
        logger.error("KICK_SESSION_TOKEN not set — cannot send message.")
        return False

    url = f"https://kick.com/api/v2/messages/send/{channel}"
    headers = {
        "Authorization": f"Bearer {KICK_SESSION_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
    }
    payload = {"content": message, "type": "message"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload, headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status in (200, 201):
                    logger.info(f"[Kick] Sent to #{channel}: {message}")
                    return True
                body = await resp.text()
                logger.warning(f"[Kick] Unexpected status {resp.status}: {body}")
                return False
    except Exception as exc:
        logger.error(f"[Kick] Failed to send message: {exc}")
        return False


async def send_chat_message(
    platform: str, channel: str, messages: list[str]
) -> tuple[bool, str]:
    message = pick_message(messages)
    if platform == "twitch":
        ok = await send_twitch_message(channel, message)
    elif platform == "kick":
        ok = await send_kick_message(channel, message)
    else:
        logger.error(f"Unknown platform: {platform}")
        return False, ""
    return ok, message
