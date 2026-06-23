import { useCallback, useMemo, useState } from "react";
import { sessionFromToken, ApiClient } from "@meeeetup1120/core";
import type { PersonResult } from "@meeeetup1120/core";
import { usePassiveCamera } from "../usePassiveCamera";
import { useInteractiveCamera } from "../useInteractiveCamera";
import { useCameraDevices } from "../useCameraDevices";
import { MeeeetUpCamContext, type PassiveState, type InteractiveState } from "./MeeeetUpCamContext";

const DEVICE_STORAGE_KEY = "meeeetup-cam:deviceId";

// ── Public props ────────────────────────────────────────────────────────────────

export interface MeeeetUpCamProviderProps {
  apiBaseUrl: string;
  token: string;
  children: React.ReactNode;
  /** Override the MediaPipe WASM CDN URL (passive mode). */
  mediapipeWasmUrl?: string;
  /** How long face must stay aligned before auto-capture (interactive mode, ms). Default: 2000 */
  alignmentCaptureDelayMs?: number;
  /** Dev face URLs for quick testing in interactive mode. */
  devFaces?: string[];
}

// ── Provider (entry point) ──────────────────────────────────────────────────────

export function MeeeetUpCamProvider({ token, ...rest }: MeeeetUpCamProviderProps) {
  const { type } = sessionFromToken(token);
  return type === "passive"
    ? <PassiveProvider token={token} {...rest} />
    : <InteractiveProvider token={token} {...rest} />;
}

// ── Passive inner provider ──────────────────────────────────────────────────────

function PassiveProvider({
  apiBaseUrl,
  token,
  children,
  mediapipeWasmUrl,
}: MeeeetUpCamProviderProps) {
  const { devices } = useCameraDevices();
  const [savedDeviceId, setSavedDeviceId] = useState<string | undefined>(
    () => {
      try { return localStorage.getItem(DEVICE_STORAGE_KEY) ?? undefined; }
      catch { return undefined; }
    },
  );
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const cam = usePassiveCamera({
    apiBaseUrl,
    token,
    sessionType: "passive",
    deviceId: savedDeviceId,
    facingMode,
    mediapipeWasmUrl,
  });

  const toggleCamera = useCallback(() => {
    setFacingMode((m) => m === "user" ? "environment" : "user");
  }, []);

  const setDeviceId = useCallback((id: string | undefined) => {
    setSavedDeviceId(id);
    try {
      if (id) localStorage.setItem(DEVICE_STORAGE_KEY, id);
      else localStorage.removeItem(DEVICE_STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  const value: PassiveState = {
    mode: "passive",
    ready: cam.ready,
    error: cam.error,
    sessionExpired: cam.sessionExpired,
    cameraNotFound: cam.cameraNotFound,
    videoRef: cam.videoRef,
    overlayRef: cam.overlayRef,
    devices,
    currentDeviceId: savedDeviceId,
    setDeviceId,
    currentFacingMode: facingMode,
    toggleCamera,
    trackedCount: cam.trackedCount,
    totalCount: cam.totalCount,
    selectedFaces: cam.selectedFaces,
    livePreviews: cam.livePreviews,
    flushBatch: cam.flushBatch,
  };

  return (
    <MeeeetUpCamContext.Provider value={value}>
      {children}
    </MeeeetUpCamContext.Provider>
  );
}

// ── Interactive inner provider ──────────────────────────────────────────────────

function InteractiveProvider({
  apiBaseUrl,
  token,
  children,
  alignmentCaptureDelayMs = 2000,
}: MeeeetUpCamProviderProps) {
  const { devices } = useCameraDevices();
  const [lastResult, setLastResult] = useState<PersonResult[] | null>(null);

  const client = useMemo(() => new ApiClient(apiBaseUrl, token), [apiBaseUrl, token]);

  const handleCapture = useCallback(async (faceImage: string, _fullCircleImage: string) => {
    if (!faceImage) return;
    try {
      const { persons } = await client.capture([{ dataUrl: faceImage, capturedAt: Date.now() }]);
      setLastResult(persons);
    } catch {
      // errors are surfaced via sessionExpired / cameraNotFound
    }
  }, [client]);

  const cam = useInteractiveCamera({
    onCapture: handleCapture,
    autoCapture: true,
    alignmentCaptureDelayMs,
    alignmentBoxSizeRatio: 1,
  });

  const value: InteractiveState = {
    mode: "interactive",
    ready: !cam.isLoading && !cam.error,
    error: cam.error,
    sessionExpired: false,
    cameraNotFound: false,
    videoRef: cam.videoRef,
    canvasRef: cam.canvasRef,
    videoStream: cam.videoStream,
    devices,
    currentDeviceId: undefined,
    setDeviceId: () => {},
    currentFacingMode: cam.currentFacingMode,
    toggleCamera: cam.toggleCamera,
    isLoading: cam.isLoading,
    isCapturing: cam.isCapturing,
    isSwitchingCamera: cam.isSwitchingCamera,
    isFlipped: cam.isFlipped,
    isFaceAligned: cam.isFaceAligned,
    captureProgress: cam.captureProgress,
    alignmentCountdown: cam.alignmentCountdown,
    faceBoundingBox: cam.faceBoundingBox,
    captureImage: cam.captureImage,
    toggleFlip: cam.toggleFlip,
    lastResult,
  };

  return (
    <MeeeetUpCamContext.Provider value={value}>
      {children}
    </MeeeetUpCamContext.Provider>
  );
}
