import { useEffect, useRef, useState, useCallback } from "react";
import { FaceCaptureSession, type FaceCaptureSessionOptions, type SelectedFace } from "@meeeetup-cam/core";
import { RNFrameBuffer } from "./frame-buffer";
import { detectFacesMLKit } from "./detectors/mlkit-detector";

export interface UseMeeeetupCameraRNOptions
  extends Omit<FaceCaptureSessionOptions, "sessionType"> {
  sessionType: "interactive" | "passive";
  /**
   * Interval at which to grab a camera snapshot for detection (ms).
   * Lower = more responsive but heavier CPU.  Default: 200ms (~5 fps detection).
   */
  detectionIntervalMs?: number;
}

export interface UseMeeeetupCameraRNReturn {
  ready: boolean;
  error: string | null;
  trackedCount: number;
  selectedFaces: SelectedFace[];
  flushBatch: () => Promise<void>;
  /**
   * Callback ref to attach to a Vision Camera <Camera> component.
   * Returns a function that receives { path, width, height } from onSnapshot.
   */
  onSnapshot: (snapshot: { path: string; width: number; height: number }) => void;
}

/**
 * Core React Native hook — handles face detection, tracking, and API sends.
 *
 * Wire the `onSnapshot` callback to Vision Camera's `onCapture` or use
 * a frame processor that extracts JPEG snapshots at the desired rate.
 *
 * @example
 * ```tsx
 * const { onSnapshot, trackedCount } = useMeeeetupCamera({ ... });
 *
 * <Camera
 *   ref={cameraRef}
 *   photo
 *   frameProcessorFps={5}
 *   onCapture={(file) => onSnapshot({ path: file.path, width: 1280, height: 720 })}
 * />
 * ```
 */
export function useMeeeetupCamera(
  opts: UseMeeeetupCameraRNOptions,
): UseMeeeetupCameraRNReturn {
  const [ready,         setReady]         = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [trackedCount,  setTrackedCount]  = useState(0);
  const [selectedFaces, setSelectedFaces] = useState<SelectedFace[]>([]);

  const optsRef    = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const sessionRef = useRef<FaceCaptureSession | null>(null);

  useEffect(() => {
    const session = new FaceCaptureSession({
      ...opts,
      onSelect: (face) => {
        setSelectedFaces((prev) => {
          const idx = prev.findIndex((f) => f.trackId === face.trackId);
          if (idx !== -1) { const next = [...prev]; next[idx] = face; return next; }
          return [face, ...prev];
        });
        optsRef.current.onSelect?.(face);
      },
      onTrackRemoved: (id) => {
        optsRef.current.onTrackRemoved?.(id);
      },
      onSessionExpired: () => optsRef.current.onSessionExpired?.(),
      onCameraNotFound: () => optsRef.current.onCameraNotFound?.(),
    });
    sessionRef.current = session;
    setReady(true);

    // Flush stale tracks on a timer
    const tickInterval = setInterval(() => {
      session.tick();
      setTrackedCount(session.trackedCount);
    }, 100);

    return () => {
      clearInterval(tickInterval);
      session.dispose();
      sessionRef.current = null;
      setReady(false);
      setTrackedCount(0);
      setSelectedFaces([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.token, opts.apiBaseUrl]);

  const onSnapshot = useCallback(
    async (snapshot: { path: string; width: number; height: number }) => {
      const session = sessionRef.current;
      if (!session) return;

      try {
        const detections = await detectFacesMLKit(
          snapshot.path,
          snapshot.width,
          snapshot.height,
        );

        // RN: path is a file:// URI — read as base64 for the FrameBuffer
        // In a real app you'd use react-native-fs or expo-file-system
        const RNFS = require("react-native-fs");
        const base64 = await RNFS.readFile(snapshot.path, "base64") as string;
        const frame = new RNFrameBuffer(
          `data:image/jpeg;base64,${base64}`,
          snapshot.width,
          snapshot.height,
        );
        session.processDetections(detections, frame);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Detection failed");
      }
    },
    [],
  );

  const flushBatch = useCallback(async () => {
    await sessionRef.current?.flushBatch();
  }, []);

  return { ready, error, trackedCount, selectedFaces, flushBatch, onSnapshot };
}
