# meeeetup-cam SDK — Claude Instructions

## What this repo is

Standalone, distributable face-capture SDK. Packages the detection → tracking → quality-selection → API-send pipeline for three platforms. Consumed by `../meeeetup-faceid/apps/camera` via `file:` path deps.

---

## Package layout

| Path | Name | Language | Purpose |
|---|---|---|---|
| `packages/core/` | `@meeeetup-cam/core` | TypeScript | Platform-agnostic logic — no DOM, no native |
| `packages/web/` | `@meeeetup-cam/web` | TypeScript | MediaPipe BlazeFace + React hooks + Canvas |
| `packages/react-native/` | `@meeeetup-cam/react-native` | TypeScript | Vision Camera + ML Kit |
| `packages/flutter/` | `meeeetup_cam` | Dart | ML Kit + camera package + Flutter widgets |
| `examples/flutter-demo/` | — | Dart | End-to-end Flutter demo (connect via OTP → passive capture) |

---

## Core design rules

- **All tracking/geometry logic lives in `packages/core/`** — never duplicate it in platform packages.
- **`FrameBuffer` is the only platform seam.** Each platform implements `toJpegBase64()` and `cropFaceJpeg()`. Everything above that boundary is shared.
- **`Detection[]` is the detector output contract.** All detectors (MediaPipe, ML Kit, TFLite, TF.js) must convert to normalised 0–1 coordinates and `[rightEye, leftEye, noseTip]` keypoints before entering the pipeline.
- **The client must not deduplicate faces.** AWS Rekognition on the server handles dedup. The SDK only applies a cooldown to avoid flooding the API with the same face.
- **Flutter mirrors core.** `packages/flutter/lib/src/face_tracker.dart` is a Dart port of `packages/core/src/face-tracker.ts`. When one changes, the other must change identically.

---

## Pipeline

```
Video frame (platform-specific)
  └─ Detector (MediaPipe / ML Kit / TFLite) → Detection[]
       └─ nmsFilter(detections)             — suppress overlapping boxes
            └─ updateTracks()               — match to existing tracks by centroid distance
                 └─ per track:
                      smoothedFrontalness = prev × 0.7 + current × 0.3
                      update pendingJpeg when smoothed score improves
                      commit when ALL three gates pass:
                        • pendingStaleFrames ≥ 10
                        • pendingConfirmedFrames ≥ MIN_PENDING_CONFIRMED_FRAMES
                        • nowMs − lastSentAt ≥ TRACK_COOLDOWN_MS
                      on commit: lastSentAt = now, smoothedFrontalness = 0

flushStale()   — remove tracks unseen > TRACK_STALE_MS; commits any dangling pending first

10s batch timer (FaceCaptureSession)
  └─ filter buffer: face.createdAt < now − 5 000ms   (skip brand-new tracks)
  └─ POST /camera/capture { images: string[] }
  └─ on failure: put faces back in buffer (no data loss)
```

---

## Commit gate — all three must pass

| Check | Rule |
|---|---|
| Stability | `pendingStaleFrames ≥ 10` — peak held for ≥ 10 frames |
| Quality | `pendingConfirmedFrames ≥ MIN_PENDING_CONFIRMED_FRAMES (3)` at frontalness ≥ 50 |
| Cooldown | `nowMs − track.lastSentAt ≥ TRACK_COOLDOWN_MS (10 000ms)` |

On commit: `lastSentAt = Date.now()` (TS) / `DateTime.now().millisecondsSinceEpoch` (Dart), `smoothedFrontalness` reset to `0`.

---

## Constants (all platforms must stay in sync)

| Constant | Value | File |
|---|---|---|
| `TRACK_MATCH_THRESHOLD` | 0.20 | `core/face-tracker.ts` · `flutter/face_tracker.dart` |
| `TRACK_STALE_MS` | 3 000ms | same |
| `TRACK_CONFIRM_MS` | 300ms | same |
| `TRACK_COOLDOWN_MS` | 10 000ms | same |
| `TRACK_SELECT_MIN_FRONTALNESS` | 40 | same |
| `PENDING_CONFIRM_THRESHOLD` | 50 | same |
| `MIN_PENDING_CONFIRMED_FRAMES` | 3 | same |
| `BOX_DISPLAY_MS` | 150ms | same |
| Batch interval | 10 000ms | `core/pipeline.ts` · `flutter/pipeline.dart` |
| `createdAt` send filter | `< now − 5 000ms` | same |

---

## Frontalness scoring

`getFrontalness(keypoints, faceWidth, faceHeight)` → 0–100

Weights: eye-span (50%) + nose-symmetry (30%) + vertical-tilt (20%)

Keypoint index contract (mirrors MediaPipe BlazeFace): `[0]` rightEye · `[1]` leftEye · `[2]` noseTip

Do not change the weights without testing against Rekognition accuracy.

---

## Detector choices

| Platform | Default | Alternative |
|---|---|---|
| Web | `@mediapipe/tasks-vision` BlazeFace | `@tensorflow-models/blazeface` + `@tensorflow/tfjs` |
| React Native | `@react-native-ml-kit/face-detection` | `@tensorflow/tfjs-react-native` + BlazeFace |
| Flutter | `google_mlkit_face_detection` | `tflite_flutter` + BlazeFace `.tflite` (stub: `tflite_detector.dart`) |

ML Kit / MediaPipe are preferred — they expose the landmark keypoints the frontalness algorithm needs.

---

## Sync rule — cameraSDK ↔ meeeetup-faceid

`../meeeetup-faceid/apps/camera` consumes this SDK via `file:` deps. It no longer has its own pipeline.

If you change pipeline logic here:
1. Edit `packages/core/src/face-tracker.ts`
2. Mirror in `packages/flutter/lib/src/face_tracker.dart`
3. Run `pnpm build` — changes are live in `apps/camera` immediately (no reinstall needed)

React Native and Web platform packages delegate entirely to core — no changes needed there for pipeline logic.

---

## Flutter-specific notes

- `MeeeetupCameraWidget` uses `camera` package for preview + image stream.
- Detection runs in `_onCameraImage` via `MLKitFaceDetector.detectFromInputImage()`.
- `ImageFrameBuffer` wraps JPEG bytes; face crop uses asymmetric padding matching the web implementation.
- Android: `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="face" />` required in `AndroidManifest.xml`.
- iOS: `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` required in `Info.plist`.

---

## Flutter demo

```bash
cd examples/flutter-demo
# set kApiBaseUrl in lib/main.dart
flutter pub get
flutter run
```

---

## TypeScript packages

```bash
pnpm install
pnpm build        # core → web (Turborepo dependency order)
pnpm typecheck
```

Note: `packages/web` has a `file:../core` dep (not `workspace:*`) so it installs correctly outside the SDK workspace when consumed via `file:` from another monorepo.

---

## API

| Endpoint | Body | Auth | Purpose |
|---|---|---|---|
| `POST /camera/connect` | `{ otp: string }` | — | Exchange OTP → JWT (`{ projectId, cameraId, cameraName, type }`) |
| `POST /camera/capture` | `{ images: string[] }` | Bearer JWT | Batch base64 JPEG send |
| `GET /camera/me` | — | Bearer JWT | Heartbeat / session validation |
