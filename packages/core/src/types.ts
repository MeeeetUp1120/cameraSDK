// ── Shared types used across all platform SDKs ────────────────────────────────

export interface CameraSession {
  token: string;
  projectId: string;
  cameraId: string;
  cameraName: string;
  type: "interactive" | "passive";
}

/**
 * Normalised face detection output — all coordinates are relative to the
 * frame dimensions (0–1). Platform adapters must convert their native
 * detector output into this shape before passing to the tracker.
 *
 * Keypoint index contract (mirrors MediaPipe BlazeFace):
 *   [0] rightEye  [1] leftEye  [2] noseTip
 */
export interface Detection {
  boundingBox: {
    originX: number;  // left edge, normalised 0–1
    originY: number;  // top edge,  normalised 0–1
    width: number;    // normalised 0–1
    height: number;   // normalised 0–1
  };
  keypoints: Array<{ x: number; y: number }>; // normalised 0–1
  score: number; // detection confidence 0–1
}

/**
 * Abstraction over a captured video frame. Platform implementations provide
 * pixel-level operations (crop, JPEG encode) while the core tracker stays
 * free of DOM / native dependencies.
 */
export interface FrameBuffer {
  readonly width: number;
  readonly height: number;

  /**
   * Snapshot the whole frame as a base64 JPEG data URL.
   * Used to capture the "best frame" for a track.
   */
  toJpegBase64(quality?: number): string;

  /**
   * Crop the face region centred on (cx, cy) with bounding-box dimensions
   * (bw × bh) — all normalised 0–1 — pad it, then return a 256×256 JPEG
   * data URL. Returns null if the crop area is invalid.
   */
  cropFaceJpeg(
    cx: number,
    cy: number,
    bw: number,
    bh: number,
    quality?: number,
  ): string | null;
}

/**
 * Live preview for a face currently being tracked — available as soon as
 * the first crop is ready (~300ms after the face appears). Updates in real
 * time as frontalness improves. Disappears when the track goes stale.
 */
export interface LiveFacePreview {
  trackId: string;
  dataUrl: string;     // best crop so far (pendingJpeg)
  frontalness: number; // 0–100, smoothed
}

export interface SelectedFace {
  trackId: string;
  dataUrl: string;      // base64 JPEG data URI ready to POST
  frontalness: number;  // 0–100
  lastSentAt: number;   // Unix ms
  createdAt: number;    // Unix ms
}

export interface PersonResult {
  id: string;
  name: string | null;
  status: string;
}

export interface CaptureResponse {
  persons: PersonResult[];
}
