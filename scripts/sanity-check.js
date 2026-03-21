#!/usr/bin/env node
/**
 * API sanity check – verifies twin-admin endpoints
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../devops/.env') });
const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
const skipVideo = process.argv.includes('--skip-video');
const showHelp = process.argv.includes('--help') || process.argv.includes('-h');

const HELP = `
NipTuck API Sanity Check

Usage:
  npm run sanity-check [baseUrl] [options]
  node scripts/sanity-check.js [baseUrl] [options]

Arguments:
  baseUrl    Base URL (default: http://localhost:3000 or TWIN_ADMIN_URL)

Options:
  --skip-video   Skip img2vid test (saves ~2 min)

Examples:
  npm run sanity-check
  npm run sanity-check -- https://niptuck.backoffice.cam
  node scripts/sanity-check.js --skip-video
`.trim();

if (showHelp) {
  console.log(HELP);
  process.exit(0);
}

const baseUrl = args[0] || process.env.TWIN_ADMIN_URL || 'http://localhost:3000';

const tinyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBRIhMQYTQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECAAMREiH/2gAMAwEAAhEDEEA/ALPp+j6dJY28r2Vu7vErMzRgkkjJJ4qD4hpX+ntv/wAgpSlG7MR3JqAJP//Z';

async function check(name, fn) {
  try {
    const result = await fn();
    console.log(`✓ ${name}`);
    return { ok: true, result };
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function main() {
  console.log(`\nNipTuck API sanity check – ${baseUrl}\n`);
  console.log('Env: OPENAI_API_KEY', process.env.OPENAI_API_KEY ? 'set' : 'MISSING');
  console.log('Env: FAL_AI_KEY', process.env.FAL_AI_KEY ? 'set' : 'MISSING');
  console.log('Env: REPLICATE_API_TOKEN', process.env.REPLICATE_API_TOKEN ? 'set' : 'MISSING');
  console.log('Env: HEYGEN_API_KEY', process.env.HEYGEN_API_KEY ? 'set' : 'MISSING');
  console.log('');

  const results = {};

  results.health = await check('GET /api/health', async () => {
    const r = await fetch(`${baseUrl}/api/health`);
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Not ok');
    return d;
  });

  results.scenarios = await check('GET /api/demo/scenarios', async () => {
    const r = await fetch(`${baseUrl}/api/demo/scenarios`);
    const d = await r.json();
    if (!d.scenarios?.length) throw new Error('No scenarios');
    return d;
  });

  results.voiceGenerate = await check('POST /api/demo/voice-generate', async () => {
    const r = await fetch(`${baseUrl}/api/demo/voice-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'put me at the beach' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    if (d.action !== 'generate') throw new Error('Expected action=generate');
    return d;
  });

  results.scenarioImage = await check('POST /api/demo/scenario-image', async () => {
    const r = await fetch(`${baseUrl}/api/demo/scenario-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: tinyImage, scenarioId: 'beach' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    if (!d.image) throw new Error('No image returned');
    return d;
  });

  if (!skipVideo) {
    results.img2vid = await check('POST /api/demo/img2vid (may take 2+ min)', async () => {
      const r = await fetch(`${baseUrl}/api/demo/img2vid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: tinyImage, scenarioId: 'beach' })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (!d.video_url) throw new Error('No video_url returned');
      return d;
    });
  } else {
    console.log('⊘ POST /api/demo/img2vid (skipped, use without --skip-video to test)');
  }

  const passed = Object.values(results).filter(r => r && r.ok).length;
  const total = Object.keys(results).length;
  console.log(`\n${passed}/${total} passed\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
