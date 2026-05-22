import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

from chatbot import send_chat_message
from config import (
    WEBHOOK_SECRET,
    DRY_RUN,
    CHAT_MESSAGES,
    get_active_streamers,
    log_detection,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="SmokeWatch Webhook")


class TriggerPayload(BaseModel):
    streamer_name: str
    platform: str
    timestamp: str
    confidence_score: float
    secret: str


@app.post("/trigger")
async def trigger(payload: TriggerPayload):
    if payload.secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    streamers = await get_active_streamers()
    streamer = next(
        (s for s in streamers if s["name"].lower() == payload.streamer_name.lower()),
        None,
    )

    if not streamer:
        raise HTTPException(
            status_code=404,
            detail=f"Streamer '{payload.streamer_name}' not found or inactive",
        )

    channel = streamer["name"]
    platform = streamer["platform"]

    ok, message_sent = await send_chat_message(platform, channel, CHAT_MESSAGES)

    ts = datetime.now(timezone.utc).isoformat()
    await log_detection(
        streamer_name=payload.streamer_name,
        platform=platform,
        timestamp=ts,
        confidence=payload.confidence_score,
        message_sent=message_sent,
        dry_run=DRY_RUN,
    )

    return {
        "ok": ok,
        "dry_run": DRY_RUN,
        "message_sent": message_sent,
        "streamer": payload.streamer_name,
        "platform": platform,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/logs")
async def get_logs():
    import aiosqlite
    from config import DB_PATH
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM detection_log ORDER BY id DESC LIMIT 50"
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]
