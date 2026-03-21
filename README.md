# Twin Admin — NipTuck Demo & Control Platform

Unified admin for **SurgiTwin Pro**, **GlowMorph Studio**, and **NipTuck** cosmetic scan demo.

## NipTuck Demo

- Cosmetic scan + Doc X (HeyGen avatar) assessment
- Scenario library: beach, gym, action hero, boudoir, etc.
- Image + video generation (Fal.ai / Replicate)
- Virtual backgrounds (doctor office, beach, spa…)
- Stream panel (OBS/MPC-style pads)
- Telegram bot: image → prompt → generate → send
- Lab intro, big screen (MIB-style) modes

## Quick Start

```bash
cp .env.example .env
# Edit .env: OPENAI_API_KEY, FAL_AI_KEY (or REPLICATE_API_TOKEN)
npm install
npm start
```

Open http://localhost:3000

## Commands

```bash
npm start                    # Start server
npm run sanity-check         # Test APIs (add -- --skip-video to skip video)
npm run telegram-bot         # Telegram image→generate bot
```

See [HELP.md](HELP.md) and [docs/COMMANDS.md](docs/COMMANDS.md).

## Documentation

- [HELP.md](HELP.md) – Quick help
- [docs/COMMANDS.md](docs/COMMANDS.md) – Commands & API routes
- [docs/TELEGRAM_BOT.md](docs/TELEGRAM_BOT.md) – Telegram bot
- [docs/LAB_INTRO_TECH.md](docs/LAB_INTRO_TECH.md) – Lab intro tech ref
- [Architecture](docs/ARCHITECTURE.md)
- [License Keys](docs/LICENSE_KEYS.md)
