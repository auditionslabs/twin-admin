const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../devops/.env') });

const credits = require('./lib/credits');

// Resolve tenant from request (X-Tenant-Id header or body.tenantId)
function getTenantId(req) {
  return req.headers['x-tenant-id'] || req.body?.tenantId || req.query?.tenantId || 'default';
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'twin-admin', version: '0.1.0' });
});

app.get('/api/config', (req, res) => {
  res.json({
    niptuckApiUrl: process.env.NIPTUCK_API_URL || '',
    keys: {
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      heygen: !!process.env.HEYGEN_API_KEY,
      fal: !!process.env.FAL_AI_KEY,
      replicate: !!(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API),
    },
    docPrompt: process.env.DEMO_DOC_PROMPT || 'Blunt cosmetic consultant with comedian wit. Delivers assessment as Doc X.',
    patientPrompt: process.env.DEMO_PATIENT_PROMPT || 'Patient sees themselves in scenarios – beach, gym, red carpet, boudoir.',
    heygenAvatarId: process.env.HEYGEN_AVATAR_ID || 'Josh',
  });
});

// Scenario library – sports, casual, family, etc.
const scenarios = require('./scenarios');
const motionTemplates = require('./motion-templates');

// In-memory inbox for generated images/videos (survives until server restart)
const inboxStore = [];
const INBOX_MAX = 100;

app.get('/api/demo/scenarios', (req, res) => {
  const { category } = req.query;
  let list = scenarios;
  if (category) list = scenarios.filter(s => s.category === category);
  res.json({ scenarios: list });
});

// MotionMuse-style motion templates
app.get('/api/demo/motion-templates', (req, res) => {
  res.json({ templates: motionTemplates });
});

app.get('/api/licenses/validate', (req, res) => {
  res.status(501).json({ error: 'License validation not implemented yet' });
});

// Generated content inbox – images and videos from pipeline
app.get('/api/demo/inbox', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, INBOX_MAX);
  const items = inboxStore.slice(0, limit);
  res.json({ items, total: inboxStore.length });
});

app.post('/api/demo/inbox', (req, res) => {
  const { type, url, thumbnail, label } = req.body;
  if (!type || !url) return res.status(400).json({ error: 'type and url required' });
  const item = {
    id: `inbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: type === 'video' ? 'video' : 'image',
    url,
    thumbnail: thumbnail || url,
    label: label || (type === 'video' ? 'Generated video' : 'Generated image'),
    createdAt: new Date().toISOString(),
  };
  inboxStore.unshift(item);
  if (inboxStore.length > INBOX_MAX) inboxStore.pop();
  res.json({ ok: true, item });
});

// -----------------------------------------------------------------------------
// Stars / Wallet / Usage API (Telegram Stars–style digital currency)
// -----------------------------------------------------------------------------

app.get('/api/stars/balance', (req, res) => {
  const tenantId = getTenantId(req);
  const wallet = credits.getOrCreateWallet(tenantId);
  res.json({
    tenant_id: tenantId,
    balance: wallet.balance,
    star_to_usd: credits.STAR_TO_USD,
  });
});

app.get('/api/stars/usage', (req, res) => {
  const tenantId = req.query.tenantId || 'default';
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const entries = credits.readUsageLog(tenantId, limit);
  res.json({ entries });
});

app.get('/api/stars/summary', (req, res) => {
  const tenantId = req.query.tenantId || 'default';
  const since = req.query.since || null;
  const summary = credits.getUsageSummary(tenantId, since);
  res.json(summary);
});

app.post('/api/stars/add', (req, res) => {
  const tenantId = getTenantId(req);
  const { amount, reason } = req.body;
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const balance = credits.addStars(tenantId, amount, reason || '');
  res.json({ balance, added: amount });
});

// Demo: cosmetic scan – ruthless assessment, attractiveness, celebrity lookalikes
app.post('/api/demo/analyze', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  }
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image (base64)' });
  const base64 = image.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are a blunt, ruthless cosmetic consultant with a comedian's wit. Analyze this image.

RULES:
- ONLY use "PERSON_NOT_DETECTED" when the image clearly has NO human (e.g. landscape, object, empty scene, or face completely obscured). If any face or person is visible (even partially, close-up, or from an angle), proceed with analysis.
- When a person IS visible: Respond in this EXACT format (each on its own line):

ATTRACTIVENESS: [1-10]/10
ATTRACTIVENESS_NOTE: [one brief sentence about their looks]
CELEBRITY_LOOKALIKES: [2-4 celebrities with similar facial features, bone structure, or vibe - use famous people from film/TV/public life]
RECOMMENDATIONS: [3-6 specific things that would make them more attractive: procedures, products, styling, hair, body areas, skin, etc. Be concrete. One per line or comma-separated.]
ASSESSMENT: [Your ruthless, funny cosmetic assessment. List 3-5 areas to improve. Dark humor, direct, entertaining. Under 200 words.]

Be honest. For celebrities, think face shape, features, bone structure. Recommendations should be actionable.`;

  try {
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 600
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';
    if (text.startsWith('PERSON_NOT_DETECTED')) {
      return res.json({ assessment: text, personDetected: false });
    }
    const data = { assessment: text, personDetected: true };
    const attr = text.match(/ATTRACTIVENESS:\s*(\d+)\/10/i);
    const attrNote = text.match(/ATTRACTIVENESS_NOTE:\s*(.+?)(?=\n[A-Z]|\n\n|$)/is);
    const celebs = text.match(/CELEBRITY_LOOKALIKES:\s*(.+?)(?=\nRECOMMENDATIONS:|\nASSESSMENT:|\n\n|$)/is);
    const recs = text.match(/RECOMMENDATIONS:\s*(.+?)(?=\nASSESSMENT:|\n\n|$)/is);
    const assess = text.match(/ASSESSMENT:\s*([\s\S]+)/i);
    if (attr) data.attractiveness = parseInt(attr[1], 10);
    if (attrNote) data.attractivenessNote = attrNote[1].trim();
    if (celebs) data.celebrities = celebs[1].split(/[,;]|\band\b/i).map(s => s.trim()).filter(Boolean);
    if (recs) data.recommendations = recs[1].replace(/\d+\.\s/g, '\n').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (assess) data.assessment = assess[1].trim();

    const usage = completion.usage || {};
    const costUsd = credits.computeCost('openai', 'gpt-4o', {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
    });
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'openai',
      model: 'gpt-4o',
      route: '/api/demo/analyze',
      cost_usd: costUsd,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    data._stars = { balance: charge.balance, charged: charge.stars_charged };
    res.json(data);
  } catch (err) {
    console.error('Demo analyze error:', err.message);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// Demo: chat follow-up – discuss with Doc X persona
app.post('/api/demo/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try {
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Doc X, a blunt cosmetic consultant with comedian wit. You gave a scan assessment. The user wants to discuss. Be direct, funny, helpful. Persona: confident doctor who roasts but cares. Keep replies under 100 words. Scan context: "${(context || '').slice(0, 500)}"`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 200
    });
    const reply = completion.choices[0]?.message?.content?.trim() || "I didn't catch that.";
    const usage = completion.usage || {};
    const costUsd = credits.computeCost('openai', 'gpt-4o', {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
    });
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'openai',
      model: 'gpt-4o',
      route: '/api/demo/chat',
      cost_usd: costUsd,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    res.json({ reply, _stars: { balance: charge.balance, charged: charge.stars_charged } });
  } catch (err) {
    console.error('Demo chat error:', err.message);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// Demo: HeyGen video – Doc X avatar delivers assessment (public HeyGen avatar)
async function heygenRequest(path, options = {}) {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.heygen.com${path}`, {
    ...options,
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
  return data;
}

app.post('/api/demo/heygen-video', async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: 'HEYGEN_API_KEY not configured' });
  }
  const { text } = req.body;
  const script = (text || '').slice(0, 5000);
  if (!script) return res.status(400).json({ error: 'Missing text' });

  const avatarId = process.env.HEYGEN_AVATAR_ID || 'Josh';
  const voiceId = process.env.HEYGEN_VOICE_ID || '1bd001e7e50f421d891986aad0158f3d';

  const result = await heygenRequest('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId },
        voice: { type: 'text', input_text: script, voice_id: voiceId },
      }],
      dimension: { width: 720, height: 1280 },
      caption: false,
    }),
  });

  if (!result) return res.status(503).json({ error: 'HeyGen not configured' });
  if (result.error) return res.status(500).json({ error: result.error });
  res.json({ video_id: result.data?.video_id });
});

app.get('/api/demo/heygen-video/:id', async (req, res) => {
  if (!process.env.HEYGEN_API_KEY) {
    return res.status(503).json({ error: 'HEYGEN_API_KEY not configured' });
  }
  const result = await heygenRequest(`/v1/video_status.get?video_id=${req.params.id}`);
  if (!result) return res.status(503).json({ status: 'error' });
  if (result.error) return res.status(500).json({ status: 'failed' });
  const data = result.data?.video || result;
  res.json({
    status: data.status || 'unknown',
    video_url: data.video_url || null,
  });
});

// HeyGen avatars list – for homepage/experience display
app.get('/api/heygen/avatars', async (req, res) => {
  const result = await heygenRequest('/v2/avatars');
  if (!result || result.error) {
    return res.json({ avatars: [], error: result?.error || 'HeyGen not configured' });
  }
  const avatars = (result.data?.avatars || []).slice(0, 12).map(a => ({
    id: a.avatar_id,
    name: a.avatar_name,
    preview: a.preview_image_url || a.preview_video_url,
  }));
  res.json({ avatars });
});

// HeyGen Streaming – interactive avatar session (Cyber Worker)
app.post('/api/heygen/auth', async (req, res) => {
  const apiKey = process.env.HEYGEN_API_KEY;
  const apiToken = process.env.HEYGEN_API_TOKEN || apiKey;
  const avatarId = process.env.HEYGEN_AVATAR_ID || process.env.MC_HEYGEN_1 || 'Josh';

  if (!apiKey) {
    return res.status(503).json({ error: 'HEYGEN_API_KEY not configured' });
  }

  const { avatarId: bodyAvatarId, conversationId, userName } = req.body || {};
  const targetAvatarId = bodyAvatarId || avatarId;
  const sessionId = conversationId || `heygen_${Date.now()}`;

  try {
    const heygenRes = await fetch('https://api.heygen.com/v1/streaming.create', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatar_id: targetAvatarId,
        session_id: sessionId,
        ...(userName && { user_name: userName }),
      }),
    });

    const sessionData = await heygenRes.json().catch(() => ({}));

    if (!heygenRes.ok) {
      return res.json({
        avatarId: targetAvatarId,
        sessionId,
        apiKey,
        apiToken,
        userName: userName || 'there',
        warning: 'HeyGen API call failed, using fallback mode',
      });
    }

    res.json({
      avatarId: targetAvatarId,
      sessionId: sessionData.session_id || sessionId,
      apiKey,
      apiToken,
      userName: userName || 'there',
      sdp: sessionData.sdp,
      iceServers: sessionData.ice_servers || [],
      ...sessionData,
    });
  } catch (err) {
    console.error('HeyGen streaming auth error:', err.message);
    res.json({
      avatarId: targetAvatarId,
      sessionId,
      apiKey,
      apiToken,
      userName: userName || 'there',
      warning: 'HeyGen API unavailable',
    });
  }
});

// Replicate (REPLICATE_API_TOKEN or REPLICATE_API)
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API;

// Fal.ai image keys (support both names)
const FAL_KEY = process.env.FAL_AI_KEY || process.env.FAL_KEY;
const FAL_BASE = 'https://queue.fal.run';

async function falRequest(path, options = {}) {
  if (!FAL_KEY) return null;
  const res = await fetch(`${FAL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.detail || data.message || `HTTP ${res.status}` };
  return data;
}

// Demo: enhanced image – body/hair preview via Fal.ai Flux img2img
app.post('/api/demo/enhanced-image', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(503).json({ error: 'FAL_AI_KEY not configured. Add it to twin-admin env.' });
  }
  const { image, bodyLevel, hairStyle, hairColor, recommendations } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image (base64)' });
  const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image.replace(/^data:image\/\w+;base64,/, '')}`;

  const bodyDesc = bodyLevel != null ? ` Slightly ${bodyLevel > 50 ? 'slimmer, more toned silhouette' : 'fuller, softer silhouette'}.` : '';
  const hairDesc = [];
  if (hairStyle) hairDesc.push(hairStyle.toLowerCase());
  if (hairColor) hairDesc.push(hairColor.toLowerCase());
  const hairStr = hairDesc.length ? ` Hair: ${hairDesc.join(', ')}.` : '';
  const recStr = Array.isArray(recommendations) && recommendations.length
    ? ` Apply these subtle enhancements: ${recommendations.slice(0, 3).join(', ')}.`
    : '';
  const prompt = `Same person, same pose, professional photo. Subtle cosmetic enhancement preview: improved skin glow, balanced lighting, natural look.${bodyDesc}${hairStr}${recStr} Keep identity and expression identical. High quality portrait.`;

  try {
    const submit = await falRequest('/fal-ai/flux/dev/image-to-image', {
      method: 'POST',
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        strength: 0.85,
        num_inference_steps: 35,
        guidance_scale: 3.5,
        num_images: 1,
        acceleration: 'regular',
      }),
    });
    if (!submit || submit.error) {
      return res.status(500).json({ error: submit?.error || 'Fal.ai request failed' });
    }
    const requestId = submit.request_id;
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await falRequest(`/fal-ai/flux/dev/image-to-image/requests/${requestId}/status`);
      if (statusRes?.status === 'COMPLETED') {
        const result = await falRequest(`/fal-ai/flux/dev/image-to-image/requests/${requestId}`);
        const img = result?.images?.[0];
        if (img?.url) {
          const imgRes = await fetch(img.url);
          const buf = await imgRes.arrayBuffer();
          const b64 = Buffer.from(buf).toString('base64');
          return res.json({
            image: `data:${img.content_type || 'image/jpeg'};base64,${b64}`,
            url: img.url,
          });
        }
      }
      attempts++;
    }
    return res.status(504).json({ error: 'Image generation timed out' });
  } catch (err) {
    console.error('Enhanced image error:', err.message);
    return res.status(500).json({ error: err.message || 'Enhanced image failed' });
  }
});

// Scenario image – generate image with scenario prompt (Fal or Replicate)
app.post('/api/demo/scenario-image', async (req, res) => {
  const { image, scenarioId, customPrompt, celebrity } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });
  const scenario = scenarios.find(s => s.id === scenarioId);
  let prompt = customPrompt || (scenario ? scenario.imagePrompt : 'Same person, professional photo, natural lighting.');
  if (celebrity) prompt = `Same person styled to look like ${celebrity}. ${prompt}`;

  const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image.replace(/^data:image\/\w+;base64,/, '')}`;

  if (FAL_KEY) {
    try {
      const submit = await falRequest('/fal-ai/flux/dev/image-to-image', {
        method: 'POST',
        body: JSON.stringify({
          image_url: imageUrl,
          prompt,
          strength: 0.82,
          num_inference_steps: 35,
          guidance_scale: 3.5,
          num_images: 1,
          acceleration: 'regular',
        }),
      });
      if (submit?.request_id) {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await falRequest(`/fal-ai/flux/dev/image-to-image/requests/${submit.request_id}/status`);
          if (statusRes?.status === 'COMPLETED') {
            const result = await falRequest(`/fal-ai/flux/dev/image-to-image/requests/${submit.request_id}`);
            const img = result?.images?.[0];
            if (img?.url) {
              const imgRes = await fetch(img.url);
              const buf = await imgRes.arrayBuffer();
              const b64 = Buffer.from(buf).toString('base64');
              return res.json({ image: `data:${img.content_type || 'image/jpeg'};base64,${b64}`, url: img.url });
            }
          }
        }
      }
    } catch (e) {
      console.error('Fal scenario-image error:', e.message);
    }
  }

  if (REPLICATE_TOKEN) {
    try {
      const Replicate = require('replicate').default;
      const replicate = new Replicate({ auth: REPLICATE_TOKEN });
      const output = await replicate.run('bxclib2/flux_img2img', {
        input: { image: imageUrl, prompt: prompt.slice(0, 500), strength: 0.85 },
      });
      const outUrl = Array.isArray(output) ? output[0] : output?.url || output;
      if (outUrl) {
        const imgRes = await fetch(outUrl);
        const buf = await imgRes.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return res.json({ image: `data:image/png;base64,${b64}`, url: outUrl });
      }
    } catch (e) {
      console.error('Replicate scenario-image error:', e.message);
    }
  }

  return res.status(503).json({ error: 'FAL_AI_KEY or REPLICATE_API_TOKEN required' });
});

// Img2vid – photo to video (Fal LTX, Replicate fallback)
app.post('/api/demo/img2vid', async (req, res) => {
  const { image, prompt, scenarioId, templateId } = req.body;
  if (!image) return res.status(400).json({ error: 'Missing image' });
  const scenario = scenarios.find(s => s.id === scenarioId);
  const template = motionTemplates.find(t => t.id === templateId);
  const videoPrompt = prompt || (template ? template.videoPrompt : (scenario ? scenario.videoPrompt : 'The person moves naturally, subtle motion, professional quality.'));

  const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image.replace(/^data:image\/\w+;base64,/, '')}`;

  if (FAL_KEY) {
    try {
      const submit = await falRequest('/fal-ai/ltx-2/image-to-video', {
        method: 'POST',
        body: JSON.stringify({
          image_url: imageUrl,
          prompt: videoPrompt.slice(0, 500),
          duration: 6,
          resolution: '1080p',
          generate_audio: false,
        }),
      });
      if (submit?.request_id) {
        for (let i = 0; i < 90; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const statusRes = await falRequest(`/fal-ai/ltx-2/image-to-video/requests/${submit.request_id}/status`);
          if (statusRes?.status === 'COMPLETED') {
            const result = await falRequest(`/fal-ai/ltx-2/image-to-video/requests/${submit.request_id}`);
            const vid = result?.video;
            if (vid?.url) return res.json({ video_url: vid.url });
          }
        }
        return res.status(504).json({ error: 'Video generation timed out' });
      }
    } catch (e) {
      console.error('Fal img2vid error:', e.message);
    }
  }

  if (REPLICATE_TOKEN) {
    // When we have a motion prompt, try FramePack (supports prompt) for better template control
    if (videoPrompt && videoPrompt !== 'The person moves naturally, subtle motion, professional quality.') {
      try {
        const Replicate = require('replicate').default;
        const replicate = new Replicate({ auth: REPLICATE_TOKEN });
        const output = await replicate.run('zsxkib/framepack', {
          input: {
            input_image: imageUrl,
            prompt: videoPrompt.slice(0, 500),
            total_video_length_seconds: 4,
          },
        });
        const outUrl = output?.url || (typeof output === 'string' ? output : (Array.isArray(output) ? output[0] : output));
        if (outUrl) return res.json({ video_url: outUrl });
      } catch (e) {
        console.error('Replicate FramePack img2vid error:', e.message);
      }
    }
    // Fallback: ms-img2vid (no prompt, generic motion) – faster and cheaper
    try {
      const Replicate = require('replicate').default;
      const replicate = new Replicate({ auth: REPLICATE_TOKEN });
      const output = await replicate.run('lucataco/ms-img2vid', {
        input: { image: imageUrl },
      });
      const outUrl = output?.url || (Array.isArray(output) ? output[0] : output);
      if (outUrl) return res.json({ video_url: outUrl });
    } catch (e) {
      console.error('Replicate img2vid error:', e.message);
    }
  }

  return res.status(503).json({ error: 'FAL_AI_KEY or REPLICATE_API_TOKEN required for video' });
});

// Lip-sync video – open source (SadTalker via Replicate). Static image + TTS → talking head.
const DEFAULT_AVATAR_IMAGE = 'https://replicate.delivery/pbxt/Jf1gcsODejVsGRd42eeUj0RXX11zjxzHuLuqXmVFwMAi2tZq/art_1.png';

app.post('/api/demo/lip-sync-video', async (req, res) => {
  const elevenKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  if (!elevenKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY not configured' });
  }
  if (!REPLICATE_TOKEN) {
    return res.status(503).json({ error: 'REPLICATE_API_TOKEN not configured' });
  }
  const { text, image } = req.body;
  const inputText = (text || '').slice(0, 1500);
  if (!inputText) return res.status(400).json({ error: 'Missing text' });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const fs = require('fs');

  try {
    // 1. TTS via ElevenLabs
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: inputText,
        model_id: 'eleven_multilingual_v2',
      }),
    });
    if (!ttsRes.ok) {
      const err = await ttsRes.json().catch(() => ({}));
      return res.status(ttsRes.status).json({ error: err.detail?.message || 'TTS failed' });
    }
    const audioBuf = Buffer.from(await ttsRes.arrayBuffer());
    const tmpAudio = `/tmp/niptuck-tts-${Date.now()}.mp3`;
    fs.writeFileSync(tmpAudio, audioBuf);

    // 2. Source image – user upload or default
    let sourceImage = image;
    if (!sourceImage) sourceImage = DEFAULT_AVATAR_IMAGE;
    else if (sourceImage.startsWith('data:')) {
      const base64 = sourceImage.replace(/^data:image\/\w+;base64,/, '');
      const tmpImg = `/tmp/niptuck-face-${Date.now()}.png`;
      fs.writeFileSync(tmpImg, Buffer.from(base64, 'base64'));
      sourceImage = tmpImg;
    }

    // 3. SadTalker via Replicate
    const Replicate = require('replicate').default;
    const replicate = new Replicate({ auth: REPLICATE_TOKEN });
    const output = await replicate.run('cjwbw/sadtalker:a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3', {
      input: {
        source_image: sourceImage,
        driven_audio: tmpAudio,
        use_enhancer: false,
      },
    });

    try { fs.unlinkSync(tmpAudio); } catch (_) {}
    if (sourceImage && sourceImage.startsWith('/tmp/')) {
      try { fs.unlinkSync(sourceImage); } catch (_) {}
    }

    const videoUrl = typeof output === 'string' ? output
      : (typeof output?.url === 'function' ? output.url() : output?.url)
      || (Array.isArray(output) ? output[0] : null);
    if (!videoUrl) return res.status(500).json({ error: 'SadTalker produced no video' });

    const ttsCost = credits.computeCost('elevenlabs', 'default', { chars: inputText.length });
    const sadTalkerCost = credits.computeCost('replicate', 'cjwbw/sadtalker', {});
    const totalCost = ttsCost + sadTalkerCost;
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'replicate',
      model: 'cjwbw/sadtalker',
      route: '/api/demo/lip-sync-video',
      cost_usd: totalCost,
      metadata: { tts_cost: ttsCost, sadtalker_cost: sadTalkerCost, chars: inputText.length },
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    res.json({ video_url: videoUrl, _stars: { balance: charge.balance, charged: charge.stars_charged } });
  } catch (err) {
    console.error('Lip-sync error:', err.message);
    res.status(500).json({ error: err.message || 'Lip-sync failed' });
  }
});

// ElevenLabs TTS – assessment readout and chat replies
app.post('/api/demo/speak', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'ELEVENLABS_API_KEY not configured' });
  }
  const { text } = req.body;
  const input = (text || '').slice(0, 2500);
  if (!input) return res.status(400).json({ error: 'Missing text' });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input,
        model_id: 'eleven_multilingual_v2',
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.detail?.message || r.statusText || 'TTS failed' });
    }
    const buf = await r.arrayBuffer();
    const costUsd = credits.computeCost('elevenlabs', 'default', { chars: input.length });
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      route: '/api/demo/speak',
      cost_usd: costUsd,
      metadata: { chars: input.length },
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Stars-Balance', String(charge.balance));
    res.set('X-Stars-Charged', String(charge.stars_charged));
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('ElevenLabs speak error:', err.message);
    res.status(500).json({ error: err.message || 'TTS failed' });
  }
});

// Whisper transcription
app.post('/api/demo/transcribe', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  const { audio } = req.body;
  if (!audio) return res.status(400).json({ error: 'Missing audio (base64)' });
  const fs = require('fs');
  const buf = Buffer.from(audio.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
  const tmp = `/tmp/niptuck-audio-${Date.now()}.webm`;
  fs.writeFileSync(tmp, buf);
  try {
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmp),
      model: 'whisper-1',
    });
    const costUsd = credits.computeCost('openai', 'whisper-1', {
      duration_seconds: Math.max(1, buf.length / 50000), // ~50KB per sec rough
    });
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'openai',
      model: 'whisper-1',
      route: '/api/demo/transcribe',
      cost_usd: costUsd,
      metadata: { audio_bytes: buf.length },
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    res.json({ text: transcript.text, _stars: { balance: charge.balance, charged: charge.stars_charged } });
  } catch (err) {
    console.error('Transcribe error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
});

// Voice → generation: parse intent, return action or trigger
app.post('/api/demo/voice-generate', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
  const { text, audio } = req.body;
  let inputText = text;
  if (!inputText && audio) {
    const buf = Buffer.from(audio.replace(/^data:audio\/\w+;base64,/, ''), 'base64');
    const fs = require('fs');
    const tmp = `/tmp/niptuck-audio-${Date.now()}.webm`;
    fs.writeFileSync(tmp, buf);
    try {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({ apiKey });
      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmp),
        model: 'whisper-1',
      });
      inputText = transcript.text;
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  }
  if (!inputText) return res.status(400).json({ error: 'Missing text or audio' });

  const scenarioIds = scenarios.map(s => s.id).join(', ');
  const templateList = motionTemplates.map(t => `${t.id}(${t.name})`).join(', ');
  const prompt = `The user said: "${inputText}"

They want to see themselves in a scenario (image or video). Extract:
1. scenarioId: one of [${scenarioIds}] or null
2. templateId: for motion/video style, one of [${templateList}] or null (use when they say "gentle sway", "dancing", "hair toss", "smile reveal", etc.)
3. customPrompt: their custom idea (e.g. "at the beach", "like Brad Pitt") or null
4. celebrity: if they said "look like X" or "like X" – the celebrity name, or null
5. type: "image" or "video" based on context (default image; prefer video if templateId or "video"/"animate"/"moving" in text)

Reply JSON only: {"scenarioId":"beach"|null,"templateId":"gentle-sway"|null,"customPrompt":"..."|null,"celebrity":"..."|null,"type":"image"|"video"}`;

  try {
    const OpenAI = require('openai').default;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    });
    let raw = completion.choices[0]?.message?.content?.trim() || '{}';
    raw = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(raw);
    const usage = completion.usage || {};
    const costUsd = credits.computeCost('openai', 'gpt-4o-mini', {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
    });
    const charge = credits.chargeAndLog(getTenantId(req), {
      provider: 'openai',
      model: 'gpt-4o-mini',
      route: '/api/demo/voice-generate',
      cost_usd: costUsd,
      tokens_in: usage.prompt_tokens,
      tokens_out: usage.completion_tokens,
    });
    if (!charge.ok) return res.status(402).json({ error: charge.error, balance: charge.balance });
    res.json({
      action: 'generate',
      scenarioId: parsed.scenarioId || null,
      templateId: parsed.templateId || null,
      customPrompt: parsed.customPrompt || null,
      celebrity: parsed.celebrity || null,
      type: parsed.type || 'image',
      originalText: inputText,
      _stars: { balance: charge.balance, charged: charge.stars_charged },
    });
  } catch (err) {
    console.error('Voice-generate parse error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// LiveKit – token for WebRTC room (livekit.starshop.cc)
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://livekit.starshop.cc';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

app.post('/api/demo/livekit-token', async (req, res) => {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(503).json({ error: 'LIVEKIT_API_KEY and LIVEKIT_API_SECRET not configured' });
  }
  const { roomName, participantName } = req.body;
  const room = (roomName || `niptuck-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '-');
  const identity = (participantName || 'guest').slice(0, 100);
  try {
    const { AccessToken } = require('livekit-server-sdk');
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    res.json({ token, url: LIVEKIT_URL, room });
  } catch (err) {
    console.error('LiveKit token error:', err.message);
    res.status(500).json({ error: err.message || 'Token creation failed' });
  }
});

// Telegram – send message (for testing / integrations)
app.post('/api/demo/telegram-send', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.WOZ_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const d = await r.json();
    if (!d.ok) return res.status(500).json({ error: d.description || 'Telegram failed' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Twin Admin listening on port ${PORT}`);
});
