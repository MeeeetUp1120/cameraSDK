import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaceDetector, FilesetResolver, type FaceDetectorResult } from "@mediapipe/tasks-vision";
import { compressImage, blobToBase64 } from "../utils/compress-image";
import { findPhysicalCameraId } from "../utils/camera-devices";

export interface UseInteractiveCameraOptions {
  /** Called with (faceCropBase64, fullCircleBase64) after a successful capture. */
  onCapture?: (faceImage: string, fullCircleImage: string) => void;
  facingMode?: "user" | "environment";
  autoCapture?: boolean;
  minDetectionConfidence?: number;
  alignmentBoxSizeRatio?: number;
  /** How long the face must stay aligned before auto-capture fires (ms). Default: 2000 */
  alignmentCaptureDelayMs?: number;
}

export interface UseInteractiveCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  capturedImage: string | null;
  error: string | null;
  isLoading: boolean;
  isCapturing: boolean;
  isSwitchingCamera: boolean;
  currentFacingMode: "user" | "environment";
  isFlipped: boolean;
  isFaceAligned: boolean;
  captureProgress: number;
  alignmentCountdown: number | null;
  videoStream: MediaStream | null;
  faceBoundingBox: { originX: number; originY: number; width: number; height: number } | null;
  captureImage: () => void;
  resetCapture: () => void;
  toggleCamera: () => void;
  toggleFlip: () => void;
}

const FACE_CROP_TARGET_SIZE = 256;
const FACE_CROP_MAX_BYTES = 30 * 1024;
const FULL_CIRCLE_TARGET_SIZE = 300;
const FULL_CIRCLE_MAX_BYTES = 35 * 1024;
const CAMERA_SWITCH_DELAY_MS = 300;

/** Wait for a video element to have metadata, then ensure it's playing. */
async function waitForVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < 1 /* HAVE_METADATA */) {
    await new Promise<void>((resolve) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
  }
  // Explicitly start playback (autoPlay may be blocked or may not re-trigger on srcObject change)
  await video.play().catch(() => { /* ignore AbortError / autoplay policy */ });
}
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";
const LOCAL_STORAGE_KEY_FACING_MODE = "meeeetup-cam:facingMode";

let prefetchPromise: Promise<void> | null = null;

/** Warm up the MediaPipe model in the background before the component mounts. */
export function prefetchInteractiveCameraAssets(): Promise<void> {
  if (prefetchPromise) return prefetchPromise;
  if (typeof window === "undefined") return Promise.resolve();
  prefetchPromise = (async () => {
    try {
      await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      await fetch(MODEL_URL, { cache: "force-cache" });
      try {
        const visionFileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const detector = await FaceDetector.createFromModelPath(visionFileset, MODEL_URL);
        await detector.close();
      } catch { /* ignore warm-up errors */ }
    } catch (err) {
      console.debug("[interactive-camera] Prefetch failed", err);
    }
  })();
  return prefetchPromise;
}

export function useInteractiveCamera({
  onCapture,
  facingMode = "user",
  autoCapture = true,
  minDetectionConfidence = 0.9,
  alignmentBoxSizeRatio = 0.3,
  alignmentCaptureDelayMs = 2000,
}: UseInteractiveCameraOptions = {}): UseInteractiveCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceDetectionRef = useRef<FaceDetector | null>(null);
  const detectionRafIdRef = useRef<number | null>(null);
  const toggleCameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransitioningRef = useRef(false);
  const alignmentCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alignmentStartTimeRef = useRef<number | null>(null);
  const faceBoundingBoxRef = useRef<{ originX: number; originY: number; width: number; height: number } | null>(null);
  const previousIsAlignedRef = useRef<boolean>(false);

  const [capturedImage,    setCapturedImage]    = useState<string | null>(null);
  // Ref mirrors capturedImage for use inside long-lived closures (avoids stale state)
  const capturedRef = useRef(false);
  // Refs keep latest values accessible inside long-lived closures (detection loop,
  // toggleCamera setTimeout) without requiring callbacks to be recreated.
  const isFlippedRef = useRef(true);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;   // always current, no effect needed

  const [error,            setError]            = useState<string | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [isCapturing,      setIsCapturing]      = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<"user" | "environment">(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY_FACING_MODE) as "user" | "environment" | null;
      if (stored === "user" || stored === "environment") return stored;
    }
    return facingMode;
  });
  const [isFlipped,         setIsFlipped]         = useState(true);
  isFlippedRef.current = isFlipped;  // keep ref in sync every render
  const [isFaceAligned,     setIsFaceAligned]     = useState(false);
  const [captureProgress,   setCaptureProgress]   = useState(0);
  const [alignmentCountdown, setAlignmentCountdown] = useState<number | null>(null);
  const [videoStream,       setVideoStream]       = useState<MediaStream | null>(null);
  const [faceBoundingBox,   setFaceBoundingBox]   = useState<{ originX: number; originY: number; width: number; height: number } | null>(null);

  const constraints = useMemo(() => ({
    video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
  }), [currentFacingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setVideoStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (detectionRafIdRef.current) { cancelAnimationFrame(detectionRafIdRef.current); detectionRafIdRef.current = null; }
    if (faceDetectionRef.current) { faceDetectionRef.current.close(); faceDetectionRef.current = null; }
  }, []);

  const captureImage = useCallback(async () => {
    const currentFaceBoundingBox = faceBoundingBoxRef.current;
    if (!videoRef.current || !canvasRef.current) return;
    if (detectionRafIdRef.current) { cancelAnimationFrame(detectionRafIdRef.current); detectionRafIdRef.current = null; }
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    setIsCapturing(true);
    const circleSize = Math.min(videoWidth, videoHeight);
    const circleSx = (videoWidth - circleSize) / 2;
    const circleSy = (videoHeight - circleSize) / 2;
    try {
      const flipped = isFlippedRef.current;
      const fullCircleBlob = await compressImage(video, { sx: circleSx, sy: circleSy, sw: circleSize, sh: circleSize, targetSize: FULL_CIRCLE_TARGET_SIZE, maxBytes: FULL_CIRCLE_MAX_BYTES, initialQuality: 0.7, isFlipped: flipped });
      const fullCircleBase64 = await blobToBase64(fullCircleBlob);
      let faceSx: number, faceSy: number, faceSw: number, faceSh: number;
      if (currentFaceBoundingBox) {
        const faceCenterX = currentFaceBoundingBox.originX + currentFaceBoundingBox.width / 2;
        const faceCenterY = currentFaceBoundingBox.originY + currentFaceBoundingBox.height * 0.35;
        const paddedWidth = currentFaceBoundingBox.width * 1.1;
        const paddedHeight = currentFaceBoundingBox.height * 1.3;
        faceSx = Math.max(0, Math.min(faceCenterX - paddedWidth / 2, videoWidth - paddedWidth));
        faceSy = Math.max(0, Math.min(faceCenterY - paddedHeight / 2, videoHeight - paddedHeight));
        faceSw = Math.min(paddedWidth, videoWidth - faceSx);
        faceSh = Math.min(paddedHeight, videoHeight - faceSy);
      } else {
        const size = Math.min(videoWidth, videoHeight);
        faceSx = (videoWidth - size) / 2;
        faceSy = (videoHeight - size) / 2;
        faceSw = size;
        faceSh = size;
      }
      const faceCropBlob = await compressImage(video, { sx: faceSx, sy: faceSy, sw: faceSw, sh: faceSh, targetSize: FACE_CROP_TARGET_SIZE, maxBytes: FACE_CROP_MAX_BYTES, initialQuality: 0.75, isFlipped: flipped });
      const faceCropBase64 = await blobToBase64(faceCropBlob);
      capturedRef.current = true;
      setCapturedImage(faceCropBase64);
      stopCamera();
      onCaptureRef.current?.(faceCropBase64, fullCircleBase64);
    } catch (err) {
      console.error("[interactive-camera] Compression failed", err);
    } finally {
      setIsCapturing(false);
    }
  }, [stopCamera]); // isFlipped + onCapture read via refs — always current

  const resetCapture = useCallback(() => {
    capturedRef.current = false;
    setCapturedImage(null);
    onCaptureRef.current?.("", "");
  }, []);

  const initFaceDetection = useCallback(async () => {
    if (faceDetectionRef.current || !videoRef.current) return;
    const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
    const detector = await FaceDetector.createFromModelPath(fileset, MODEL_URL);
    detector.setOptions({ runningMode: "VIDEO", minDetectionConfidence });
    faceDetectionRef.current = detector;

    const handleDetections = (results: FaceDetectorResult) => {
      if (capturedRef.current || !autoCapture) return;
      const hasFace = results.detections?.length > 0;
      if (!videoRef.current) return;
      if (hasFace) {
        type MP_BB = { originX: number; originY: number; width: number; height: number };
        type Det = { boundingBox?: MP_BB };
        const detections = results.detections as Det[];
        let selectedBBox: MP_BB | null = null;
        let selectedArea = -1;
        for (const det of detections) {
          const b = det.boundingBox;
          if (b && typeof b.originX === "number" && typeof b.originY === "number" && typeof b.width === "number" && typeof b.height === "number") {
            const area = b.width * b.height;
            if (area > selectedArea) { selectedArea = area; selectedBBox = b; }
          }
        }
        if (!selectedBBox) { setFaceBoundingBox(null); return; }
        const videoW = videoRef.current.videoWidth;
        const videoH = videoRef.current.videoHeight;
        faceBoundingBoxRef.current = { originX: selectedBBox.originX, originY: selectedBBox.originY, width: selectedBBox.width, height: selectedBBox.height };
        setFaceBoundingBox(faceBoundingBoxRef.current);
        const displayW = videoRef.current.clientWidth || videoW;
        const displayH = videoRef.current.clientHeight || videoH;
        const videoAspect = videoW / videoH;
        const displayAspect = displayW / displayH;
        let scale = 1, offsetX = 0, offsetY = 0;
        if (videoAspect > displayAspect) { scale = displayH / videoH; offsetX = (displayW - videoW * scale) / 2; }
        else { scale = displayW / videoW; offsetY = (displayH - videoH * scale) / 2; }
        const mapToDisplay = (x: number, y: number) => ({ x: x * scale + offsetX, y: y * scale + offsetY });
        const circleCenterX = displayW / 2;
        const circleCenterY = displayH / 2;
        const circleRadius = (Math.min(displayW, displayH) * alignmentBoxSizeRatio) / 2;
        const corners = [
          { x: selectedBBox.originX, y: selectedBBox.originY },
          { x: selectedBBox.originX + selectedBBox.width, y: selectedBBox.originY },
          { x: selectedBBox.originX, y: selectedBBox.originY + selectedBBox.height },
          { x: selectedBBox.originX + selectedBBox.width, y: selectedBBox.originY + selectedBBox.height },
        ];
        const isAlignedNow = corners.every((corner) => {
          const dp = mapToDisplay(corner.x, corner.y);
          return Math.sqrt((dp.x - circleCenterX) ** 2 + (dp.y - circleCenterY) ** 2) <= circleRadius;
        });
        if (isAlignedNow) {
          if (!alignmentCaptureTimerRef.current) {
            const startTime = Date.now();
            alignmentStartTimeRef.current = startTime;
            alignmentCaptureTimerRef.current = setTimeout(() => {
              alignmentCaptureTimerRef.current = null;
              alignmentStartTimeRef.current = null;
              if (previousIsAlignedRef.current !== true) { previousIsAlignedRef.current = true; setIsFaceAligned(true); }
              if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
              setCaptureProgress(1);
              setAlignmentCountdown(null);
              captureImage();
            }, alignmentCaptureDelayMs);
            progressIntervalRef.current = setInterval(() => {
              if (!alignmentStartTimeRef.current) return;
              const elapsed = Date.now() - alignmentStartTimeRef.current;
              const progress = Math.min(elapsed / alignmentCaptureDelayMs, 1);
              setCaptureProgress(progress);
              const remainingMs = alignmentCaptureDelayMs - elapsed;
              const remainingSeconds = Math.ceil(remainingMs / 1000);
              setAlignmentCountdown(remainingSeconds > 0 ? remainingSeconds : null);
            }, 50);
          }
        } else {
          alignmentStartTimeRef.current = null;
          if (alignmentCaptureTimerRef.current) { clearTimeout(alignmentCaptureTimerRef.current); alignmentCaptureTimerRef.current = null; }
          if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
          setCaptureProgress(0);
          setAlignmentCountdown(null);
          if (previousIsAlignedRef.current !== false) { previousIsAlignedRef.current = false; setIsFaceAligned(false); }
        }
      } else {
        faceBoundingBoxRef.current = null;
        setFaceBoundingBox(null);
        if (previousIsAlignedRef.current !== false) { previousIsAlignedRef.current = false; setIsFaceAligned(false); }
        alignmentStartTimeRef.current = null;
        if (alignmentCaptureTimerRef.current) { clearTimeout(alignmentCaptureTimerRef.current); alignmentCaptureTimerRef.current = null; }
        if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
        setCaptureProgress(0);
        setAlignmentCountdown(null);
      }
    };

    const loop = () => {
      if (!videoRef.current || !faceDetectionRef.current) return;
      const res = faceDetectionRef.current.detectForVideo(videoRef.current, performance.now());
      if (!isTransitioningRef.current) handleDetections(res);
      detectionRafIdRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [captureImage, autoCapture, minDetectionConfidence, alignmentBoxSizeRatio, alignmentCaptureDelayMs]);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const physicalId = await findPhysicalCameraId(currentFacingMode);
      const stream = await navigator.mediaDevices.getUserMedia(
        physicalId ? { video: { deviceId: { exact: physicalId } } } : constraints,
      );
      setVideoStream(stream);
      const settingsFacingMode = stream.getVideoTracks()[0]?.getSettings().facingMode as "user" | "environment" | undefined;
      const resolvedFacingMode = settingsFacingMode === "environment" ? "environment" : "user";
      streamRef.current = stream;
      setCurrentFacingMode(resolvedFacingMode);
      setIsFlipped(resolvedFacingMode === "user");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await waitForVideo(videoRef.current);
        setIsLoading(false);
        setIsSwitchingCamera(false);
        initFaceDetection();
      }
    } catch {
      setError("Could not access camera. Please check permissions.");
      setIsLoading(false);
      setIsSwitchingCamera(false);
    }
  }, [constraints, initFaceDetection]);

  const toggleCamera = useCallback(() => {
    if (isSwitchingCamera || isLoading) return;
    setIsSwitchingCamera(true);
    isTransitioningRef.current = true;
    const nextMode: "user" | "environment" = currentFacingMode === "user" ? "environment" : "user";
    stopCamera();
    if (toggleCameraTimeoutRef.current) clearTimeout(toggleCameraTimeoutRef.current);
    toggleCameraTimeoutRef.current = setTimeout(async () => {
      try {
        const physicalId = await findPhysicalCameraId(nextMode);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: physicalId
            ? { deviceId: { exact: physicalId } }
            : { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setVideoStream(stream);
        const settingsFacingMode = stream.getVideoTracks()[0]?.getSettings().facingMode as "user" | "environment" | undefined;
        const resolvedFacingMode = settingsFacingMode === "environment" ? "environment" : "user";
        streamRef.current = stream;
        setCurrentFacingMode(resolvedFacingMode);
        setIsFlipped(resolvedFacingMode === "user");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await waitForVideo(videoRef.current);
          setIsLoading(false);
          setIsSwitchingCamera(false);
          isTransitioningRef.current = false;
          initFaceDetection();
        }
      } catch {
        setIsSwitchingCamera(false);
        isTransitioningRef.current = false;
        startCamera();
      }
      toggleCameraTimeoutRef.current = null;
    }, CAMERA_SWITCH_DELAY_MS);
  }, [isSwitchingCamera, isLoading, currentFacingMode, stopCamera, initFaceDetection, startCamera]);

  const toggleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    isTransitioningRef.current = true;
    setTimeout(() => { isTransitioningRef.current = false; }, 500);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (toggleCameraTimeoutRef.current) clearTimeout(toggleCameraTimeoutRef.current);
      if (alignmentCaptureTimerRef.current) clearTimeout(alignmentCaptureTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setIsFlipped(currentFacingMode === "user"); }, [currentFacingMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(LOCAL_STORAGE_KEY_FACING_MODE, currentFacingMode); } catch { /* ignore */ }
    }
  }, [currentFacingMode]);

  return { videoRef, canvasRef, capturedImage, error, isLoading, isCapturing, isSwitchingCamera, currentFacingMode, isFlipped, isFaceAligned, captureProgress, alignmentCountdown, videoStream, faceBoundingBox, captureImage, resetCapture, toggleCamera, toggleFlip };
}
