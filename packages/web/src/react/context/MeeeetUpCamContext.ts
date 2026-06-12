import { createContext } from "react";
import type { SelectedFace, LiveFacePreview, PersonResult } from "@meeeetup-cam/core";

export type CameraMode = "passive" | "interactive";

// ── Shared (both modes) ────────────────────────────────────────────────────────

interface SharedState {
  mode: CameraMode;
  ready: boolean;
  error: string | null;
  sessionExpired: boolean;
  cameraNotFound: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  devices: MediaDeviceInfo[];
  currentDeviceId: string | undefined;
  setDeviceId: (id: string | undefined) => void;
  currentFacingMode: "user" | "environment";
  toggleCamera: () => void;
}

// ── Passive ────────────────────────────────────────────────────────────────────

export interface PassiveState extends SharedState {
  mode: "passive";
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  trackedCount: number;
  totalCount: number;
  selectedFaces: SelectedFace[];
  livePreviews: LiveFacePreview[];
  flushBatch: () => Promise<void>;
}

// ── Interactive ────────────────────────────────────────────────────────────────

export interface InteractiveState extends SharedState {
  mode: "interactive";
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoStream: MediaStream | null;
  isLoading: boolean;
  isCapturing: boolean;
  isSwitchingCamera: boolean;
  isFlipped: boolean;
  isFaceAligned: boolean;
  captureProgress: number;
  alignmentCountdown: number | null;
  faceBoundingBox: { originX: number; originY: number; width: number; height: number } | null;
  captureImage: () => void;
  toggleFlip: () => void;
  lastResult: PersonResult[] | null;
}

// ── Union ──────────────────────────────────────────────────────────────────────

export type MeeeetUpCamContextValue = PassiveState | InteractiveState;

export const MeeeetUpCamContext = createContext<MeeeetUpCamContextValue | null>(null);
