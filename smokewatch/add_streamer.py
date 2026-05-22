#!/usr/bin/env python3
"""
Interactive CLI to add, remove, or list streamers in the database.
Run: python add_streamer.py
"""
import asyncio
import sys
import aiosqlite
from config import DB_PATH, init_db


async def list_streamers():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM streamers ORDER BY name") as cur:
            rows = await cur.fetchall()
    if not rows:
        print("No streamers configured yet.")
        return
    print(f"\n{'ID':<5} {'Name':<20} {'Platform':<8} {'Active':<8} {'URL'}")
    print("-" * 70)
    for r in rows:
        active = "yes" if r["active"] else "no"
        print(f"{r['id']:<5} {r['name']:<20} {r['platform']:<8} {active:<8} {r['stream_url']}")
    print()


async def add_streamer():
    print("\n--- Add Streamer ---")
    name = input("Streamer username (as it appears in the URL): ").strip()
    if not name:
        print("Name cannot be empty.")
        return

    platform = input("Platform [twitch/kick]: ").strip().lower()
    if platform not in ("twitch", "kick"):
        print("Platform must be 'twitch' or 'kick'.")
        return

    if platform == "twitch":
        stream_url = f"https://www.twitch.tv/{name}"
    else:
        stream_url = f"https://kick.com/{name}"

    custom = input(f"Stream URL [{stream_url}] (press Enter to accept): ").strip()
    if custom:
        stream_url = custom

    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                """INSERT INTO streamers (name, platform, stream_url, active)
                   VALUES (?, ?, ?, 1)""",
                (name, platform, stream_url),
            )
            await db.commit()
            print(f"\nStreamer '{name}' ({platform}) added successfully.")
        except aiosqlite.IntegrityError:
            print(f"\nStreamer '{name}' already exists. Use 'toggle' to enable/disable.")


async def remove_streamer():
    print("\n--- Remove Streamer ---")
    name = input("Streamer username to remove: ").strip()
    async with aiosqlite.connect(DB_PATH) as db:
        result = await db.execute("DELETE FROM streamers WHERE name = ?", (name,))
        await db.commit()
        if result.rowcount == 0:
            print(f"No streamer named '{name}' found.")
        else:
            print(f"Streamer '{name}' removed.")


async def toggle_streamer():
    print("\n--- Toggle Streamer Active/Inactive ---")
    name = input("Streamer username to toggle: ").strip()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT active FROM streamers WHERE name = ?", (name,)) as cur:
            row = await cur.fetchone()
        if not row:
            print(f"No streamer named '{name}' found.")
            return
        new_state = 0 if row["active"] else 1
        await db.execute(
            "UPDATE streamers SET active = ? WHERE name = ?", (new_state, name)
        )
        await db.commit()
        state_str = "active" if new_state else "inactive"
        print(f"Streamer '{name}' is now {state_str}.")


async def main():
    await init_db()

    while True:
        print("\nSmokeWatch — Streamer Manager")
        print("  1) List streamers")
        print("  2) Add streamer")
        print("  3) Remove streamer")
        print("  4) Toggle active/inactive")
        print("  q) Quit")
        choice = input("Choice: ").strip().lower()

        if choice == "1":
            await list_streamers()
        elif choice == "2":
            await add_streamer()
        elif choice == "3":
            await remove_streamer()
        elif choice == "4":
            await toggle_streamer()
        elif choice in ("q", "quit", "exit"):
            print("Bye.")
            sys.exit(0)
        else:
            print("Unknown choice.")


if __name__ == "__main__":
    asyncio.run(main())
