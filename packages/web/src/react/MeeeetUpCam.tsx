import { useCallback, useMemo } from "react";
import { sessionFromToken, ApiClient } from "@meeeetup-cam/core";
import type { SelectedFace, PersonResult } from "@meeeetup-cam/core";
import { PassiveCameraView, type PassiveCameraViewProps } from "./PassiveCameraView";
import { InteractiveCameraView } from "./InteractiveCameraView";

export type { PersonResult };

type PassiveSettings = Omit<PassiveCameraViewProps, "apiBaseUrl" | "token" | "className">;

export interface MeeeetUpCamProps {
  apiBaseUrl: string;
  token: string;
  /** CSS class applied to the outer wrapper. */
  className?: string;

  // ── Passive-specific ──────────────────────────────────────────────────────
  passive?: PassiveSettings;

  // ── Interactive-specific ──────────────────────────────────────────────────
  /** Called with recognised persons after capture + API round-trip. */
  onResult?: (persons: PersonResult[]) => void;
  devFaces?: string[];
  alignmentCaptureDelayMs?: number;

  // ── Shared ────────────────────────────────────────────────────────────────
  onSessionExpired?: () => void;
  onCameraNotFound?: () => void;
}

export function MeeeetUpCam({
  apiBaseUrl,
  token,
  className,
  passive,
  onResult,
  devFaces,
  alignmentCaptureDelayMs,
  onSessionExpired,
  onCameraNotFound,
}: MeeeetUpCamProps) {
  const { type } = sessionFromToken(token);

  // Hooks must be called unconditionally before any conditional return
  const client = useMemo(() => new ApiClient(apiBaseUrl, token), [apiBaseUrl, token]);
  const handleCapture = useCallback(async (dataUrl: string) => {
    if (!dataUrl) return;
    try {
      const { persons } = await client.capture([dataUrl]);
      onResult?.(persons);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) onSessionExpired?.();
      else if (status === 404) onCameraNotFound?.();
    }
  }, [client, onResult, onSessionExpired, onCameraNotFound]);

  if (type === "passive") {
    return (
      <PassiveCameraView
        {...passive}
        apiBaseUrl={apiBaseUrl}
        token={token}
        className={className}
        onSessionExpired={onSessionExpired}
        onCameraNotFound={onCameraNotFound}
      />
    );
  }

  return (
    <InteractiveCameraView
      onCapture={handleCapture}
      devFaces={devFaces}
      alignmentCaptureDelayMs={alignmentCaptureDelayMs}
    />
  );
}
