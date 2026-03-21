# NipTuck Telegram Bot

Image → prompt → generate → send flow.

## Setup

1. Set in `twin-admin/.env` (or devops/.env):
   - `TELEGRAM_BOT_TOKEN` – from [@BotFather](https://t.me/BotFather)
   - `TELEGRAM_CHAT_ID` – your chat ID ([@userinfobot](https://t.me/userinfobot))
   - `TWIN_ADMIN_URL` – base URL (default: http://localhost:3000)

2. Start server: `npm start`
3. Run bot: `npm run telegram-bot`

## Flow

1. Send `/start` → bot asks for photo
2. Send photo (face/waist up)
3. Bot: "How do you want to look?"
4. Send text: "at the beach", "action hero", "make it a video at the gym"
5. Bot generates image/video and sends it back

## Help

```bash
node scripts/telegram-bot.js --help
```
