/**
 * Frontalness 0–100. Blends three metrics:
 * - Eye span ratio: horizontal eye separation / face width (left-right)
 * - Nose symmetry: how centered the nose is between the eyes (left-right)
 * - Vertical tilt: nose-to-eye vertical distance / face height (up-down)
 *
 * @param kps        Normalised keypoints: [0]=rightEye [1]=leftEye [2]=noseTip
 * @param faceWidth  Bounding box width  normalised to frame (box.width  / frame.width)
 * @param faceHeight Bounding box height normalised to frame (box.height / frame.height)
 */
export function getFrontalness(
  kps: Array<{ x: number; y: number }>,
  faceWidth: number,
  faceHeight: number,
): number {
  if (kps.length < 2) return 50;

  // ── Horizontal: eye span ──────────────────────────────────────────────────
  // Frontal face: eyes ~40% of face width apart → score ~100
  // Profile face: eyes ~5% apart → score ~12
  const eyeSpan = Math.abs(kps[1]!.x - kps[0]!.x);
  const eyeSpanScore = Math.min(100, Math.max(1, (eyeSpan / faceWidth) * 250));

  if (kps.length < 3) return Math.round(eyeSpanScore);

  // ── Horizontal: nose symmetry ─────────────────────────────────────────────
  const rD = Math.abs(kps[0]!.x - kps[2]!.x);
  const lD = Math.abs(kps[1]!.x - kps[2]!.x);
  const tot = rD + lD;
  const symmetryScore =
    tot > 0 ? Math.max(1, (2 * Math.min(rD, lD)) / tot * 100) : 50;

  // ── Vertical: tilt (up/down) ──────────────────────────────────────────────
  // Nose should sit ~35% of face height below the eye midpoint.
  const eyeMidY = (kps[0]!.y + kps[1]!.y) / 2;
  const noseRatio = (kps[2]!.y - eyeMidY) / faceHeight;
  const verticalScore = Math.min(
    100,
    Math.max(1, 100 - Math.abs(noseRatio - 0.35) * 280),
  );

  return Math.round(eyeSpanScore * 0.5 + symmetryScore * 0.3 + verticalScore * 0.2);
}

/** Non-maximum suppression: remove overlapping detections above iouThreshold. */
export function nmsFilter<T extends { boundingBox: BoundingBox; score?: number }>(
  faces: T[],
  iouThreshold = 0.35,
): T[] {
  const sorted = [...faces].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const kept: T[] = [];
  for (const face of sorted) {
    if (!kept.some((k) => boxIoU(k.boundingBox, face.boundingBox) > iouThreshold)) {
      kept.push(face);
    }
  }
  return kept;
}

interface BoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function boxIoU(a: BoundingBox, b: BoundingBox): number {
  const ax2 = a.originX + a.width;
  const ay2 = a.originY + a.height;
  const bx2 = b.originX + b.width;
  const by2 = b.originY + b.height;
  const iw = Math.max(0, Math.min(ax2, bx2) - Math.max(a.originX, b.originX));
  const ih = Math.max(0, Math.min(ay2, by2) - Math.max(a.originY, b.originY));
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
