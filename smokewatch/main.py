#!/usr/bin/env python3
"""
SmokeWatch — main entry point.
Starts all ingestor workers + the FastAPI webhook server concurrently.
"""
import asyncio
import logging
import signal
import sys
import os

import uvicorn

from config import init_db, get_active_streamers, WEBHOOK_PORT
from ingestor import run_ingestor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("smokewatch")

MAX_CONCURRENT_STREAMERS = 10


async def main():
    await init_db()

    streamers = await get_active_streamers()
    if not streamers:
        logger.warning(
            "No active streamers found. Add some with: python add_streamer.py"
        )

    if len(streamers) > MAX_CONCURRENT_STREAMERS:
        logger.warning(
            f"Found {len(streamers)} active streamers; capping at {MAX_CONCURRENT_STREAMERS}."
        )
        streamers = streamers[:MAX_CONCURRENT_STREAMERS]

    stop_event = asyncio.Event()

    def _shutdown(*_):
        logger.info("Shutdown signal received — stopping all workers...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _shutdown)

    config = uvicorn.Config(
        "webhook:app",
        host="127.0.0.1",
        port=WEBHOOK_PORT,
        log_level="warning",
    )
    server = uvicorn.Server(config)

    ingestor_tasks = [
        asyncio.create_task(run_ingestor(s, stop_event), name=f"ingestor-{s['name']}")
        for s in streamers
    ]

    server_task = asyncio.create_task(server.serve(), name="webhook-server")

    logger.info(
        f"SmokeWatch running — {len(streamers)} stream(s), webhook on port {WEBHOOK_PORT}"
    )
    if os.getenv("DRY_RUN", "true").lower() == "true":
        logger.info("DRY_RUN=true — messages will be printed, not sent to chat.")

    await stop_event.wait()

    server.should_exit = True
    for task in ingestor_tasks:
        task.cancel()

    await asyncio.gather(*ingestor_tasks, server_task, return_exceptions=True)
    logger.info("SmokeWatch shut down cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
