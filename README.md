# Prism3D: text to 3D

Type a prompt, get a textured 3D model (GLB) you can rotate, zoom and download.

**Live demo:** 
**Source code:** https://github.com/Manish367/text-to-3d

## Features
- Text prompt in, textured 3D model out (GLB)
- Interactive viewer: drag to rotate, scroll to zoom, auto-spin toggle, reset view
- Download button; the file is named after the prompt (for example `crystal-dragon.glb`)
- Automatic fallback between AI services, with a bundled sample model as the last resort
- Animated dark UI built with Framer Motion

## How it works
The server tries these services in order, and the page moves to the next one if a service fails:

| Order | Service | How it is used |
|---|---|---|
| 1 | **Tripo** (text-to-3D API, v3.1) | `/api/generate` creates a task, `/api/status` is polled every 3 seconds, and the finished GLB is streamed through `/api/proxy` |
| 2 | **Hugging Face Spaces** | FLUX.1-schnell makes an image, then TRELLIS.2 turns it into a 3D model (`/api/generate-image`, `/api/generate-model`) using the free ZeroGPU quota |
| 3 | **Sample model** | A bundled chair GLB, clearly labelled as a sample |

**NVIDIA TRELLIS (built, currently disabled).** The route `/api/nvidia` calls NVIDIA's hosted TRELLIS text-to-3D API. It worked in NVIDIA's browser playground (about 45 to 50 seconds), but API calls returned a 500 error or timed out in my tests, so it is not in the live order. To try it again, add `"nvidia"` to the `ORDER` list in `app/page.tsx` and set `NVIDIA_API_KEY`.

## Tech stack
Next.js (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Three.js with React Three Fiber and drei, `@gradio/client`.

## Run locally
```bash
npm install
copy .env.example .env.local   # on macOS/Linux: cp .env.example .env.local
npm run dev
```
Then open http://localhost:3000. Add your keys to `.env.local`:

| Variable | Purpose |
|---|---|
| `TRIPO_API_KEY` | Main provider (Tripo API) |
| `HF_TOKEN` | Backup provider (Hugging Face read token) |
| `TRIPO_MODEL` | Optional. Defaults to `v3.1-20260211` |
| `NVIDIA_API_KEY` | Optional. Only used if NVIDIA is enabled |

## Deploy (Vercel)
Import the GitHub repo, add the environment variables above (at least `TRIPO_API_KEY` and `HF_TOKEN`), and deploy.

## Project structure
```
app/page.tsx              UI, provider order, download naming
app/api/generate          Tripo: create task
app/api/status            Tripo: check progress
app/api/generate-image    Hugging Face: FLUX image
app/api/generate-model    Hugging Face: TRELLIS.2 3D + GLB
app/api/nvidia            NVIDIA TRELLIS (disabled)
app/api/proxy             Streams GLB files (allowed hosts only)
components/Viewer.tsx     Three.js viewer
lib/                      Provider helpers
public/samples/           Bundled fallback model
```

## Limitations
- Generation takes about 1 to 3 minutes, depending on the service.
- Tripo runs on limited free credits (about 20 credits per model), and the Hugging Face backup uses a small daily free GPU quota. Heavy use can exhaust both, in which case the sample model is offered.
- Generations are limited to 6 per IP per hour. The counter lives in server memory, so it is approximate.
- Tripo's model links are temporary, so download soon after generating.
- Downloaded GLB files open in Blender, Windows 3D Viewer, or online viewers such as gltf-viewer.donmccurdy.com. They are binary files, not for Word or PDF readers.

## Author
Monish Kumar Das