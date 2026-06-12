import { useEffect, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { usePassiveCamera, type UsePassiveCameraOptions } from "./usePassiveCamera";
import { useCameraDevices } from "./useCameraDevices";
import type { SelectedFace, LiveFacePreview } from "@meeeetup-cam/core";

const STORAGE_KEY = "meeeetup-cam:deviceId";

export interface PassiveCameraViewProps extends Omit<UsePassiveCameraOptions, "deviceId" | "sessionType"> {
  /**
   * Pin to a specific camera device. When omitted the component manages
   * device selection internally (persisted to localStorage).
   */
  deviceId?: string;
  /** Additional CSS class for the video box. */
  className?: string;
  /** Show a live face-count badge inside the video. Default: true */
  showCounter?: boolean;
  /** Render custom UI on top of the camera feed (inside the video box). */
  overlay?: (faces: SelectedFace[], trackedCount: number) => React.ReactNode;
  /** Fires whenever the camera transitions between ready / not-ready. */
  onReadyChange?: (ready: boolean) => void;
  /** Fires whenever the number of actively tracked faces changes. */
  onTrackedCountChange?: (count: number) => void;
  /** Fires whenever a new unique face is quality-selected (totalCount increments). */
  onTotalCountChange?: (count: number) => void;
  /**
   * Fires whenever the set of live face previews changes.
   * Each entry appears ~300ms after the face is first detected and its image
   * updates in real time as frontalness improves.
   */
  onLiveUpdate?: (previews: LiveFacePreview[]) => void;
}

/**
 * Drop-in camera component. Owns the `<video>` and overlay `<canvas>` —
 * callers only pass settings and callbacks.
 *
 * ```tsx
 * <PassiveCameraView
 *   apiBaseUrl="https://api.example.com"
 *   token={session.token}
 *   sessionType="passive"
 *   onSelect={(face) => console.log(face)}
 *   onSessionExpired={() => navigate("/connect")}
 *   onCameraNotFound={() => navigate("/connect")}
 *   onReadyChange={setReady}
 *   onTrackedCountChange={setTrackedCount}
 *   onTotalCountChange={setTotalCount}
 * />
 * ```
 */
export function PassiveCameraView({
  className,
  showCounter = true,
  overlay,
  onReadyChange,
  onTrackedCountChange,
  onTotalCountChange,
  onLiveUpdate,
  deviceId: controlledDeviceId,
  ...hookOpts
}: PassiveCameraViewProps) {
  const { devices } = useCameraDevices();
  const [savedDeviceId, setSavedDeviceId] = useState<string | undefined>(
    () => localStorage.getItem(STORAGE_KEY) ?? undefined,
  );
  const deviceId = controlledDeviceId ?? savedDeviceId;
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const { videoRef, overlayRef, ready, error, trackedCount, totalCount, selectedFaces, livePreviews } =
    usePassiveCamera({ ...hookOpts, deviceId, facingMode, sessionType: "passive" });

  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);
  useEffect(() => { onTrackedCountChange?.(trackedCount); }, [trackedCount, onTrackedCountChange]);
  useEffect(() => { onTotalCountChange?.(totalCount); }, [totalCount, onTotalCountChange]);
  useEffect(() => { onLiveUpdate?.(livePreviews); }, [livePreviews, onLiveUpdate]);

  if (error) {
    return (
      <div className={className} style={{ color: "red", fontSize: 14 }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <div
        className={className}
        style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: 12, overflow: "hidden" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />

        {/* Front/back camera toggle */}
        <button
          onClick={() => setFacingMode((m) => m === "user" ? "environment" : "user")}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 10, background: "rgba(0,0,0,0.45)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Switch camera"
        >
          <SwitchCamera size={16} color="#fff" />
        </button>

        {!ready && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#aaa", fontSize: 14 }}>Connecting…</span>
          </div>
        )}

        {ready && showCounter && (
          <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: 6, padding: "2px 10px", fontSize: 13 }}>
            {trackedCount} {trackedCount === 1 ? "face" : "faces"}
          </div>
        )}

        {overlay?.(selectedFaces, trackedCount)}
      </div>

      {devices.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Camera source</span>
          <select
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #ccc" }}
            value={deviceId ?? ""}
            onChange={(e) => {
              const id = e.target.value || undefined;
              setSavedDeviceId(id);
              if (id) localStorage.setItem(STORAGE_KEY, id);
              else localStorage.removeItem(STORAGE_KEY);
            }}
          >
            <option value="">Default camera</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
