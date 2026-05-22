# 🚬 Smick

**AI-powered smoking detection for live Twitch and Kick streams.**

Smick watches any live stream in real time, flags the exact moment a streamer lights up, and fires webhook alerts to your chat bot — so you never have to scrub through hours of VODs manually.

---

## What it does

- **Live VOD + stream scanning** — plug in any Kick or Twitch VOD URL and Smick starts pulling frames immediately
- **Dual YOLOv8 model inference** — one model catches smoke clouds, the other catches cigarette and vape objects; both run in parallel on every frame
- **Colour-agnostic detection** — frames are greyscale-normalised before inference so neon lighting, dark rooms, and heavy colour grading don't fool the models
- **Configurable confidence threshold** — dial sensitivity up or down from the dashboard
- **Webhook alerts** — fire a POST to any endpoint the moment a detection lands (Discord, Twitch chat bot, Slack, whatever)
- **Live frame preview** — annotated bounding boxes stream back to the browser as the scan runs
- **Jump-to-timestamp** — provide a seek offset so you start scanning from the exact part of the VOD you care about

---

## Demo

> Smick scanning a Kick VOD under red neon lighting — the kind of scene that breaks most detectors

| Raw frame | Smick detection |
|-----------|----------------|
| 😶‍🌫️ Heavy red cast, smoke nearly invisible | ✅ `Cigarette 0.74` `Smoke 0.47` |

---

## Quick start

### Requirements

- Python 3.10+
- Node.js 20+ and pnpm
- A Kick or Twitch VOD URL

### 1 — Clone and install

```bash
git clone https://github.com/your-username/smick.git
cd smick

# Python deps (CPU-only torch, no GPU needed)
pip install --no-cache-dir \
  torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics streamlink opencv-python-headless

# Node deps
pnpm install
```

### 2 — Download the models

```bash
mkdir -p smokewatch/models
```

Drop these two files into `smokewatch/models/`:

| File | What it catches | Source |
|------|----------------|--------|
| `best.pt` | Smoke clouds (YOLOv8m, 99.5% mAP50) | [kittendev on Roboflow](https://universe.roboflow.com/kittendev/smoke-detection-xmh7j) |
| `cigarette.pt` | Cigarette · Vape · Smoke (YOLOv8n) | [cadilak on Roboflow](https://universe.roboflow.com/cadilak/cigarette-detection) |

### 3 — Start the stack

```bash
# Terminal 1 — API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Web UI
pnpm --filter @workspace/smokewatch-ui run dev
```

Open `http://localhost:5173/smokewatch-ui/real-detect`, paste a VOD URL, and hit **Start Detection**.

---

## How it works

```
VOD URL
  │
  ▼
streamlink ──► raw H.264 pipe
  │
  ▼
OpenCV frame reader (1 Hz sample rate)
  │
  ▼
greyscale normalisation  ← strips misleading colour casts
  │
  ├──► best.pt      (smoke cloud model)  ┐
  │                                      ├─ merge detections
  └──► cigarette.pt (cigarette/vape)    ┘
  │
  ▼
confidence filter  (default 0.45, configurable)
  │
  ├──► SSE event → browser (live frame preview + bounding boxes)
  └──► webhook POST (Discord / chat bot / Slack)
```

The greyscale trick is the key insight: YOLOv8 smoke/cigarette models are trained on texture and shape, not colour. Stripping colour before inference turns a 0.04 confidence miss into a 0.74 confident hit on heavy neon-lit frames.

---

## Webhook payload

```json
{
  "streamer": "xqc",
  "confidence": 0.74,
  "labels": ["Cigarette(cigarette.pt)", "smoke(best.pt)"],
  "timestamp": "2026-05-22T01:08:52Z",
  "frameNumber": 47,
  "snapshotBase64": "..."
}
```

---

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `8080` | API server port |
| `WEBHOOK_URL` | — | POST target for detection events |
| `DRY_RUN` | `true` | Set to `false` to actually fire webhooks |

---

## Roadmap

- [ ] Twitch live stream support (streamlink already handles it)
- [ ] Persistent detection log with clip export
- [ ] Discord bot integration out of the box
- [ ] Browser extension that embeds detection overlay directly on Kick/Twitch
- [ ] Fine-tuned model trained specifically on streamer footage

---

## Contributing

PRs welcome. If you have a VOD clip that Smick misses, open an issue with a timestamp — that's the fastest way to improve the models.

---

## License

MIT
