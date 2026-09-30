import { handle_file } from "@gradio/client";
import { connect, friendly, isHfUrl } from "../../../lib/hf";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!isHfUrl(imageUrl)) return Response.json({ error: "Invalid image." }, { status: 400 });

    // Download the image here and upload it directly, instead of asking the Space to fetch a URL.
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("image fetch failed");
    const type = res.headers.get("content-type") || "image/webp";
    const ext = type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : "webp";
    const file = new File([await res.arrayBuffer()], `input.${ext}`, { type });

    const c = await connect("microsoft/TRELLIS.2");
    try { await c.predict("/start_session", {}); } catch {}

    let img: any = handle_file(file);
    try {
      const pre = await c.predict("/preprocess_image", { input: img });
      img = (pre.data as any[])[0] ?? img;
    } catch {
      console.warn("preprocess_image failed, continuing with the original image");
    }

    await c.predict("/image_to_3d", {
      image: img,
      seed: 0,
      resolution: "512",
      ss_guidance_strength: 7.5, ss_guidance_rescale: 0.7, ss_sampling_steps: 12, ss_rescale_t: 5,
      shape_slat_guidance_strength: 7.5, shape_slat_guidance_rescale: 0.5, shape_slat_sampling_steps: 12, shape_slat_rescale_t: 3,
      tex_slat_guidance_strength: 1, tex_slat_guidance_rescale: 0, tex_slat_sampling_steps: 12, tex_slat_rescale_t: 3,
    });
    const g = await c.predict("/extract_glb", { decimation_target: 100000, texture_size: 1024 });
    const d = g.data as any[];
    const glbUrl = d[1]?.url ?? d[0]?.url;
    if (!glbUrl) throw new Error("no glb");
    return Response.json({ glbUrl });
  } catch (e) {
    console.error(e);
    return Response.json({ error: friendly(e) }, { status: 500 });
  }
}