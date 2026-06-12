import { getFrontalness } from "./face-geometry";
import type { Detection, FrameBuffer, SelectedFace } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────────
export const TRACK_MATCH_THRESHOLD        = 0.20;  // max normalised centroid distance
export const TRACK_STALE_MS               = 3000;  // drop track if unseen this long
export const TRACK_CONFIRM_MS             = 300;   // face must be tracked before SELECTED
export const BOX_DISPLAY_MS               = 150;   // hide overlay box after last seen
export const TRACK_SELECT_MIN_FRONTALNESS = 40;    // min frontalness to fire onSelect
export const PENDING_CONFIRM_THRESHOLD    = 50;    // min frontalness to count a confirmed frame
export const MIN_PENDING_CONFIRMED_FRAMES = 3;     // reject single-frame MediaPipe spikes
export const TRACK_COOLDOWN_MS             = 10_000; // min ms between sends for the same track

// ── Types ──────────────────────────────────────────────────────────────────────
export interface TrackedFace {
  id: string;
  createdAt: number;
  cx: number; cy: number;
  dispCx: number; dispCy: number; dispW: number; dispH: number;
  bestJpeg: string | null;
  bestCx: number; bestCy: number;
  bestFrontalness: number;
  selectedJpeg: string | null;
  selectedFrontalness: number;
  currentFrontalness: number;
  smoothedFrontalness: number;
  lastSeenAt: number;
  lastSentAt: number;
  lastSentFrontalness: number;
  pendingJpeg: string | null;
  pendingFrontalness: number;
  pendingCx: number;
  pendingCy: number;
  pendingBw: number;
  pendingBh: number;
  pendingStaleFrames: number;
  pendingConfirmedFrames: number;
}

// ── Factory ────────────────────────────────────────────────────────────────────
let trackIdCounter = 0;

export function createTrack(
  cx: number, cy: number,
  nW: number, nH: number,
  nowMs: number,
): TrackedFace {
  return {
    id: String(++trackIdCounter),
    createdAt: nowMs, cx, cy,
    dispCx: cx, dispCy: cy, dispW: nW, dispH: nH,
    bestJpeg: null, bestCx: cx, bestCy: cy, bestFrontalness: 0,
    selectedJpeg: null, selectedFrontalness: 0,
    currentFrontalness: 0, smoothedFrontalness: 0,
    lastSeenAt: nowMs, lastSentAt: 0, lastSentFrontalness: 0,
    pendingJpeg: null, pendingFrontalness: 0,
    pendingCx: cx, pendingCy: cy, pendingBw: nW, pendingBh: nH,
    pendingStaleFrames: 0, pendingConfirmedFrames: 0,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toSelectedFace(t: TrackedFace): SelectedFace {
  return {
    trackId: t.id,
    dataUrl: t.selectedJpeg!,
    frontalness: t.selectedFrontalness,
    lastSentAt: t.lastSentAt,
    createdAt: t.createdAt,
  };
}

function resetPending(track: TrackedFace): void {
  track.pendingFrontalness = 0;
  track.pendingJpeg = null;
  track.pendingStaleFrames = 0;
  track.pendingConfirmedFrames = 0;
  track.smoothedFrontalness = 0;
}

// ── Commit pipeline ────────────────────────────────────────────────────────────

/**
 * Promote the pending peak to the confirmed best.
 * Calls onSelect only if quality passes the minimum threshold.
 */
export function commitPending(
  track: TrackedFace,
  onSelect: (face: SelectedFace) => void,
): void {
  if (track.pendingFrontalness > track.bestFrontalness) {
    track.bestFrontalness = track.pendingFrontalness;
  }
  track.bestJpeg = track.pendingJpeg;
  track.bestCx   = track.pendingCx;
  track.bestCy   = track.pendingCy;

  if (
    track.pendingFrontalness > track.selectedFrontalness ||
    track.selectedJpeg === null
  ) {
    track.selectedFrontalness = track.pendingFrontalness;
    track.selectedJpeg        = track.pendingJpeg;
    if (track.selectedJpeg && track.pendingFrontalness >= TRACK_SELECT_MIN_FRONTALNESS) {
      track.lastSentAt = Date.now();
      onSelect(toSelectedFace(track));
    }
  }
  resetPending(track);
}

// ── Track management ───────────────────────────────────────────────────────────

/**
 * Match detected faces to existing tracks, create new tracks for unmatched
 * faces, update pending capture state, and trigger commits when a peak is
 * confirmed. Mutates `tracks` (push only).
 */
export function updateTracks(
  detections: Detection[],
  frame: FrameBuffer,
  tracks: TrackedFace[],
  onCommit: (track: TrackedFace) => void,
): void {
  const nowMs    = Date.now();
  const available = [...tracks];

  for (const det of detections) {
    const box = det.boundingBox;
    // Convert absolute pixel coords → normalised (detections are already normalised)
    const cx = box.originX + box.width  / 2;
    const cy = box.originY + box.height / 2;
    const nW = box.width;
    const nH = box.height;

    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < available.length; i++) {
      const dist = Math.hypot(cx - available[i]!.cx, cy - available[i]!.cy);
      if (dist < TRACK_MATCH_THRESHOLD && dist < bestDist) {
        bestDist = dist; bestIdx = i;
      }
    }

    let track: TrackedFace;
    if (bestIdx === -1) {
      track = createTrack(cx, cy, nW, nH, nowMs);
      tracks.push(track);
    } else {
      track = available[bestIdx]!;
      available.splice(bestIdx, 1);
    }

    track.cx = cx; track.cy = cy; track.lastSeenAt = nowMs;
    track.dispCx = cx; track.dispCy = cy; track.dispW = nW; track.dispH = nH;

    const frontalness =
      getFrontalness(det.keypoints, nW, nH) * det.score;
    track.currentFrontalness = frontalness;
    track.smoothedFrontalness =
      track.smoothedFrontalness === 0
        ? frontalness
        : track.smoothedFrontalness * 0.7 + frontalness * 0.3;

    const confirmed = nowMs - track.createdAt >= TRACK_CONFIRM_MS;
    if (confirmed) {
      if (frontalness >= PENDING_CONFIRM_THRESHOLD) track.pendingConfirmedFrames++;

      if (
        track.smoothedFrontalness > track.pendingFrontalness ||
        track.pendingJpeg === null
      ) {
        track.pendingFrontalness = track.smoothedFrontalness;
        track.pendingJpeg        = frame.cropFaceJpeg(cx, cy, nW, nH) ?? frame.toJpegBase64();
        track.pendingCx          = cx;
        track.pendingCy          = cy;
        track.pendingBw          = nW;
        track.pendingBh          = nH;
        track.pendingStaleFrames = 0;
      } else {
        track.pendingStaleFrames++;
        const cooldownOk = nowMs - track.lastSentAt >= TRACK_COOLDOWN_MS;
        const qualityOk  = track.pendingConfirmedFrames >= MIN_PENDING_CONFIRMED_FRAMES;
        if (track.pendingStaleFrames >= 10 && track.pendingJpeg !== null && cooldownOk && qualityOk) {
          onCommit(track);
        }
      }
    }
  }

  // Advance stale countdown for unmatched tracks
  for (const track of available) {
    track.pendingStaleFrames++;
    const cooldownOk = nowMs - track.lastSentAt >= TRACK_COOLDOWN_MS;
    const qualityOk  = track.pendingConfirmedFrames >= MIN_PENDING_CONFIRMED_FRAMES;
    if (
      track.pendingStaleFrames >= 10 &&
      track.pendingFrontalness > track.bestFrontalness &&
      cooldownOk && qualityOk
    ) {
      onCommit(track);
    }
  }
}

/** Remove tracks unseen for TRACK_STALE_MS. Commits any dangling pending first. */
export function flushStale(
  tracks: TrackedFace[],
  onCommit: (track: TrackedFace) => void,
  onRemove: (id: string) => void,
): TrackedFace[] {
  const nowMs   = Date.now();
  const removed = tracks.filter((t) => nowMs - t.lastSeenAt >= TRACK_STALE_MS);
  for (const t of removed) {
    if (t.pendingJpeg) onCommit(t);
    onRemove(t.id);
  }
  return tracks.filter((t) => nowMs - t.lastSeenAt < TRACK_STALE_MS);
}
