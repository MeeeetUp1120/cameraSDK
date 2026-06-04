# meeeetup-cam SDK

Face-capture SDK for the Meeeetup check-in system. Detects faces from a live camera feed, scores quality (frontalness), and sends the best images to the Meeeetup API for recognition via AWS Rekognition.

## Packages

| Package | Platform | Description |
|---|---|---|
| [`@meeeetup-cam/core`](./core.md) | Any | Platform-agnostic tracking, scoring, API client |
| [`@meeeetup-cam/web`](./web.md) | Browser | MediaPipe BlazeFace + React hooks |
| [`@meeeetup-cam/react-native`](./react-native.md) | iOS / Android | Vision Camera + ML Kit |
| [`meeeetup_cam`](./flutter.md) | iOS / Android | Flutter widgets + ML Kit |

## How it works

```
Camera feed
    │
    ▼
Face detector  (MediaPipe / ML Kit / TFLite)
    │  Detection[] — normalised bounding box + keypoints
    ▼
Face tracker   (centroid matching, per-track quality scoring)
    │  best frame per face (highest frontalness)
    ▼
Batch buffer
    │  every 10s (passive) or on trigger (interactive)
    ▼
POST /camera/capture  →  AWS Rekognition  →  person matched
```

## Camera modes

| Mode | Description |
|---|---|
| `passive` | Continuous background capture. Faces auto-sent in batches. |
| `interactive` | User-triggered single capture (kiosk / check-in). |

## Quick links

- [Getting started — Flutter](./flutter.md#getting-started)
- [Getting started — Web](./web.md#getting-started)
- [Getting started — React Native](./react-native.md#getting-started)
- [API reference](./api-reference.md)
- [Architecture](./architecture.md)
