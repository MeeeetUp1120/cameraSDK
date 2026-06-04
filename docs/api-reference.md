# API Reference — @meeeetup-cam/core

Core types and classes shared across all platform SDKs.

## Types

### `CameraSession`

JWT session returned after connecting with an OTP.

```ts
interface CameraSession {
  token:      string;
  projectId:  string;
  cameraId:   string;
  cameraName: string;
  type:       'interactive' | 'passive';
}
```

### `Detection`

Normalised face detection. All coordinates are **0–1** relative to frame size.

```ts
interface Detection {
  boundingBox: {
    originX: number;  // left edge
    originY: number;  // top edge
    width:   number;
    height:  number;
  };
  keypoints: Array<{ x: number; y: number }>;
  // [0] rightEye  [1] leftEye  [2] noseTip
  score: number;  // confidence 0–1
}
```

### `FrameBuffer`

Platform abstraction over a captured video frame.

```ts
interface FrameBuffer {
  readonly width:  number;
  readonly height: number;
  toJpegBase64(quality?: number): string;
  cropFaceJpeg(cx: number, cy: number, bw: number, bh: number, quality?: number): string | null;
}
```

### `SelectedFace`

A face that has been selected as the best quality for a tracked person.

```ts
interface SelectedFace {
  trackId:    string;
  dataUrl:    string;   // base64 JPEG data URI
  frontalness: number;  // 0–100
  lastSentAt: number;   // Unix ms
}
```

---

## `FaceCaptureSession`

Orchestrates tracking, quality selection, and API sends.

```ts
class FaceCaptureSession {
  constructor(options: FaceCaptureSessionOptions)

  // Feed one frame into the pipeline. Call every camera frame.
  processDetections(detections: Detection[], frame: FrameBuffer): void

  // Flush stale tracks. Call on a timer (~100ms) or each animation frame.
  tick(): void

  // Send buffered faces to API immediately then clear buffer.
  flushBatch(): Promise<void>

  // Stop all timers. Call on unmount / dispose.
  dispose(): void

  readonly trackedCount: number
  readonly pendingFaces: SelectedFace[]
}
```

### `FaceCaptureSessionOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiBaseUrl` | `string` | required | Base URL of the Meeeetup API |
| `token` | `string` | required | JWT from `/camera/connect` |
| `sessionType` | `'passive' \| 'interactive'` | required | Camera mode |
| `batchIntervalMs` | `number` | `10000` | Passive batch send interval (ms) |
| `heartbeatIntervalMs` | `number` | `30000` | `/camera/me` poll interval (ms) |
| `onSelect` | `(face: SelectedFace) => void` | — | Called on new best face |
| `onTrackRemoved` | `(trackId: string) => void` | — | Called when a track is dropped |
| `onBatchSent` | `(count: number) => void` | — | Called after successful batch send |
| `onSessionExpired` | `() => void` | — | Called on 401 from API |
| `onCameraNotFound` | `() => void` | — | Called on 404 from API |

---

## `ApiClient`

Direct API access. Used internally by `FaceCaptureSession`.

```ts
class ApiClient {
  constructor(baseUrl: string, token: string)

  // POST /camera/connect — exchange OTP for JWT session
  connect(otp: string): Promise<CameraSession>

  // POST /camera/capture — send face images, get matched persons
  capture(images: string[]): Promise<CaptureResponse>

  // GET /camera/me — heartbeat
  heartbeat(): Promise<{ id: string; name: string; type: string }>
}
```

---

## `getFrontalness`

```ts
getFrontalness(
  keypoints: Array<{ x: number; y: number }>,
  faceWidth:  number,  // normalised 0–1
  faceHeight: number,  // normalised 0–1
): number  // 0–100
```

Scores how directly a face is looking at the camera.

| Metric | Weight |
|---|---|
| Eye span (horizontal coverage) | 50% |
| Nose symmetry (centred between eyes) | 30% |
| Vertical tilt (nose-to-eye ratio) | 20% |

---

## `nmsFilter`

```ts
nmsFilter(detections: Detection[], iouThreshold?: number): Detection[]
```

Non-maximum suppression — removes overlapping detections. Default IoU threshold: `0.35`.

---

## Session utilities

```ts
// Decode JWT payload (no verification)
decodeJwtPayload(token: string): Record<string, unknown>

// Check if token is expired
isTokenExpired(token: string): boolean

// Build CameraSession from raw token
sessionFromToken(token: string): CameraSession
```

---

## Constants

```ts
TRACK_MATCH_THRESHOLD     = 0.20   // max centroid distance to link detections
TRACK_STALE_MS            = 3000   // drop track if unseen this long (ms)
TRACK_CONFIRM_MS          = 300    // min age before a track fires onSelect (ms)
BOX_DISPLAY_MS            = 150    // hide overlay box after last seen (ms)
TRACK_SELECT_MIN_FRONTALNESS = 40  // min frontalness to fire onSelect
PENDING_CONFIRM_THRESHOLD    = 50  // min frontalness to count as a confirmed frame
MIN_PENDING_CONFIRMED_FRAMES = 3   // reject single-frame detection spikes
```
