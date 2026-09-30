export const TRIPO = "https://openapi.tripo3d.ai/v3";

export function tripoHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TRIPO_API_KEY}`,
  };
}

export function isAllowedUrl(u: string) {
  try {
    const h = new URL(u).hostname;
    return (
      h.endsWith(".tripo3d.ai") ||
      h.endsWith(".tripo3d.com") ||
      h.endsWith(".hf.space") ||
      h === "huggingface.co"
    );
  } catch {
    return false;
  }
}