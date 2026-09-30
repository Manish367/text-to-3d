import { Client } from "@gradio/client";

export async function connect(space: string) {
  const t = process.env.HF_TOKEN;
  console.log("HF token loaded:", t ? "yes" : "NO");
  if (!t) console.warn("HF_TOKEN is missing. Check .env.local and restart npm run dev.");
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await Client.connect(space, (t ? { hf_token: t, token: t } : {}) as any);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export function isHfUrl(u: string) {
  try {
    const h = new URL(u).hostname;
    return h.endsWith(".hf.space") || h === "huggingface.co";
  } catch {
    return false;
  }
}

export function friendly(e: unknown) {
  const m = String((e as any)?.message ?? e ?? "");
  if (/quota|exceeded/i.test(m))
    return "The free GPU quota is used up for now. Try again in a few minutes.";
  if (/502|503|config|queue|busy|sleep|paused|timeout|fetch/i.test(m))
    return "The AI service is busy or waking up. Please try again in a moment.";
  return "The AI service returned an error. It may be out of free GPU quota or busy. Try again shortly.";
}