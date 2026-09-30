import { connect, friendly } from "../../../lib/hf";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 200)
      return Response.json({ error: "Enter a prompt under 200 characters." }, { status: 400 });
    const client = await connect("black-forest-labs/FLUX.1-schnell");
    const r = await client.predict("/infer", {
      prompt: `${prompt}, single object, centered, plain white background, studio lighting`,
      seed: 0,
      randomize_seed: true,
      width: 768,
      height: 768,
      num_inference_steps: 4,
    });
    const url = (r.data as any[])[0]?.url;
    if (!url) throw new Error("no image");
    return Response.json({ url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: friendly(e) }, { status: 500 });
  }
}
