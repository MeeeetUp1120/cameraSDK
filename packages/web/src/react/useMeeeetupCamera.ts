import { useEffect, useRef, useState } from "react";
import { FaceCaptureSession, type FaceCaptureSessionOptions, type SelectedFace, type TrackedFace } from "@meeeetup-cam/core";
import { MediapipeDetector } from "../detectors/mediapipe-detector";
import { CameraLoop } from "../camera-loop";
import { drawOverlay } from "../overlay";

export interface UseMeeeetupCameraOptions
  extends Omit<FaceCaptureSessionOptions, "sessionType"> {
  sessionType: "interactive" | "passive";
  /** Camera device ID from enumerateDevices. Defaults to front-facing cam. */
  deviceId?: string;
  /**
   * Override the MediaPipe WASM CDN URL (e.g. to self-host).
   * Defaults to jsDelivr CDN.
   */
  mediapipeWasmUrl?: string;
}

export interface UseMeeeetupCameraReturn {
  /** Attach to the <video> element. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Attach to the overlay <canvas> (position:absolute over the video). */
  overlayRef: React.RefObject<HTMLCanvasElement>;
  ready: boolean;
  error: string | null;
  /** Number of faces currently being tracked. */
  trackedCount: number;
  /** Best-quality face images buffered and awaiting send. */
  selectedFaces: SelectedFace[];
  /** Immediately flush the batch buffer to the API. */
  flushBatch: () => Promise<void>;
}

export function useMeeeetupCamera(opts: UseMeeeetupCameraOptions): UseMeeeetupCameraReturn {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [ready,         setReady]         = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [trackedCount,  setTrackedCount]  = useState(0);
  const [selectedFaces, setSelectedFaces] = useState<SelectedFace[]>([]);

  // Keep stable refs to avoid stale closures in the animation loop
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const sessionRef = useRef<FaceCaptureSession | null>(null);
  const tracksRef  = useRef<TrackedFace[]>([]);

  useEffect(() => {
    let loop:     CameraLoop | null    = null;
    let detector: MediapipeDetector | null = null;

    async function start() {
      try {
        const video   = videoRef.current;
        const overlay = overlayRef.current;
        if (!video || !overlay) return;

        detector = await MediapipeDetector.create({
          wasmUrl: optsRef.current.mediapipeWasmUrl,
        });

        const session = new FaceCaptureSession({
          ...optsRef.current,
          onSelect: (face) => {
            setSelectedFaces((prev) => {
              const idx = prev.findIndex((f) => f.trackId === face.trackId);
              if (idx !== -1) { const next = [...prev]; next[idx] = face; return next; }
              return [face, ...prev];
            });
            optsRef.current.onSelect?.(face);
          },
          onTrackRemoved: (id) => {
            tracksRef.current = tracksRef.current.filter((t) => t.id !== id);
            optsRef.current.onTrackRemoved?.(id);
          },
        });
        sessionRef.current = session;

        loop = new CameraLoop(video, detector, {
          onFrame: (detections, frame) => {
            session.processDetections(detections, frame);
            // Sync tracked count for rendering
            setTrackedCount(session.trackedCount);
          },
          onTick: () => {
            session.tick();
            if (overlay && video) {
              // We need the offscreen canvas — expose it via the loop
              // For overlay drawing we pass a minimal set of track display data
            }
          },
        });

        await loop.start(optsRef.current.deviceId);
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Camera failed to start");
      }
    }

    void start();

    return () => {
      loop?.stop();
      detector?.dispose();
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setReady(false);
      setTrackedCount(0);
      setSelectedFaces([]);
    };
  // Only restart when deviceId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.deviceId]);

  const flushBatch = async () => { await sessionRef.current?.flushBatch(); };

  return { videoRef, overlayRef, ready, error, trackedCount, selectedFaces, flushBatch };
}
