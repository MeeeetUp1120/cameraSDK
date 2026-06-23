import { useEffect, useRef, useState } from "react";
import { FaceCaptureSession, type FaceCaptureSessionOptions, type SelectedFace, type TrackedFace, type LiveFacePreview } from "@meeeetup-cam/core";
import { MediapipeDetector } from "../detectors/mediapipe-detector";
import { CameraLoop } from "../camera-loop";
import { drawOverlay } from "../overlay";

export interface UsePassiveCameraOptions
  extends Omit<FaceCaptureSessionOptions, "sessionType"> {
  sessionType: "interactive" | "passive";
  /** Camera device ID from enumerateDevices. Defaults to front-facing cam. */
  deviceId?: string;
  /** Facing mode used when no deviceId is given. Default: "user" (front). */
  facingMode?: "user" | "environment";
  /**
   * Override the MediaPipe WASM CDN URL (e.g. to self-host).
   * Defaults to jsDelivr CDN.
   */
  mediapipeWasmUrl?: string;
}

export interface UsePassiveCameraReturn {
  /** Attach to the <video> element. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  error: string | null;
  /** Number of faces currently being tracked. */
  trackedCount: number;
  /** Best-quality face images buffered and awaiting send. */
  selectedFaces: SelectedFace[];
  /** Immediately flush the batch buffer to the API. */
  flushBatch: () => Promise<void>;
  /** True once the server returns 401 — react with useEffect to handle sign-out. */
  sessionExpired: boolean;
  /** True once the camera/session is not found (404) — react with useEffect to handle sign-out. */
  cameraNotFound: boolean;
  /** Number of unique faces quality-selected at least once this session. */
  totalCount: number;
  /**
   * Live face previews — one entry per face currently visible on screen.
   * Each entry appears ~300ms after the face is first detected and its
   * dataUrl updates in real time as frontalness improves.
   * Entries disappear when the track goes stale (face leaves frame).
   */
  livePreviews: LiveFacePreview[];
}

export function usePassiveCamera(opts: UsePassiveCameraOptions): UsePassiveCameraReturn {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [ready,          setReady]          = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [trackedCount,   setTrackedCount]   = useState(0);
  const [selectedFaces,  setSelectedFaces]  = useState<SelectedFace[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [cameraNotFound, setCameraNotFound] = useState(false);
  const [totalCount,     setTotalCount]     = useState(0);
  const [livePreviews,   setLivePreviews]   = useState<LiveFacePreview[]>([]);
  const seenTrackIdsRef     = useRef<Set<string>>(new Set());
  // Track last-seen pendingJpeg per trackId so we only setState when something changed
  const liveSnapshotRef     = useRef<Map<string, string>>(new Map());

  // Keep stable refs to avoid stale closures in the animation loop
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  const sessionRef = useRef<FaceCaptureSession | null>(null);

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
            if (!seenTrackIdsRef.current.has(face.trackId)) {
              seenTrackIdsRef.current.add(face.trackId);
              setTotalCount((c) => c + 1);
            }
            optsRef.current.onSelect?.(face);
          },
          onBatchSent: (count) => {
            const cutoff = Date.now() - 5_000;
            setSelectedFaces((prev) => prev.filter((f) => f.createdAt >= cutoff));
            optsRef.current.onBatchSent?.(count);
          },
          onSessionExpired: () => {
            setSessionExpired(true);
            optsRef.current.onSessionExpired?.();
          },
          onCameraNotFound: () => {
            setCameraNotFound(true);
            optsRef.current.onCameraNotFound?.();
          },
          onTrackRemoved: (id) => {
            optsRef.current.onTrackRemoved?.(id);
          },
          onBatchError: (err) => {
            console.error("[usePassiveCamera] batch send failed:", err);
            optsRef.current.onBatchError?.(err);
          },
        });
        sessionRef.current = session;

        loop = new CameraLoop(video, detector, {
          onFrame: (detections, frame) => {
            session.processDetections(detections, frame);
            setTrackedCount(session.trackedCount);

            // Diff active track previews — only setState when something changed.
            // No age filter here — live previews show immediately.
            // The 5s filter only applies to batch send, not display.
            const tracks = session.activeTracks;
            let changed = false;
            const snap = new Map<string, string>();
            for (const t of tracks) {
              if (t.pendingJpeg) {
                snap.set(t.id, t.pendingJpeg);
                if (liveSnapshotRef.current.get(t.id) !== t.pendingJpeg) changed = true;
              }
            }
            if (snap.size !== liveSnapshotRef.current.size) changed = true;
            if (changed) {
              liveSnapshotRef.current = snap;
              setLivePreviews(
                tracks
                  .filter((t) => t.pendingJpeg)
                  .map((t) => ({
                    trackId: t.id,
                    dataUrl: t.pendingJpeg!,
                    frontalness: Math.round(t.smoothedFrontalness),
                  })),
              );
            }
          },
          onTick: () => {
            session.tick();
            if (overlay && loop?.offscreenCanvas) {
              drawOverlay(overlay, loop.offscreenCanvas, session.activeTracks as TrackedFace[]);
            }
          },
        });

        await loop.start(optsRef.current.deviceId, optsRef.current.facingMode ?? "user");
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
      setLivePreviews([]);
      setSessionExpired(false);
      setCameraNotFound(false);
      setTotalCount(0);
      seenTrackIdsRef.current.clear();
      liveSnapshotRef.current.clear();
    };
  // Restart when deviceId or facingMode changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.deviceId, opts.facingMode]);

  const flushBatch = async () => { await sessionRef.current?.flushBatch(); };

  return { videoRef, overlayRef, ready, error, trackedCount, selectedFaces, flushBatch, sessionExpired, cameraNotFound, totalCount, livePreviews };
}
