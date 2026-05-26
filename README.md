# Switch

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/Streams-Kick%20%7C%20Twitch-9146FF?style=flat-square)
![Goal](https://img.shields.io/badge/Goal-1%2C000%20people%20quit-red?style=flat-square)

---
Website: [Switch](https://practical-run.replit.app/switch-landing/)

My roommate Jude quit smoking after reading *Easy Way to Quit Smoking*. So did I. I thought that was the end of the story.

Then I noticed something: every time a streamer lit a cigarette on camera, the craving came back. Not because I wanted to smoke — but because watching someone do it live, casually, mid-conversation, makes it look completely normal. I wasn't alone. Millions of people watch Kick and Twitch every day, and a lot of them are in the same fragile place I was.

So I started reaching out to streamers who smoke on stream. I asked them to pin a message in their chat — my story, and a link to the book that changed things for me. No judgment, just a quiet nudge at the exact moment a viewer might be reaching for their own cigarette.

**Five people have told me they quit because of those pinned messages.**

I want to reach 1,000 by the end of the year.

---

## The problem

Doing this by hand doesn't scale. I'd have to watch hundreds of hours of footage to catch the right moments. So I built Switch: a lightweight computer-vision system that monitors livestreams in real time, detects the exact moment someone smokes on camera, and fires a chatbot message — along with the book — right when viewers are most psychologically open to it.

---

## How it works

```mermaid
flowchart TD
    A[🔗 Stream URL] --> B[streamlink\npulls the video feed]
    B --> C[OpenCV\nsamples 1 frame/sec]
    C --> D[Greyscale normalisation\nstrips colour casts]
    D --> E[YOLOv8 smoke-cloud model]
    D --> F[YOLOv8 cigarette model]
    E --> G{Confidence\nthreshold met?}
    F --> G
    G -- yes --> H[🤖 Chatbot fires\npersonalised message + book link]
    G -- yes --> I[📊 Dashboard logs\nannotated frame]
    G -- no --> J[Frame discarded]

    style H fill:#22c55e,color:#fff
    style I fill:#6366f1,color:#fff
    style J fill:#374151,color:#aaa
```

> **Key insight:** On a red-neon-lit frame, a cigarette scored **0.04 confidence** in colour and **0.74 in greyscale**. Shape matters more than colour when detecting smoke. Stripping colour before inference was the single biggest improvement.

---

## Detection in action

| Frame condition | Colour inference | Greyscale inference |
|----------------|-----------------|-------------------|
| Normal lighting | ✅ Works well | ✅ Works well |
| Red / neon light | ❌ 0.04 conf — missed | ✅ 0.74 conf — caught |
| Blue stage light | ❌ Often missed | ✅ Reliable |
| Dark room | ⚠️ Inconsistent | ✅ Reliable |

Two models run on every frame in parallel:

| Model | File | Speciality |
|-------|------|-----------|
| kittendev YOLOv8m | `best.pt` | Smoke clouds (99.5% mAP50) |
| cadilak YOLOv8n | `cigarette.pt` | Cigarette · Vape · Smoke objects |

---

## Progress

```
People reached    ████░░░░░░░░░░░░░░░░  5 / 1,000
Streamers live    ████████████████████  10 / 10
Monthly cost      $50 / month (Hetzner VPS)
```

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

| File | Source |
|------|--------|
| `best.pt` | [kittendev on Roboflow](https://universe.roboflow.com/kittendev/smoke-detection-xmh7j) |
| `cigarette.pt` | [cadilak on Roboflow](https://universe.roboflow.com/cadilak/cigarette-detection) |

### Start

```bash
# Terminal 1 — API server
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Web dashboard
pnpm --filter @workspace/smokewatch-ui run dev
```

Open the dashboard, paste a VOD or live stream URL, set your confidence threshold, and hit **Start Detection**.

### Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | API server port |
| `WEBHOOK_URL` | — | Where to POST detection events |
| `DRY_RUN` | `true` | Set `false` to actually fire the chatbot |

---

## Chatbot payload

When a detection fires, the chatbot receives:

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
- [ ] Auto-generated personalised messages per streamer
- [ ] Persistent log with clip export for outreach proof
- [ ] Discord bot out of the box
- [ ] Browser extension that overlays detection on Kick/Twitch pages
- [ ] Fine-tuned model on real streamer footage

---

## How you can help

This project runs on a $50/month VPS and a genuine belief that the right message at the right moment can change someone's life. I'm one person building this. Every contribution — code, data, or just a star — directly helps me reach more people.

### ⭐ Star this repo

Sounds small. It isn't. Stars push this into GitHub trending, which gets it in front of developers who might add features, researchers who work on vision models, and ex-smokers who want to get involved. If this project resonates with you at all, the star is the easiest thing you can do.

### 🐛 Improve the detector

The model misses smoking moments in challenging lighting — heavy neon, dark rooms, fast cuts. If you have a VOD clip where Switch fails, open an issue with the stream URL and timestamp. I'll use it to fine-tune.

Skills that would move the needle most right now:
- **ML / computer vision** — help fine-tune YOLOv8 on real streamer footage
- **Python / streaming** — improve the frame pipeline, add Twitch live support
- **Node / TypeScript** — build out the dashboard and webhook integrations
- **NLP** — generate personalised, moment-aware chat messages instead of a static template

### 💬 Share your story

If you've quit smoking and you're open to sharing it, I want to turn your story into a pinned message. Real stories from real people work better than any generated copy. Reach out via an issue or email.

### 📣 Tell a streamer

Know a streamer who smokes on camera? Send them this repo. I'm not trying to shame anyone — just start a conversation. Five people quit because a streamer took 30 seconds to pin a message. That's all it takes.

---

> *"Quitting taught me how easily we get manipulated as a crowd. I had been smoking to maintain a persona that wasn't mine. Letting go of that unlocked a happier version of myself. I want to help other people feel the same way."*

---

## License

MIT
