import type { TrackedFace } from "@meeeetup-cam/core";
import { BOX_DISPLAY_MS } from "@meeeetup-cam/core";

/**
 * Draw bounding boxes and frontalness labels over an overlay canvas.
 * The overlay canvas sits on top of the <video> element (position:absolute).
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  offscreen: HTMLCanvasElement,
  tracks: TrackedFace[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(
    canvas.width  / offscreen.width,
    canvas.height / offscreen.height,
  );
  const ox = (canvas.width  - offscreen.width  * scale) / 2;
  const oy = (canvas.height - offscreen.height * scale) / 2;

  const nowMs = Date.now();

  for (const t of tracks) {
    if (nowMs - t.lastSeenAt >= BOX_DISPLAY_MS) continue;

    const x = (t.dispCx - t.dispW / 2) * offscreen.width  * scale + ox;
    const y = (t.dispCy - t.dispH / 2) * offscreen.height * scale + oy;
    const w = t.dispW * offscreen.width  * scale;
    const h = t.dispH * offscreen.height * scale;

    ctx.strokeStyle = "rgba(34,197,94,0.9)";
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, w, h);

    const label =
      t.selectedFrontalness > 0
        ? `t${t.id}  ${Math.round(t.smoothedFrontalness)}% (${Math.round(t.selectedFrontalness)}%)`
        : `t${t.id}  ${Math.round(t.smoothedFrontalness)}%`;

    ctx.font = "bold 12px monospace";
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = "rgba(34,197,94,0.85)";
    ctx.fillRect(x, y - 20, tw, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 4, y - 5);
  }
}
