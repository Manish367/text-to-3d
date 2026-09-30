import { isAllowedUrl } from "../../../lib/tripo";

export const maxDuration = 60;

// Streams the GLB so the browser avoids CORS issues.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const u = p.get("u") ?? "";
  if (!isAllowedUrl(u)) return new Response("Bad url", { status: 400 });
  const name = (p.get("name") ?? "model").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "model";
  const up = await fetch(u);
  if (!up.ok || !up.body) return new Response("Upstream error", { status: 502 });
  return new Response(up.body, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Disposition": p.get("dl") ? `attachment; filename="${name}.glb"` : "inline",
    },
  });
}