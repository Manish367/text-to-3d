export const maxDuration = 120;

const hits = new Map<string, number[]>();

export async function POST(req: Request) {
    try {
        const key = process.env.NVIDIA_API_KEY;
        if (!key) return Response.json({ error: "Server is missing NVIDIA_API_KEY." }, { status: 500 });

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
        const now = Date.now();
        const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
        if (recent.length >= 8) return Response.json({ error: "Too many requests." }, { status: 429 });
        hits.set(ip, [...recent, now]);

        const { prompt } = await req.json();
        if (!prompt || typeof prompt !== "string" || prompt.length > 77)
            return Response.json({ error: "Prompt must be 1 to 77 characters." }, { status: 400 });

        const r = await fetch("https://ai.api.nvidia.com/v1/genai/microsoft/trellis", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(75000),
            body: JSON.stringify({
                mode: "text",
                prompt,
                slat_cfg_scale: 3,
                ss_cfg_scale: 7.5,
                slat_sampling_steps: 25,
                ss_sampling_steps: 25,
                seed: 0,
            }),
        });
        if (!r.ok) {
            console.error("NVIDIA failed:", r.status, (await r.text()).slice(0, 300));
            return Response.json({ error: "NVIDIA service unavailable." }, { status: 502 });
        }
        const d = await r.json();
        const b64 = d.artifacts?.[0]?.base64;
        if (!b64) throw new Error("No model in NVIDIA response");

        // Stream the bytes: normal Vercel responses are capped at 4.5 MB, streamed ones are not.
        const bytes = new Uint8Array(Buffer.from(b64, "base64"));
        const stream = new ReadableStream({
            start(c) {
                c.enqueue(bytes);
                c.close();
            },
        });
        return new Response(stream, { headers: { "Content-Type": "model/gltf-binary" } });
    } catch (e) {
        console.error(e);
        return Response.json({ error: "NVIDIA service unavailable." }, { status: 500 });
    }
}