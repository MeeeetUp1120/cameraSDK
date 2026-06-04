# Architecture

## Overview

meeeetup-cam uses a **Ports & Adapters (Hexagonal)** architecture. The core tracking and scoring logic is platform-agnostic. Platform packages are thin adapters that plug in camera access, face detection, and pixel operations.

```
┌─────────────────────────────────────────────────────────────┐
│                      Your App / UI                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Platform SDK Layer                         │
│                                                              │
│   @meeeetup-cam/web      @meeeetup-cam/react-native         │
│   ──────────────────     ────────────────────────           │
│   • getUserMedia         • react-native-vision-camera       │
│   • MediaPipe / TF.js    • ML Kit / TF.js-RN                │
│   • CanvasFrameBuffer    • RNFrameBuffer                     │
│   • localStorage         • AsyncStorage                     │
│   • React hooks          • React hooks + components         │
│                                                              │
│   meeeetup_cam (Flutter)                                     │
│   ──────────────────────                                     │
│   • camera package       • MLKitFaceDetector                │
│   • ImageFrameBuffer     • SharedPreferences                │
│   • Flutter widgets                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    Detection[] + FrameBuffer
                    (the platform boundary)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   @meeeetup-cam/core                         │
│                                                              │
│   FaceCaptureSession  ← orchestrator (timers, buffer)       │
│   face-tracker        ← centroid matching, track lifecycle  │
│   face-geometry       ← frontalness scoring algorithm       │
│   ApiClient           ← REST: connect / capture / heartbeat │
│   session             ← JWT decode, expiry check            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Meeeetup API                               │
│   POST /camera/connect   POST /camera/capture               │
│   GET  /camera/me        AWS Rekognition (server-side dedup)│
└─────────────────────────────────────────────────────────────┘
```

## The two platform boundaries

### 1. `Detection[]`

Every platform detector converts its native output into this normalised shape before entering the core pipeline:

```ts
interface Detection {
  boundingBox: { originX, originY, width, height }  // all 0–1
  keypoints:   [rightEye, leftEye, noseTip]          // all 0–1
  score:       number                                // 0–1
}
```

This allows swapping MediaPipe ↔ TF.js ↔ ML Kit ↔ TFLite without touching the tracker.

### 2. `FrameBuffer`

Every platform implements two pixel operations:

```ts
interface FrameBuffer {
  toJpegBase64(quality?): string       // snapshot the full frame
  cropFaceJpeg(cx, cy, bw, bh): string // crop + pad to 256×256 JPEG
}
```

| Platform | Implementation | Backing storage |
|---|---|---|
| Web | `CanvasFrameBuffer` | `HTMLCanvasElement` |
| React Native | `RNFrameBuffer` | base64 string from file read |
| Flutter | `ImageFrameBuffer` | `Uint8List` JPEG bytes |

## Face tracking pipeline

```
validFaces = nmsFilter(detections)         // remove overlapping boxes
updateTracks(validFaces, frame, tracks)    // match to existing tracks by centroid
  └─ for each detection:
       find closest existing track (< TRACK_MATCH_THRESHOLD distance)
       or create new track
       compute frontalness score
       smooth via exponential moving average (α=0.3)
       update pendingJpeg if smoothed score improved
       commit pending if peak has passed (staleFrames >= 2)

flushStale(tracks)                         // remove tracks unseen > TRACK_STALE_MS
  └─ commit any dangling pending before removal

commitPending(track)                       // promote pending → selected
  └─ call onSelect(SelectedFace) if quality >= TRACK_SELECT_MIN_FRONTALNESS
```

## Frontalness algorithm

`getFrontalness(keypoints, faceWidth, faceHeight)` → 0–100

```
eyeSpanScore   = (|leftEye.x - rightEye.x| / faceWidth)  × 250   clamped 1–100
symmetryScore  = 2 × min(rDist, lDist) / (rDist + lDist)  × 100
verticalScore  = 100 - |noseRatio - 0.35| × 280            clamped 1–100

result = eyeSpanScore × 0.5 + symmetryScore × 0.3 + verticalScore × 0.2
```

Where `noseRatio = (noseTip.y - eyeMidpoint.y) / faceHeight`.

A perfect frontal face scores ~95–100. A full profile scores ~10–15.

## Why the client does not deduplicate

AWS Rekognition on the server identifies and deduplicates people accurately across cameras and time. Client-side face recognition (ML Kit / MediaPipe) is only used to:

1. Pick the **best quality frame** per tracked face (sharpest + most frontal)
2. Apply a short **cooldown** (20s) to avoid re-sending the identical frame repeatedly

The client's job is to send good images. The server decides who is who.

## Detector comparison

| Detector | Platforms | Keypoints | On-device | Notes |
|---|---|---|---|---|
| MediaPipe BlazeFace | Web | 6 (we use 3) | Yes (WASM) | Default for web. CDN or self-hosted. |
| ML Kit Face Detection | Android + iOS | 7 landmark types | Yes | Default for RN + Flutter. Most accurate on mobile. |
| TF.js BlazeFace | Web + RN | 6 (we use 3) | Yes | Alternative. Heavier than MediaPipe on web. |
| TFLite BlazeFace | Flutter | 6 (we use 3) | Yes | Stub provided. Use if ML Kit is unavailable. |
