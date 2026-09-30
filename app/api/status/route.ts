import { TRIPO, tripoHeaders } from "../../../lib/tripo";

export const maxDuration = 20;

const FAILED = ["failed", "cancelled", "banned", "expired", "unknown"];

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{6,80}$/.test(id)) return Response.json({ error: "Bad id." }, { status: 400 });
  try {
    const r = await fetch(`${TRIPO}/tasks/${id}`, { headers: tripoHeaders(), cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.code !== 0) {
      console.error("Tripo status failed:", r.status, JSON.stringify(d));
      return Response.json({ error: "Could not check progress." }, { status: 502 });
    }
    const t = d.data ?? {};
    if (FAILED.includes(t.status))
      return Response.json({ status: "failed", error: "Generation failed. Try a different prompt." });
    const modelUrl = t.output?.model_url ?? t.output?.pbr_model ?? t.output?.model;
    if (t.status === "success" && !modelUrl)
      return Response.json({ status: "failed", error: "The model file was not returned." });
    return Response.json({ status: t.status, progress: t.progress ?? 0, modelUrl });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not check progress." }, { status: 500 });
  }
}