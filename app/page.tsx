"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion";

const Viewer = dynamic(() => import("../components/Viewer"), { ssr: false });

// Order the AI services are tried in. Swap the names to change the priority.
const ORDER: ("tripo" | "hf" | "nvidia")[] = ["tripo", "hf", "nvidia"];
// const ORDER: ("nvidia" | "tripo" | "hf")[] = ["nvidia"];

const EXAMPLES = ["a crystal dragon", "a vintage camera", "a wooden chair", "a red sports car", "a cozy mushroom house"];

function useTyped(list: string[]) {
  const [t, setT] = useState("");
  useEffect(() => {
    let i = 0, j = 0, del = false;
    const id = setInterval(() => {
      const w = list[i];
      if (!del) { j++; if (j > w.length + 14) del = true; }
      else { j -= 2; if (j <= 0) { del = false; i = (i + 1) % list.length; j = 0; } }
      setT(w.slice(0, Math.max(0, Math.min(j, w.length))));
    }, 65);
    return () => clearInterval(id);
  }, [list]);
  return t;
}

async function post(url: string, body: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
}

export default function Home() {
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^(a|an|the)-/, "").slice(0, 40) || "model";
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState(false);
  const [progress, setProgress] = useState(0);
  const [glb, setGlb] = useState<string | null>(null);
  const [fileName, setFileName] = useState("model");
  const [err, setErr] = useState("");
  const [rotate, setRotate] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const typed = useTyped(EXAMPLES);

  // Prompt bar: rotates when idle, returns to flat when the user clicks, types, or generates
  const rot = useMotionValue(0);
  const ctl = useRef<{ stop: () => void } | null>(null);
  const active = focused || prompt.trim().length > 0 || busy;
  useEffect(() => {
    ctl.current?.stop();
    const cur = rot.get();
    ctl.current = active
      ? animate(rot, Math.round(cur / 360) * 360, { type: "spring", stiffness: 90, damping: 16 })
      : animate(rot, cur + 360, { duration: 10, ease: "linear", repeat: Infinity });
    return () => ctl.current?.stop();
  }, [active, rot]);

  // NVIDIA TRELLIS: one request, about 50 seconds, returns the GLB bytes.
  // NVIDIA gives no progress info, so the bar below is an estimate.
  async function viaNvidia(p: string): Promise<string> {
    setProgress(5);
    const t = setInterval(() => setProgress((x) => Math.min(x + 2, 90)), 1000);
    try {
      const r = await fetch("/api/nvidia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: p }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "NVIDIA failed.");
      }
      return URL.createObjectURL(await r.blob());
    } finally {
      clearInterval(t);
    }
  }

  // Tripo: create a task, then poll it
  async function viaTripo(p: string): Promise<string> {
    setProgress(0);
    const a = await post("/api/generate", { prompt: p });
    const started = Date.now();
    while (true) {
      await new Promise((res) => setTimeout(res, 3000));
      if (Date.now() - started > 300000) throw new Error("Tripo timed out.");
      const s = await fetch(`/api/status?id=${encodeURIComponent(a.taskId)}`, { cache: "no-store" });
      const d = await s.json().catch(() => ({}));
      if (!s.ok || d.status === "failed") throw new Error(d.error || "Tripo failed.");
      setProgress(d.progress ?? 0);
      if (d.status === "success") return d.modelUrl;
    }
  }

  // Hugging Face: FLUX image, then TRELLIS.2 3D
  async function viaHF(p: string): Promise<string> {
    setBackup(true);
    setProgress(10);
    const a = await post("/api/generate-image", { prompt: p });
    setProgress(45);
    const b = await post("/api/generate-model", { imageUrl: a.url });
    return b.glbUrl;
  }

  async function generate(p = prompt) {
    const text = p.trim();
    if (!text || busy) return;
    if (glb?.startsWith("blob:")) URL.revokeObjectURL(glb);
    setErr(""); setGlb(null); setProgress(0); setBackup(false); setBusy(true);
    try {
      let url = "";
      for (const name of ORDER) {
        try {
          if (name === "nvidia") {
            if (text.length > 77) continue; // NVIDIA accepts up to 77 characters
            url = await viaNvidia(text);
          } else if (name === "tripo") url = await viaTripo(text);
          else url = await viaHF(text);
          break;
        } catch (e) {
          console.warn(`${name} failed, trying the next service`, e);
        }
      }
      if (!url) throw new Error("All AI services are unavailable right now.");
      setGlb(url);
      setFileName(slug(text));
      setViewKey((k) => k + 1);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
      setBackup(false);
    }
  }

  const isSample = !!glb && glb.startsWith("/samples/");
  const direct = isSample || (!!glb && glb.startsWith("blob:"));
  const proxied = glb ? (direct ? glb : `/api/proxy?u=${encodeURIComponent(glb)}`) : "";
  const words = "Turn words into 3D.".split(" ");
  const label = backup
    ? progress < 45 ? "Main services busy. Using backup AI" : "Building your 3D model with backup AI"
    : progress < 25 ? "Understanding your prompt" : progress < 75 ? "Building the 3D shape" : "Adding textures and finishing";

  return (
    <>
      <div className="bg-mesh"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="grid-bg" /></div>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-10 pt-16 sm:pt-24">
        <h1 className="head text-center text-5xl font-extrabold leading-[1.05] sm:text-7xl">
          {words.map((w, i) => (
            <motion.span key={i} className="mr-[.25em] inline-block" initial={{ opacity: 0, y: 40, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.15 * i, duration: 0.7 }}>
              {i === words.length - 1 ? <span className="grad-text">{w}</span> : w}
            </motion.span>
          ))}
        </h1>
        <motion.p className="mx-auto mt-5 max-w-xl text-center text-[#A1A1B5]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          Describe any object. AI builds it in 3D and hands you a textured model you can spin, zoom and download.
        </motion.p>

        <motion.form className="mx-auto mt-10 w-full max-w-2xl" onSubmit={(e) => { e.preventDefault(); generate(); }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 }}>
          <motion.div className="prompt-wrap" style={{ rotate: rot }}>
            <div className="prompt-in">
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} maxLength={200} disabled={busy} aria-label="Describe a 3D object" placeholder={typed || "Describe an object..."} />
              <button className="btn" disabled={busy || !prompt.trim()}>{busy ? "Generating..." : "Generate 3D"}</button>
            </div>
          </motion.div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((x) => (
              <button type="button" key={x} className="chip" disabled={busy} onClick={() => { setPrompt(x); generate(x); }}>{x}</button>
            ))}
          </div>
        </motion.form>

        <motion.section className="glass relative mx-auto mt-10 h-[440px] w-full overflow-hidden sm:h-[540px]" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.7 }}>
          <AnimatePresence mode="wait">
            {busy ? (
              <motion.div key="load" className="flex h-full flex-col items-center justify-center gap-7 px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="orb"><i /><i /><i /><b /></div>
                <div className="w-full max-w-sm">
                  <p className="head mb-3 text-center text-lg">{label}</p>
                  <div className="bar"><span style={{ width: `${Math.max(progress, 5)}%` }} /></div>
                  <p className="mono mt-3 text-center text-xs text-[#A1A1B5]">
                    {backup ? "Using the backup AI. This can take 1 to 2 minutes." : "This can take 1 to 3 minutes."}
                  </p>
                </div>
              </motion.div>
            ) : glb ? (
              <motion.div key="model" className="h-full w-full" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
                <Viewer key={viewKey} url={proxied} autoRotate={rotate} />
                <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
                  <button className="tool" onClick={() => setRotate((r) => !r)}>{rotate ? "Pause spin" : "Auto spin"}</button>
                  <button className="tool" onClick={() => setViewKey((k) => k + 1)}>Reset view</button>
                  <a className="btn !py-2 !text-sm" href={direct ? proxied : `${proxied}&dl=1&name=${encodeURIComponent(fileName)}`} download={`${fileName}.glb`}>Download GLB</a>
                </div>
                <p className="mono pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-[#A1A1B5]">Drag to rotate. Scroll to zoom.</p>
                {isSample && <p className="mono pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-xs text-[#F472B6]">Sample model. Live generation is unavailable right now.</p>}
              </motion.div>
            ) : (
              <motion.div key="empty" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="orb opacity-40"><i /><i /><i /></div>
                <p className="head text-xl">{err ? "That did not work" : "Your model appears here"}</p>
                <p className="max-w-sm text-sm text-[#A1A1B5]">{err || "Type a prompt above or pick an example to build your first 3D model."}</p>
                {err && (
                  <div className="mt-2 flex gap-2">
                    <button className="btn !py-2 !text-sm" onClick={() => generate()}>Try again</button>
                    <button className="tool" onClick={() => { setErr(""); setGlb("/samples/chair.glb");  setFileName("wooden-chair-sample"); setViewKey((k) => k + 1); }}>View a sample model</button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        <footer className="mono mt-auto pt-10 text-center text-xs text-[#7d7d95]">
          Built by Monish Kumar Das with Next.js, React Three Fiber, Tripo and Hugging Face, NVIDIA TRELLIS
        </footer>
      </main>
    </>
  );
}