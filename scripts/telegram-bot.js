#!/usr/bin/env node
/**
 * NipTuck Telegram bot – image → prompt → generate → send
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../devops/.env') });
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const https = require('https');
const http = require('http');

const HELP = `
NipTuck Telegram Bot

Usage:
  npm run telegram-bot
  node scripts/telegram-bot.js

Flow:
  1. Send /start → bot asks for photo
  2. Send photo → bot asks "how do you want to look?"
  3. Send text (e.g. "at the beach", "video at gym") → bot generates & sends

Env (twin-admin/.env or devops/.env):
  TELEGRAM_BOT_TOKEN   From @BotFather
  TELEGRAM_CHAT_ID    Your chat ID (@userinfobot)
  TWIN_ADMIN_URL      API base (default: http://localhost:3000)

Prereq: twin-admin server must be running (npm start)
`.trim();

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.WOZ_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE_URL = process.env.TWIN_ADMIN_URL || 'http://localhost:3000';

if (!TOKEN || !CHAT_ID) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
  console.error('Run with --help for usage.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const userState = {}; // chatId -> { step, imageBase64 }

async function send(chatId, text, opts = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
}

async function downloadPhoto(fileId) {
  const file = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
  const buf = await new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

async function callVoiceGenerate(text) {
  const r = await fetch(`${BASE_URL}/api/demo/voice-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

async function callScenarioImage(imageBase64, scenarioId, customPrompt) {
  const r = await fetch(`${BASE_URL}/api/demo/scenario-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, scenarioId: scenarioId || undefined, customPrompt: customPrompt || undefined })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

async function callImg2vid(imageBase64, opts = {}) {
  const { scenarioId, templateId, prompt } = opts;
  const r = await fetch(`${BASE_URL}/api/demo/img2vid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      scenarioId: scenarioId || undefined,
      templateId: templateId || undefined,
      prompt: prompt || undefined,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function handleGenerate(chatId, imageBase64, text) {
  await send(chatId, '⏳ Generating… (this may take 1–2 min for video)');
  try {
    const parsed = await callVoiceGenerate(text);
    const wantVideo = /video|movie|animate|moving/i.test(text) || (parsed.type === 'video');
    if (wantVideo) {
      const result = await callImg2vid(imageBase64, {
        scenarioId: parsed.scenarioId,
        templateId: parsed.templateId,
        prompt: parsed.customPrompt,
      });
      if (!result.video_url) throw new Error('No video URL');
      const buf = await downloadFile(result.video_url);
      const tmp = path.join('/tmp', `niptuck-vid-${Date.now()}.mp4`);
      fs.writeFileSync(tmp, buf);
      await bot.sendVideo(chatId, tmp);
      fs.unlinkSync(tmp);
      await send(chatId, '✅ Here\'s your video!');
    } else {
      const result = await callScenarioImage(imageBase64, parsed.scenarioId, parsed.customPrompt);
      if (!result.image) throw new Error('No image');
      const buf = Buffer.from(result.image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const tmp = path.join('/tmp', `niptuck-img-${Date.now()}.png`);
      fs.writeFileSync(tmp, buf);
      await bot.sendPhoto(chatId, tmp);
      fs.unlinkSync(tmp);
      await send(chatId, '✅ Here\'s your image!');
    }
  } catch (e) {
    await send(chatId, `❌ Error: ${e.message}`);
  }
  userState[chatId] = { step: 'idle' };
}

async function startFlow(chatId) {
  userState[chatId] = { step: 'wait_image' };
  await send(chatId, '👋 Send me a <b>photo of yourself</b> (face/waist up works best)');
}

bot.onText(/\/start|hi|hello|generate/i, (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== String(CHAT_ID)) return;
  startFlow(chatId);
});

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== String(CHAT_ID)) return;
  const state = userState[chatId];
  if (state?.step !== 'wait_image') return;
  const photo = msg.photo[msg.photo.length - 1];
  await send(chatId, '📥 Got it! Now tell me: <b>how do you want to look?</b>\n\nExamples: "at the beach", "action hero", "red carpet", "make it a video at the gym"');
  try {
    const imageBase64 = await downloadPhoto(photo.file_id);
    userState[chatId] = { step: 'wait_prompt', imageBase64 };
  } catch (e) {
    await send(chatId, `❌ Failed to download: ${e.message}`);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (String(chatId) !== String(CHAT_ID)) return;
  const text = msg.text?.trim();
  if (!text || msg.photo) return;
  const state = userState[chatId];
  if (state?.step === 'wait_prompt' && state?.imageBase64) {
    userState[chatId] = { ...state, step: 'generating' };
    await handleGenerate(chatId, state.imageBase64, text);
  } else if (!state || state.step === 'idle') {
    startFlow(chatId);
  }
});

console.log(`NipTuck Telegram bot running. Chat ID: ${CHAT_ID}`);
send(CHAT_ID, '🔄 NipTuck bot started. Send /start to generate an image or video.').catch(() => {});
