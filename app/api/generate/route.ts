import { TRIPO, tripoHeaders } from "../../../lib/tripo";

export const maxDuration = 30;

const hits = new Map<string, number[]>();

export async function POST(req: Request) {
    try {
        if (!process.env.TRIPO_API_KEY)
            return Response.json({ error: "Server is missing TRIPO_API_KEY." }, { status: 500 });

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
        const now = Date.now();
        const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 6)
            return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
        hits.set(ip, [...recent, now]);

        const { prompt } = await req.json();
        if (!prompt || typeof prompt !== "string" || prompt.length > 200)
            return Response.json({ error: "Enter a prompt under 200 characters." }, { status: 400 });

        const r = await fetch(`${TRIPO}/generation/text-to-model`, {
            method: "POST",
            headers: tripoHeaders(),
            //   body: JSON.stringify({ prompt, model: process.env.TRIPO_MODEL || "v3.1-20260211" }),
            body: JSON.stringify({
                prompt,
                model: process.env.TRIPO_MODEL || "v3.1-20260211",
                face_limit: 50000,
                texture_version: "v3.5-20260815",
                texture_quality: "fast",
            }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.code !== 0 || !d.data?.task_id) {
            console.error("Tripo create failed:", r.status, JSON.stringify(d));
            const msg =
                r.status === 429
                    ? "The 3D service is busy. Please try again in a moment."
                    : /credit|balance|insufficient/i.test(JSON.stringify(d))
                        ? "The 3D generation credits are used up."
                        : "Could not start generation. Please try again.";
            return Response.json({ error: msg }, { status: 502 });
        }
        return Response.json({ taskId: d.data.task_id });
    } catch (e) {
        console.error(e);
        return Response.json({ error: "Could not start generation. Please try again." }, { status: 500 });
    }
}