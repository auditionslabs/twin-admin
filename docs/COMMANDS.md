# NipTuck Commands Reference

## Server

```bash
npm start          # Start twin-admin (port 3000)
npm run dev        # Same as start
```

## Scripts

### Sanity check

Verifies API endpoints (health, scenarios, voice-generate, scenario-image, img2vid).

```bash
npm run sanity-check                    # Localhost, skip video (~10s)
npm run sanity-check -- --skip-video    # Explicit skip
npm run sanity-check -- https://niptuck.backoffice.cam  # Deployed URL
node scripts/sanity-check.js --help     # Help
```

**Options:**
- `--skip-video` – Skip img2vid (saves ~2 min)
- `--help`, `-h` – Show help

### Telegram bot

Image → prompt → generate → send flow.

```bash
npm run telegram-bot
node scripts/telegram-bot.js --help     # Help
```

**Prereq:** Server running (`npm start`), env vars set.

**Flow:** `/start` → send photo → send "how you want to look" → receive image/video.

## API routes (twin-admin)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/demo/scenarios` | Scenario list |
| POST | `/api/demo/analyze` | Scan image, get assessment |
| POST | `/api/demo/chat` | Chat with Doc X |
| POST | `/api/demo/heygen-video` | Generate Doc X video |
| GET | `/api/demo/heygen-video/:id` | Poll HeyGen status |
| POST | `/api/demo/scenario-image` | Generate scenario image |
| POST | `/api/demo/img2vid` | Generate scenario video |
| POST | `/api/demo/voice-generate` | Parse intent for generation |
| POST | `/api/demo/transcribe` | Whisper transcription |
| POST | `/api/demo/telegram-send` | Send message to Telegram |
| POST | `/api/demo/livekit-token` | LiveKit JWT |

## Pages

| Page | Path |
|------|------|
| Home | `/` |
| Demo | `/demo.html` |
| Lab intro | `/lab-intro.html` |
| Big screen | `/demo-mib.html` |
| Stream panel | `/stream-panel.html` |
| Tutorial | `/tutorial.html` |
| Experience | `/demo-experience.html` |
| Guide | `/guide.html` |
