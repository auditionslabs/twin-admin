# Image & Video Generators – APIs, Galleries, LoRA

## MotionMuse-Style Flow

`/motionmuse.html` – **Upload image → Pick motion template → Generate video → Download**

- No camera required: drag & drop or file picker
- 15 motion templates (Gentle Sway, Dancing, Hair Toss, Smile Reveal, etc.)
- Optional custom prompt to override template
- Uses Fal LTX-2 (prompt) or Replicate FramePack (prompt) or ms-img2vid (generic motion)

---

## Current API Status

| Endpoint | Fal.ai | Replicate | Status |
|----------|--------|-----------|--------|
| `POST /api/demo/scenario-image` | Flux img2img | bxclib2/flux_img2img | ✅ Working |
| `POST /api/demo/img2vid` | LTX-2 img2vid | lucataco/ms-img2vid | ✅ Working |
| `POST /api/demo/enhanced-image` | Flux img2img | — | ✅ Fal only |

**Requires:** `FAL_AI_KEY` or `REPLICATE_API_TOKEN` in `.env`.

**Quick test:**
```bash
npm run sanity-check -- --skip-video
```

---

## Galleries & Examples

### Replicate

- **Scenario image:** https://replicate.com/bxclib2/flux_img2img (examples + schema)
- **Img2vid:** https://replicate.com/lucataco/ms-img2vid
- **Wan LoRA video:** https://replicate.com/wan-video/wan2.1-with-lora/examples
- **Flux LoRA image:** https://replicate.com/black-forest-labs/flux-dev-lora

### Fal.ai

- **Flux:** https://fal.ai/models/fal-ai/flux
- **LTX video:** https://fal.ai/models/fal-ai/ltx-2

### Civitai

- **No public API** – use as a LoRA **source** only.
- Browse models: https://civitai.com/models
- Download `.safetensors` or get the **direct download URL** for use in Replicate `lora_url`.

### Hugging Face

- **LoRA repos:** https://huggingface.co/models?pipeline_tag=text-to-image
- Use the raw file URL (e.g. `https://huggingface.co/.../resolve/main/...safetensors`) as `lora_url` in Replicate.

---

## Using LoRA (Wan, Flux, Custom)

### Option A: Replicate Wan2.1 + LoRA (text-to-video)

**Model:** `wan-video/wan2.1-with-lora`

- **Inputs:** `prompt`, `lora_url`, `lora_strength_model`, `lora_strength_clip`, `aspect_ratio`, etc.
- **lora_url:** Direct URL to `.safetensors` from Civitai or HuggingFace.
- **Text-to-video only** – no image input.

Example:
```js
replicate.run('wan-video/wan2.1-with-lora', {
  input: {
    prompt: 'A woman dancing elegantly in soft light',
    lora_url: 'https://civitai.com/api/download/models/...',
    lora_strength_model: 0.8,
    lora_strength_clip: 0.9,
    model: '14b'
  }
});
```

### Option B: Replicate Flux Dev LoRA (image-to-image)

**Model:** `black-forest-labs/flux-dev-lora`

- **Inputs:** `image`, `prompt`, `lora_url`, `lora_scale`, etc.
- Use for **realistic portrait / style transfer** from an input photo.
- LoRA from Civitai/HuggingFace.

### Option C: Two-step (image + LoRA → video)

1. Generate **image** with `flux-dev-lora` + your LoRA (Civitai URL).
2. Feed that image to `lucataco/ms-img2vid` for video.

---

## Adding LoRA Support to Twin-Admin

### 1. New endpoint: `POST /api/demo/scenario-image-lora`

```js
// Accepts: image, prompt, loraUrl, loraStrength
// Calls Replicate black-forest-labs/flux-dev-lora
// Falls back to flux_img2img if no loraUrl
```

### 2. New endpoint: `POST /api/demo/video-lora`

```js
// Accepts: prompt, loraUrl (optional image for conditioning if model supports it)
// Calls Replicate wan-video/wan2.1-with-lora for t2v with style
```

### 3. Civitai LoRA URL

- Civitai does **not** have a public REST API.
- To use a Civitai LoRA:
  1. Open the model page.
  2. Use “Download” → copy the file URL (or use Civitai’s download API if you have auth).
  3. Pass that URL as `lora_url` to Replicate.

### 4. Content policy

- **Replicate**, **Fal**, and **Civitai** enforce content policies.
- “Realistic topless dancer” or similar can be blocked.
- Use only LoRAs and prompts that comply with each platform’s ToS.

---

## Summary

| Need | Provider | Model | LoRA? |
|------|----------|-------|-------|
| Image from prompt | Fal / Replicate | Flux img2img | No (current) |
| Image + custom style | Replicate | flux-dev-lora | Yes, via `lora_url` |
| Video from image | Fal / Replicate | LTX-2, ms-img2vid | No |
| Video from prompt + style | Replicate | wan2.1-with-lora | Yes, via `lora_url` |
| LoRA source | Civitai / HuggingFace | — | Download URL only |

**Practical path for “realistic dancer” style:**
1. Pick a compliant LoRA on Civitai (e.g. “realistic”, “cinematic”).
2. Get the direct `.safetensors` URL.
3. Add a LoRA-enabled endpoint that calls `flux-dev-lora` (image) or `wan2.1-with-lora` (video) with that `lora_url`.
