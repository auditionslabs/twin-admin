const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'twin-admin', version: '0.1.0' });
});

app.get('/api/licenses/validate', (req, res) => {
  res.status(501).json({ error: 'License validation not implemented yet' });
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
- If NO person visible (waist up or full body, face clear): Reply ONLY "PERSON_NOT_DETECTED" and why.
- If YES: Respond in this EXACT format (each on its own line):

ATTRACTIVENESS: [1-10]/10
ATTRACTIVENESS_NOTE: [one brief sentence about their looks]
CELEBRITY_LOOKALIKES: [2-4 celebrities with similar facial features, bone structure, or vibe - use famous people from film/TV/public life]
ASSESSMENT: [Your ruthless, funny cosmetic assessment. List 3-5 areas to improve. Dark humor, direct, entertaining. Under 200 words.]

Be honest about attractiveness. For celebrities, think face shape, features, overall aesthetic - not just "famous person."`;

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
    const celebs = text.match(/CELEBRITY_LOOKALIKES:\s*(.+?)(?=\nASSESSMENT:|\n\n|$)/is);
    const assess = text.match(/ASSESSMENT:\s*([\s\S]+)/i);
    if (attr) data.attractiveness = parseInt(attr[1], 10);
    if (attrNote) data.attractivenessNote = attrNote[1].trim();
    if (celebs) data.celebrities = celebs[1].split(/[,;]|\band\b/i).map(s => s.trim()).filter(Boolean);
    if (assess) data.assessment = assess[1].trim();
    res.json(data);
  } catch (err) {
    console.error('Demo analyze error:', err.message);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// Demo: chat follow-up (listen → transcribe client-side, we reply)
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
          content: `You are the blunt cosmetic consultant. You just gave a scan assessment. The user is asking a follow-up. Be direct, funny, and helpful. Keep replies under 100 words. If they have the scan context: "${(context || '').slice(0, 500)}"`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 200
    });
    const reply = completion.choices[0]?.message?.content?.trim() || "I didn't catch that.";
    res.json({ reply });
  } catch (err) {
    console.error('Demo chat error:', err.message);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Twin Admin listening on port ${PORT}`);
});
