// Constant-frame-rate page capture over the Chrome DevTools screencast.
//
// Why not Playwright's recordVideo: it writes at least one video frame per screencast frame, so during smooth
// scrolls and animations (~60 frames/s from the browser) the 25 fps video runs slower than real time. In testing
// a 137 s session came out 147.5 s long, which breaks the beat timestamps the assembler cuts on. Here every
// output frame k shows the latest browser frame received before k/25 s, so video time == wall-clock time.
import { spawn } from "node:child_process";
import { findFfmpeg } from "./ffmpeg.mjs";

export async function startScreencast(page, { file, fps = 25, width = 1920, height = 1080, quality = 92 }) {
  const { ffmpeg: bin, env } = findFfmpeg();
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:0:0:color=0xF6F4EE,format=yuv420p`;
  const proc = spawn(
    bin,
    ["-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "pipe:0", "-an", "-vf", vf,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-r", String(fps), "-f", "matroska", "-y", file],
    { env, stdio: ["pipe", "ignore", "pipe"] },
  );
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d));
  const exited = new Promise((resolve) => proc.on("close", resolve));

  const cdp = await page.context().newCDPSession(page);
  const t0 = performance.now();
  const rel = () => (performance.now() - t0) / 1000;
  const step = 1 / fps;
  let last = null;
  let next = 0; // time of the next output frame
  let frames = 0;
  let stopped = false;

  const fill = (upto) => {
    while (last && next < upto) {
      proc.stdin.write(last);
      frames++;
      next += step;
    }
  };
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    if (stopped) return;
    const buf = Buffer.from(data, "base64");
    if (!last) last = buf; // the first frame also covers the time before it arrived
    fill(rel());
    last = buf;
  });
  const timer = setInterval(() => fill(rel()), 40);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });

  return {
    t0,
    now: rel,
    async stop() {
      const end = rel();
      fill(end);
      stopped = true;
      clearInterval(timer);
      await cdp.send("Page.stopScreencast").catch(() => {});
      await cdp.detach().catch(() => {});
      proc.stdin.end();
      const code = await exited;
      if (code !== 0) throw new Error(`screencast encoder failed (${code}): ${stderr.slice(-1500)}`);
      return { file, frames, duration: frames / fps, wall: end };
    },
  };
}
