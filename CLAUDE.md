# meeeetup-cam SDK — Claude Instructions

## What this repo is

Standalone, distributable camera face-capture SDK ported from `meeeetup-faceid/apps/camera`.
Packages the face-detection + tracking + API-send pipeline for three platforms.

## Package layout

| Path | NPM / Pub name | Language | Purpose |
|---|---|---|---|
| `packages/core/` | `@meeeetup-cam/core` | TypeScript | Platform-agnostic logic only — no DOM, no native |
| `packages/web/` | `@meeeetup-cam/web` | TypeScript | MediaPipe BlazeFace + React hooks + Canvas |
| `packages/react-native/` | `@meeeetup-cam/react-native` | TypeScript + JSX | Vision Camera + ML Kit |
| `packages/flutter/` | `meeeetup_cam` | Dart | ML Kit + camera package + Flutter widgets |
| `examples/flutter-demo/` | — | Dart | Flutter test app (connect via OTP → passive capture) |

## Core design rules

- **All tracking/geometry logic lives in `packages/core/`** — never duplicate it in platform packages.
- **`FrameBuffer` is the only platform seam.** Each platform implements `toJpegBase64()` and `cropFaceJpeg()`. Everything above that boundary is shared.
- **`Detection[]` is the detector output contract.** All detectors (MediaPipe, ML Kit, TFLite, TF.js) must convert to normalised coordinates and `[rightEye, leftEye, noseTip]` keypoints before entering the pipeline.
- **The client must not deduplicate faces.** AWS Rekognition on the server handles dedup. The SDK only applies a short cooldown to avoid re-sending the exact same capture within seconds.

## Algorithm — frontalness scoring

`getFrontalness(keypoints, faceWidth, faceHeight)` → 0–100

Weights: eye-span (50%) + nose-symmetry (30%) + vertical-tilt (20%)

Do not change the weights without testing against the Rekognition accuracy.

## API endpoints

- `POST /camera/connect` `{ otp }` → `{ token }` — JWT contains `{ projectId, cameraId, cameraName, type }`
- `POST /camera/capture` `{ images: string[] }` Bearer JWT — base64 JPEG array
- `GET /camera/me` Bearer JWT — heartbeat, returns `{ id, name, type }`

## Detector choices

| Platform | Default | TensorFlow alternative |
|---|---|---|
| Web | `@mediapipe/tasks-vision` BlazeFace | `@tensorflow-models/blazeface` + `@tensorflow/tfjs` |
| React Native | `@react-native-ml-kit/face-detection` | `@tensorflow/tfjs-react-native` + BlazeFace |
| Flutter | `google_mlkit_face_detection` | `tflite_flutter` + BlazeFace `.tflite` (stub in `tflite_detector.dart`) |

ML Kit / MediaPipe are preferred — they expose the landmark keypoints the frontalness algorithm needs.

## Flutter-specific notes

- `MeeeetupCameraWidget` uses `camera` package for the preview + image stream.
- Detection runs in `_onCameraImage` via `MLKitFaceDetector.detectFromInputImage()`.
- `ImageFrameBuffer` wraps JPEG bytes and handles the face crop with asymmetric padding (matches web).
- Permissions required: `NSCameraUsageDescription` (iOS) + `android.permission.CAMERA` (Android).
- ML Kit on Android requires `<meta-data name="com.google.mlkit.vision.DEPENDENCIES" value="face" />` in AndroidManifest.xml.

## Flutter demo app

`examples/flutter-demo/` — change `kApiBaseUrl` in `lib/main.dart` to your API URL, then:

```bash
cd examples/flutter-demo
flutter pub get
flutter run
```

## Running the TypeScript packages

```bash
pnpm install
pnpm build        # builds core → web (in dependency order via Turborepo)
pnpm typecheck
```
