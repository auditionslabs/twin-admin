# NipTuck Demo – Quick Help

## Setup

```bash
cp .env.example .env
# Edit .env: add OPENAI_API_KEY, FAL_AI_KEY (or REPLICATE_API_TOKEN), etc.
npm install
npm start
```

Open http://localhost:3000

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start server |
| `npm run sanity-check` | Test APIs (use `-- --skip-video` to skip video) |
| `npm run telegram-bot` | Run Telegram bot |
| `node scripts/sanity-check.js --help` | Sanity check help |
| `node scripts/telegram-bot.js --help` | Telegram bot help |

## Demo flow

1. **Lab intro** (`/lab-intro.html`) – Bio Accelerator intro
2. **Demo** (`/demo.html`) – Scan, Doc X, scenarios, virtual backgrounds
3. **Stream panel** (`/stream-panel.html`) – OBS-style pads to trigger actions
4. **Big screen** (`/demo-mib.html`) – MIB-style full-screen

## Telegram bot flow

1. `npm start` (in one terminal)
2. `npm run telegram-bot` (in another)
3. Send `/start` to your bot
4. Send photo → send "how you want to look" → get image/video

## Env vars

| Key | Required for |
|-----|--------------|
| `OPENAI_API_KEY` | Analyze, chat, voice-generate |
| `FAL_AI_KEY` or `REPLICATE_API_TOKEN` | Scenario image, img2vid |
| `HEYGEN_API_KEY` | Doc X video |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Telegram bot |
| `LIVEKIT_*` | Go Live |

See [docs/COMMANDS.md](docs/COMMANDS.md) for full reference.
