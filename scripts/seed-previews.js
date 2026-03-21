#!/usr/bin/env node
/**
 * Generate preview videos for each motion template.
 * Uses one source image, calls img2vid per template, saves to public/previews/.
 *
 * Usage:
 *   npm run seed-previews [imagePath]
 *   node scripts/seed-previews.js [imagePath]
 *
 * Prereq: FAL_AI_KEY or REPLICATE_API_TOKEN, server NOT required.
 * Optional: imagePath = path to a source image (default: tiny placeholder)
 */
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../devops/.env') });

const BASE = process.env.TWIN_ADMIN_URL || 'http://localhost:3000';
const motionTemplates = require('../motion-templates');
const PREVIEWS_DIR = path.join(__dirname, '../public/previews');

const tinyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBRIhMQYTQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBP/EABoRAAICAwAAAAAAAAAAAAAAAAECAAMREiH/2gAMAwEAAhEDEEA/ALPp+j6dJY28r2Vu7eErMzRgkkjJJ4qD4hpX+ntv/wAgpSlG7MR3JqAJP//Z';

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

async function main() {
  const imagePath = process.argv[2];
  let imageBase64 = tinyImage;
  if (imagePath && fs.existsSync(imagePath)) {
    const buf = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mime = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png' }[ext] || 'jpeg';
    imageBase64 = `data:image/${mime};base64,` + buf.toString('base64');
  }

  if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
  }

  console.log(`Seeding ${motionTemplates.length} previews…`);
  for (const t of motionTemplates) {
    const outPath = path.join(PREVIEWS_DIR, `${t.id}.mp4`);
    if (fs.existsSync(outPath)) {
      console.log(`  ⊙ ${t.id} (exists)`);
      continue;
    }
    console.log(`  → ${t.id}…`);
    try {
      const r = await fetch(`${BASE}/api/demo/img2vid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, templateId: t.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (!d.video_url) throw new Error('No video_url');
      const buf = await downloadFile(d.video_url);
      fs.writeFileSync(outPath, buf);
      console.log(`  ✓ ${t.id}`);
    } catch (e) {
      console.log(`  ✗ ${t.id}: ${e.message}`);
    }
  }
  console.log('Done.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
