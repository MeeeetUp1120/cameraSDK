import { useMeeeetupCamera, type UseMeeeetupCameraOptions } from "./useMeeeetupCamera";
import type { SelectedFace } from "@meeeetup-cam/core";

interface MeeeetupCameraViewProps extends UseMeeeetupCameraOptions {
  /** Additional CSS class for the outer wrapper div. */
  className?: string;
  /** Show a live counter badge. Default: true */
  showCounter?: boolean;
  /** Render custom UI on top of the camera feed. */
  overlay?: (faces: SelectedFace[], trackedCount: number) => React.ReactNode;
}

/**
 * Drop-in camera component for passive continuous capture.
 *
 * ```tsx
 * <MeeeetupCameraView
 *   apiBaseUrl="https://api.example.com"
 *   token={session.token}
 *   sessionType="passive"
 *   onSelect={(face) => console.log(face)}
 *   onSessionExpired={() => navigate("/connect")}
 * />
 * ```
 */
export function MeeeetupCameraView({
  className,
  showCounter = true,
  overlay,
  ...hookOpts
}: MeeeetupCameraViewProps) {
  const { videoRef, overlayRef, ready, error, trackedCount, selectedFaces } =
    useMeeeetupCamera(hookOpts);

  if (error) {
    return (
      <div className={className} style={{ color: "red", fontSize: 14 }}>
        {error}
      </div>
    );
  }

  return (
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
  );
}
