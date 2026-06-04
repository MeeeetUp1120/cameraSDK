# @meeeetup-cam/react-native — React Native SDK

React Native SDK using Vision Camera + ML Kit for face detection.

## Installation

```bash
npm i @meeeetup-cam/react-native @meeeetup-cam/core
npm i react-native-vision-camera @react-native-ml-kit/face-detection
npm i @react-native-async-storage/async-storage
```

For Expo:

```bash
npx expo install react-native-vision-camera @react-native-ml-kit/face-detection
npx expo install @react-native-async-storage/async-storage
```

## Permissions

### Android — `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

### iOS — `Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>Used for face detection and check-in.</string>
```

## Getting started

### Connect screen

```tsx
import { ConnectScreen } from '@meeeetup-cam/react-native';

<ConnectScreen
  apiBaseUrl="https://api.example.com"
  onConnected={(session) => navigation.replace('Camera', { session })}
/>
```

### Passive camera view

```tsx
import { MeeeetupCameraView } from '@meeeetup-cam/react-native';
import { useCameraDevice } from 'react-native-vision-camera';

function CameraScreen({ session }) {
  const device = useCameraDevice('front');

  return (
    <MeeeetupCameraView
      device={device}
      apiBaseUrl="https://api.example.com"
      token={session.token}
      sessionType="passive"
      style={{ flex: 1 }}
      onSelect={(face) => console.log(face.frontalness)}
      onSessionExpired={() => navigation.replace('Connect')}
    />
  );
}
```

### Hook — custom UI

```tsx
import { useMeeeetupCamera } from '@meeeetup-cam/react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

function CameraScreen({ session }) {
  const device = useCameraDevice('front');
  const { onSnapshot, trackedCount, selectedFaces } = useMeeeetupCamera({
    apiBaseUrl:  'https://api.example.com',
    token:       session.token,
    sessionType: 'passive',
  });

  return (
    <Camera
      device={device}
      isActive
      photo
      onCapture={(file) => onSnapshot({ path: file.path, width: 1280, height: 720 })}
    />
  );
}
```

## Session helpers

```ts
import { loadSession, saveSession, clearSession } from '@meeeetup-cam/react-native';

const session = await loadSession();   // → CameraSession | null
await saveSession(session);
await clearSession();
```

## Detectors

### ML Kit (default)

Bundled via `@react-native-ml-kit/face-detection`. Runs fully on-device, no network required.

### TensorFlow.js (alternative)

```bash
npm i @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow-models/blazeface
```

```ts
import { TFBlazeFaceDetector } from '@meeeetup-cam/react-native';

const detector = await TFBlazeFaceDetector.create();
const detections = await detector.detect(base64Jpeg, width, height);
```

## API reference

### `MeeeetupCameraViewProps`

| Prop | Type | Default | Description |
|---|---|---|---|
| `device` | `CameraDevice` | required | From `useCameraDevice()` |
| `apiBaseUrl` | `string` | required | API base URL |
| `token` | `string` | required | JWT from `/camera/connect` |
| `sessionType` | `'passive' \| 'interactive'` | required | Camera mode |
| `batchIntervalMs` | `number` | `10000` | Passive send interval |
| `showCounter` | `boolean` | `true` | Face count badge |
| `onSelect` | `(face: SelectedFace) => void` | — | New best face selected |
| `onSessionExpired` | `() => void` | — | 401 from API |
| `onCameraNotFound` | `() => void` | — | 404 from API |
