import os
import asyncio
import aiohttp
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "yolov8n_cigarette.pt")
CONFIDENCE_THRESHOLD = 0.6
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8765"))
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "changeme")

_model = None


def load_model():
    global _model
    if _model is not None:
        return _model

    if not Path(MODEL_PATH).exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}.\n"
            "Download it from Hugging Face — see README.md for instructions."
        )

    from ultralytics import YOLO
    _model = YOLO(MODEL_PATH)
    logger.info("YOLOv8 cigarette model loaded.")
    return _model


def detect_cigarette(frame):
    """
    Run inference on a single BGR frame (numpy array).
    Returns (detected: bool, confidence: float).
    """
    model = load_model()
    results = model(frame, verbose=False)
    for result in results:
        for box in result.boxes:
            conf = float(box.conf[0])
            if conf >= CONFIDENCE_THRESHOLD:
                label = result.names[int(box.cls[0])]
                if "cigarette" in label.lower() or "smoke" in label.lower():
                    return True, conf
    return False, 0.0


async def fire_webhook(streamer_name: str, platform: str, confidence: float):
    payload = {
        "streamer_name": streamer_name,
        "platform": platform,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence_score": confidence,
        "secret": WEBHOOK_SECRET,
    }
    url = f"http://127.0.0.1:{WEBHOOK_PORT}/trigger"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    logger.info(f"[{streamer_name}] Webhook fired (confidence={confidence:.2f})")
                else:
                    logger.warning(f"[{streamer_name}] Webhook returned status {resp.status}")
    except Exception as exc:
        logger.error(f"[{streamer_name}] Webhook error: {exc}")
