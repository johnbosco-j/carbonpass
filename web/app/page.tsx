import { readFile } from "node:fs/promises";
import path from "node:path";
import { Hero } from "@/components/hero/hero";
import { Landing } from "@/components/hero/landing";
import type { FrameManifest } from "@/components/hero/types";

/** A Google Flow clip run through scripts/flow-to-frames.sh replaces the 3D scene as the hero background. */
async function flowFrames(): Promise<FrameManifest | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "public/hero/frames/manifest.json"), "utf8");
    const m = JSON.parse(raw) as FrameManifest;
    return m.count > 0 && typeof m.pattern === "string" ? m : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const frames = await flowFrames();
  return (
    <>
      <Hero frames={frames} />
      <Landing />
    </>
  );
}
