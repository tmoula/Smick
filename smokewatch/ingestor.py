import asyncio
import logging
import subprocess
import time
from datetime import datetime, timezone, timedelta

import cv2
import numpy as np

from detector import detect_cigarette, fire_webhook
from config import COOLDOWN_MINUTES, get_active_streamers

logger = logging.getLogger(__name__)

FRAME_INTERVAL = 2.0
OFFLINE_RETRY_SECONDS = 60
TARGET_WIDTH = 640
TARGET_HEIGHT = 360


def _open_stream_pipe(stream_url: str):
    """Use streamlink to open the stream and pipe raw video to cv2."""
    cmd = [
        "streamlink",
        "--stdout",
        "--stream-segment-attempts", "3",
        "--retry-streams", "1",
        "--retry-max", "1",
        stream_url,
        "360p,worst",
    ]
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=10 ** 8,
    )
    return proc


def _read_frame_from_pipe(cap) -> np.ndarray | None:
    ret, frame = cap.read()
    if not ret:
        return None
    frame = cv2.resize(frame, (TARGET_WIDTH, TARGET_HEIGHT))
    return frame


cooldown_state: dict[str, datetime | None] = {}


def _is_on_cooldown(streamer_name: str) -> bool:
    last = cooldown_state.get(streamer_name)
    if last is None:
        return False
    return datetime.now(timezone.utc) - last < timedelta(minutes=COOLDOWN_MINUTES)


def _set_cooldown(streamer_name: str):
    cooldown_state[streamer_name] = datetime.now(timezone.utc)


async def run_ingestor(streamer: dict, stop_event: asyncio.Event):
    name = streamer["name"]
    platform = streamer["platform"]
    url = streamer["stream_url"]

    logger.info(f"[{name}] Ingestor starting — {url}")

    while not stop_event.is_set():
        proc = None
        cap = None
        try:
            logger.info(f"[{name}] Connecting to stream...")
            proc = _open_stream_pipe(url)

            cap = cv2.VideoCapture()
            cap.open(f"pipe:{proc.stdout.fileno()}")

            if not cap.isOpened():
                raise RuntimeError("cv2 could not open the pipe")

            logger.info(f"[{name}] Stream open. Processing at 0.5 Hz...")
            last_frame_time = 0.0

            while not stop_event.is_set():
                now = time.monotonic()
                if now - last_frame_time < FRAME_INTERVAL:
                    await asyncio.sleep(0.1)
                    continue

                last_frame_time = now
                frame = await asyncio.to_thread(_read_frame_from_pipe, cap)

                if frame is None:
                    logger.warning(f"[{name}] Stream ended or frame unreadable.")
                    break

                if _is_on_cooldown(name):
                    continue

                detected, confidence = await asyncio.to_thread(detect_cigarette, frame)

                if detected:
                    logger.info(f"[{name}] Cigarette detected! confidence={confidence:.2f}")
                    _set_cooldown(name)
                    await fire_webhook(name, platform, confidence)

        except Exception as exc:
            logger.error(f"[{name}] Ingestor error: {exc}")
        finally:
            if cap:
                cap.release()
            if proc and proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()

        if not stop_event.is_set():
            logger.info(f"[{name}] Stream offline. Retrying in {OFFLINE_RETRY_SECONDS}s...")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=OFFLINE_RETRY_SECONDS)
            except asyncio.TimeoutError:
                pass

    logger.info(f"[{name}] Ingestor stopped.")
