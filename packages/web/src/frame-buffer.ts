import type { FrameBuffer } from "@meeeetup-cam/core";

/**
 * Web implementation of FrameBuffer backed by an HTMLCanvasElement.
 * The canvas should contain the current video frame (drawn via drawImage).
 */
export class CanvasFrameBuffer implements FrameBuffer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  get width(): number  { return this.canvas.width; }
  get height(): number { return this.canvas.height; }

  toJpegBase64(quality = 0.85): string {
    return this.canvas.toDataURL("image/jpeg", quality);
  }

  /**
   * Crop the face region with asymmetric padding (extra top for hair/forehead)
   * and return a 256×256 JPEG data URL.
   * cx, cy, bw, bh are all normalised (0–1).
   */
  cropFaceJpeg(
    cx: number,
    cy: number,
    bw: number,
    bh: number,
    quality = 0.85,
  ): string | null {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Asymmetric padding: MediaPipe box cuts off at forehead
    const PAD_X      = 0.4;
    const PAD_TOP    = 0.6;
    const PAD_BOTTOM = 0.2;

    const sx = Math.max(0, (cx - bw / 2) * W - bw * W * PAD_X);
    const sy = Math.max(0, (cy - bh / 2) * H - bh * H * PAD_TOP);
    const sw = Math.min(W - sx, bw * W * (1 + PAD_X * 2));
    const sh = Math.min(H - sy, bh * H * (1 + PAD_TOP + PAD_BOTTOM));

    if (sw <= 0 || sh <= 0) return null;

    const crop = document.createElement("canvas");
    crop.width = 256; crop.height = 256;
    crop.getContext("2d")?.drawImage(this.canvas, sx, sy, sw, sh, 0, 0, 256, 256);
    return crop.toDataURL("image/jpeg", quality);
  }
}

/** Copy src canvas pixels into a new canvas — used to freeze a video frame. */
export function snapshotCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width  = src.width;
  copy.height = src.height;
  copy.getContext("2d")?.drawImage(src, 0, 0);
  return copy;
}
