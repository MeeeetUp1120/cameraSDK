# @meeeetup-cam/web — Web SDK

Browser SDK using MediaPipe BlazeFace for face detection and React hooks for UI integration.

## Installation

```bash
npm i @meeeetup-cam/web @meeeetup-cam/core
# or
pnpm add @meeeetup-cam/web @meeeetup-cam/core
```

## Getting started

### Drop-in React component

```tsx
import { MeeeetupCameraView } from '@meeeetup-cam/web';

<MeeeetupCameraView
  apiBaseUrl="https://api.example.com"
  token={session.token}
  sessionType="passive"
  onSelect={(face) => console.log(face)}
  onSessionExpired={() => navigate('/connect')}
/>
```

### OTP connect hook

```tsx
import { useConnect } from '@meeeetup-cam/web';

function ConnectPage() {
  const { connect, connecting, error } = useConnect({ apiBaseUrl: 'https://api.example.com' });

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const session = await connect('ABC123');
      localStorage.setItem('session', JSON.stringify(session));
    }}>
      <input maxLength={6} placeholder="ABC123" />
      <button disabled={connecting}>Connect</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### Hook — full control

```tsx
import { useMeeeetupCamera, useCameraDevices } from '@meeeetup-cam/web';

function CameraPage({ session }) {
  const { devices } = useCameraDevices();
  const { videoRef, overlayRef, ready, trackedCount, selectedFaces, flushBatch } =
    useMeeeetupCamera({
      apiBaseUrl:   'https://api.example.com',
      token:        session.token,
      sessionType:  'passive',
      onSessionExpired: () => navigate('/connect'),
    });

  return (
    <div style={{ position: 'relative' }}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0 }} />
      <p>{trackedCount} faces detected</p>
    </div>
  );
}
```

## Detectors

### MediaPipe (default)

No extra install needed — WASM loaded from CDN at runtime.

```ts
import { MediapipeDetector } from '@meeeetup-cam/web';

const detector = await MediapipeDetector.create();
// optional: self-host WASM
const detector = await MediapipeDetector.create({ wasmUrl: '/assets/mediapipe/wasm' });
```

### TensorFlow.js (alternative)

```bash
npm i @tensorflow/tfjs @tensorflow-models/blazeface
```

```ts
import { TensorFlowDetector } from '@meeeetup-cam/web';

const detector = await TensorFlowDetector.create();
```

Drop it into a custom `CameraLoop` in place of the MediaPipe detector — same `Detection[]` output.

## Camera device selection

```tsx
import { useCameraDevices } from '@meeeetup-cam/web';

const { devices, permissionGranted } = useCameraDevices();

// Pass a deviceId to useMeeeetupCamera to switch cameras
<select onChange={(e) => setDeviceId(e.target.value)}>
  {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
</select>
```

## API reference

### `useMeeeetupCamera(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiBaseUrl` | `string` | required | API base URL |
| `token` | `string` | required | JWT from `/camera/connect` |
| `sessionType` | `'passive' \| 'interactive'` | required | Camera mode |
| `deviceId` | `string` | front camera | Camera device ID |
| `mediapipeWasmUrl` | `string` | jsDelivr CDN | Self-host WASM |
| `batchIntervalMs` | `number` | `10000` | Passive send interval |
| `onSelect` | `(face: SelectedFace) => void` | — | Called on new best face |
| `onSessionExpired` | `() => void` | — | Called on 401 |
| `onCameraNotFound` | `() => void` | — | Called on 404 |

Returns: `{ videoRef, overlayRef, ready, error, trackedCount, selectedFaces, flushBatch }`
