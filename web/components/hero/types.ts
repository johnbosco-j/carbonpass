/** Shared mutable scroll/pointer state for the hero layers. Written by the hero, read by the canvas loops. */
export interface HeroStore {
  /** raw scroll progress through the pinned story, 0..1 */
  target: number;
  /** smoothed progress that every layer renders */
  value: number;
  /** pointer position, -1..1 (mouse only) */
  px: number;
  py: number;
}

/** Written by scripts/flow-to-frames.sh next to the extracted frames. */
export interface FrameManifest {
  count: number;
  width: number;
  height: number;
  /** printf-style path, e.g. "/hero/frames/frame_%03d.webp" */
  pattern: string;
  /** index of the first frame (ffmpeg starts at 1) */
  start?: number;
  source?: string;
}
