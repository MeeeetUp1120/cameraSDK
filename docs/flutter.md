# meeeetup_cam — Flutter SDK

Dart package for passive and interactive face capture on Android and iOS.

## Installation

In your `pubspec.yaml`:

```yaml
dependencies:
  meeeetup_cam:
    git:
      url: https://github.com/hheinsoee/cameraSDK.git
      path: packages/flutter
```

Or local path during development:

```yaml
dependencies:
  meeeetup_cam:
    path: ../cameraSDK/packages/flutter
```

Then:

```bash
flutter pub get
```

## Permissions

### Android

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />

<!-- Required for ML Kit face model download -->
<meta-data
    android:name="com.google.mlkit.vision.DEPENDENCIES"
    android:value="face" />
```

### iOS

`ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Used for face detection and check-in.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Required by the camera framework.</string>
```

## Getting started

### 1. Connect via OTP

```dart
import 'package:meeeetup_cam/meeeetup_cam.dart';

ConnectWidget(
  apiBaseUrl: 'https://api.example.com',
  onConnected: (session) {
    // session.token, session.type ('passive' | 'interactive')
    Navigator.pushReplacement(context, MaterialPageRoute(
      builder: (_) => CameraScreen(session: session),
    ));
  },
)
```

### 2. Passive continuous capture

```dart
MeeeetupCameraWidget(
  apiBaseUrl:       'https://api.example.com',
  token:            session.token,
  sessionType:      'passive',
  onSelect:         (face) => print('Face: ${face.frontalness}%'),
  onSessionExpired: () => Navigator.pushNamed(context, '/connect'),
)
```

### 3. Interactive (manual trigger)

Use `FaceCaptureSession` directly and call `flushBatch()` on button press:

```dart
final captureSession = FaceCaptureSession(
  apiBaseUrl:  'https://api.example.com',
  token:       session.token,
  sessionType: 'interactive',
  onSelect:    (face) => setState(() => _face = face),
);

// On capture button press:
await captureSession.flushBatch();
```

## Widgets

### `MeeeetupCameraWidget`

All-in-one camera widget. Handles camera init, ML Kit detection, tracking, and API sends.

```dart
MeeeetupCameraWidget({
  required String apiBaseUrl,
  required String token,
  required String sessionType,       // 'passive' | 'interactive'
  int    batchIntervalSeconds = 10,  // passive mode send interval
  bool   showCounter = true,         // live face count badge
  void Function(SelectedFace)?  onSelect,
  void Function()?              onSessionExpired,
  void Function()?              onCameraNotFound,
})
```

### `ConnectWidget`

OTP entry form. Calls `POST /camera/connect` and returns a `CameraSession`.

```dart
ConnectWidget({
  required String apiBaseUrl,
  required void Function(CameraSession) onConnected,
  void Function(Object)? onError,
  String? initialOtp,   // pre-fill from QR code / deep link
})
```

## Session helpers

```dart
// Load saved session from SharedPreferences
final session = await loadSession();   // → CameraSession?

// Save after connect
await saveSession(session);

// Clear on logout / disconnect
await clearSession();
```

## Types

```dart
class CameraSession {
  final String token;
  final String projectId;
  final String cameraId;
  final String cameraName;
  final String type;  // 'passive' | 'interactive'
}

class SelectedFace {
  final String   trackId;
  final String   dataUrl;      // base64 JPEG data URI
  final double   frontalness;  // 0–100
  final DateTime lastSentAt;
}
```

## Advanced — custom detector

Swap ML Kit for TFLite by implementing `FrameBuffer` and calling `FaceCaptureSession.processDetections()` directly:

```dart
final session = FaceCaptureSession(
  apiBaseUrl:  'https://api.example.com',
  token:       token,
  sessionType: 'passive',
  onSelect:    (face) { ... },
);

// Feed your own detections each frame:
session.processDetections(myDetections, myFrameBuffer);
```

See [`tflite_detector.dart`](../packages/flutter/lib/src/tflite_detector.dart) for the TFLite stub.

## Face quality scoring

Frontalness is scored 0–100 based on:

| Metric | Weight | What it measures |
|---|---|---|
| Eye span | 50% | How far apart the eyes are (profile = low) |
| Nose symmetry | 30% | How centred the nose is between the eyes |
| Vertical tilt | 20% | Whether the face is tilted up or down |

Only frames with frontalness ≥ 40 are sent to the API.
