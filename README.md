# Smick

My roommate Jude and I quit smoking after reading *Easy Way to Quit Smoking*. We thought that was the end of the story.

Then we started noticing something: every time a streamer lit a cigarette on camera, the craving came back. Not because we wanted to smoke — but because watching someone do it live, casually, mid-conversation, makes it look completely normal. We weren't alone. Millions of people watch Kick and Twitch every day, and a lot of them are in the same fragile place we were.

So we started reaching out to streamers who smoke on stream. We asked them to pin a message in their chat — our story, and a link to the book that changed things for us. No judgment, just a quiet nudge at the exact moment a viewer might be reaching for their own cigarette.

Five people have told us they quit because of those pinned messages.

We want to reach 1,000 by the end of the year.

---

## The problem we're solving

Doing this by hand doesn't scale. You'd have to watch hundreds of hours of footage to catch the right moments. So we built Smick: a lightweight computer-vision system that monitors livestreams in real time, detects when someone smokes on camera, and triggers a chatbot to post a short, moment-specific awareness message — along with the book — right when viewers are most psychologically open to it.

We run it on a Hetzner VPS for about $50/month, monitoring 10 streamers at a time.

---

## How it works

```
Live stream URL
      │
      ▼
streamlink pulls the video feed
      │
      ▼
OpenCV samples a frame every second
      │
      ▼
Greyscale normalisation
(strips colour casts — neon lighting fools colour models)
      │
      ├──► YOLOv8 smoke-cloud model   ┐
      │                               ├─ detections merged
      └──► YOLOv8 cigarette model     ┘
      │
      ▼
Confidence filter
      │
      ├──► Chatbot fires a personalised message + book link
      └──► Dashboard logs the moment with an annotated frame
```

The greyscale step came from a hard-won lesson: on a red-neon-lit frame, a cigarette that scored 0.04 confidence in colour scored 0.74 in greyscale. Shape matters more than colour when you're looking for smoke.

---

## Running it yourself

### Requirements

- Python 3.10+
- Node.js 20+ and pnpm

### Install

```bash
git clone https://github.com/tmoula/Switch.git
cd Switch

# Python — CPU-only torch, no GPU needed
pip install --no-cache-dir torch torchvision \
  --index-url https://download.pytorch.org/whl/cpu
pip install ultralytics streamlink opencv-python-headless

# Node
pnpm install
```

### Models

Download these into `smokewatch/models/`:

| File | Detects | Source |
|------|---------|--------|
| `best.pt` | Smoke clouds | [kittendev — Roboflow](https://universe.roboflow.com/kittendev/smoke-detection-xmh7j) |
| `cigarette.pt` | Cigarette / Vape / Smoke | [cadilak — Roboflow](https://universe.roboflow.com/cadilak/cigarette-detection) |

### Start

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Web dashboard
pnpm --filter @workspace/smokewatch-ui run dev
```

Open the dashboard, paste a VOD or live stream URL, and hit **Start Detection**.

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | API server port |
| `WEBHOOK_URL` | — | Where to POST detection events |
| `DRY_RUN` | `true` | Set `false` to actually fire the chatbot |

---

## Webhook payload

When a detection fires, your chatbot receives:

```json
{
  "streamer": "username",
  "confidence": 0.74,
  "labels": ["Cigarette(cigarette.pt)", "smoke(best.pt)"],
  "timestamp": "2026-05-22T01:08:52Z",
  "frameNumber": 47
}
```

---

## Roadmap

- [ ] Twitch live stream support
- [ ] Auto-generated personalised messages (not just a template)
- [ ] Persistent log with clip export for outreach proof
- [ ] Discord bot out of the box
- [ ] Fine-tuned model on real streamer footage

---

## Contributing

If you have a VOD clip Smick misses, open an issue with the timestamp. That's the fastest way to improve it.

If you've quit smoking and want to share your story with streamers, reach out. That's really what this is about.

---

## License

MIT
