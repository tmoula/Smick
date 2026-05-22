# SmokeWatch

Monitors live Twitch/Kick streams for smoking behavior and automatically sends awareness messages to the stream's chat when a cigarette is detected — using free tools and running entirely on your own machine or a cheap VPS.

---

## Requirements

- Python 3.11+
- Linux or macOS (Windows untested)
- ~300 MB RAM per active stream
- CPU-only inference (YOLOv8n runs fine on 2 cores at 0.5 Hz)

---

## Quick Start

### 1. Install dependencies

```bash
cd smokewatch
pip install -r requirements.txt
```

### 2. Download the cigarette detection model

Download a free fine-tuned YOLOv8n cigarette model from Hugging Face:

```bash
mkdir -p models
# Option A — direct wget (replace URL with a known working model):
wget -O models/yolov8n_cigarette.pt \
  "https://huggingface.co/keremberke/yolov8n-cigarette-detection/resolve/main/yolov8n-cigarette-detection.pt"
```

If the URL above is stale, search Hugging Face for:
`yolov8 cigarette detection`
and download any `.pt` file from a model that lists `cigarette` as a detectable class.
Place the file at `models/yolov8n_cigarette.pt`.

### 3. Set up your environment

```bash
cp .env.template .env
```

Edit `.env`:

| Variable | What to put |
|---|---|
| `TWITCH_BOT_TOKEN` | `oauth:xxxxxx` from step 4 |
| `TWITCH_BOT_USERNAME` | Your bot account's username |
| `KICK_SESSION_TOKEN` | Your Kick session token (see step 5) |
| `DRY_RUN` | `true` while testing; `false` to actually send |
| `WEBHOOK_SECRET` | Any random string |
| `COOLDOWN_MINUTES` | Minimum minutes between messages per streamer |
| `CHAT_LINK` | The link to include in messages |

### 4. Create a free Twitch bot account

1. Log out of your main Twitch account.
2. Create a new Twitch account (e.g. `mysmokeawarenessbot`).
3. Go to [https://twitchtokengenerator.com](https://twitchtokengenerator.com).
4. Select "Bot Chat Token".
5. Authorize with the bot account.
6. Copy the OAuth token — it starts with `oauth:`. Paste into `.env` as `TWITCH_BOT_TOKEN`.
7. Set `TWITCH_BOT_USERNAME` to the bot account's username (lowercase).

> **Twitch TOS note:** Sending automated messages in a channel without the streamer's knowledge may violate Twitch's Spam policy. Consider reaching out to streamers first and asking if they'd like your bot in their channel.

### 5. Kick chat (optional, unstable)

Kick does not have an official bot API. The unofficial method uses a session token from your browser:

1. Log in to Kick in Chrome/Firefox.
2. Open DevTools → Application → Cookies → `kick.com`.
3. Copy the value of the `session_token` cookie.
4. Paste it into `.env` as `KICK_SESSION_TOKEN`.

> **Warning:** This token expires and Kick may block automated requests. Use at your own risk.

### 6. Add streamers

```bash
python add_streamer.py
```

Follow the prompts to add Twitch or Kick streamers by their username.

### 7. Run

```bash
python main.py
```

SmokeWatch will:
- Load all active streamers from the database
- Open one stream watcher per streamer
- Sample one frame every 2 seconds
- Fire a chat message if a cigarette is detected (subject to the cooldown)

Press `Ctrl+C` to stop cleanly.

---

## Testing without sending real messages

Keep `DRY_RUN=true` in `.env`. All messages will be printed to the terminal instead of sent to chat.

---

## File layout

```
smokewatch/
├── main.py           — Orchestrator: starts all workers + webhook server
├── ingestor.py       — Opens a stream and samples frames
├── detector.py       — Runs YOLOv8 inference on each frame
├── webhook.py        — FastAPI server that receives detections + triggers chat
├── chatbot.py        — Sends messages to Twitch or Kick
├── config.py         — DB helpers, env loading, message pool
├── add_streamer.py   — CLI to manage the streamers list
├── models/
│   └── yolov8n_cigarette.pt   ← you download this
├── streamers.db      ← auto-created on first run
├── .env              ← your credentials (never commit this)
├── .env.template     ← safe template to commit
└── requirements.txt
```

---

## Deployment on a Hetzner CX11 VPS

```bash
# On your local machine:
scp -r smokewatch/ root@YOUR_VPS_IP:/opt/smokewatch

# On the VPS:
apt update && apt install -y python3.11 python3-pip streamlink
pip3 install -r /opt/smokewatch/requirements.txt

# Run in a detached screen session:
screen -S smokewatch
cd /opt/smokewatch
python3 main.py
# Ctrl+A then D to detach
```

---

## Limits and known issues

- **CPU usage:** YOLOv8n at 0.5 Hz is lightweight. 10 streams on a 2-core VPS should stay under ~40% CPU.
- **Kick API:** Unofficial and fragile. Expect it to break when Kick updates their API.
- **Stream offline:** The ingestor retries every 60 seconds if a stream goes offline.
- **False positives:** Confidence threshold is 0.6 by default. Raise it in `detector.py` if you get too many false triggers.
- **Cooldown:** Default 5 minutes between messages per streamer. Adjust via `COOLDOWN_MINUTES` in `.env`.
