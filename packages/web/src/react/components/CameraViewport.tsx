import { useRef, useEffect, useCallback } from "react";
import { useMeeeetUpCam } from "../context/useMeeeetUpCam";
import { AlignmentRing } from "./AlignmentRing";

export interface CameraViewportProps {
  className?: string;
}

/**
 * Renders the camera `<video>` and overlay `<canvas>`.
 * In passive mode: video + detection overlay.
 * In interactive mode: circular viewport with blurred background.
 */
export function CameraViewport({ className }: CameraViewportProps) {
  const cam = useMeeeetUpCam();

  if (cam.mode === "passive") return <PassiveViewport className={className} />;
  return <InteractiveViewport className={className} />;
}

// ── Passive ─────────────────────────────────────────────────────────────────────

function PassiveViewport({ className }: { className?: string }) {
  const cam = useMeeeetUpCam() as Extract<ReturnType<typeof useMeeeetUpCam>, { mode: "passive" }>;

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: 12, overflow: "hidden" }}
    >
      <video
        ref={cam.videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <canvas
        ref={cam.overlayRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      {!cam.ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#aaa", fontSize: 14 }}>Connecting...</span>
        </div>
      )}
    </div>
  );
}

// ── Interactive ─────────────────────────────────────────────────────────────────

function InteractiveViewport({ className }: { className?: string }) {
  const cam = useMeeeetUpCam() as Extract<ReturnType<typeof useMeeeetUpCam>, { mode: "interactive" }>;

  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cam.videoStream && backgroundVideoRef.current) {
      backgroundVideoRef.current.srcObject = cam.videoStream;
    }
  }, [cam.videoStream]);

  const getDisplayFaceRect = useCallback(() => {
    if (!cam.faceBoundingBox || !cam.videoRef.current || !viewportContainerRef.current) return null;
    const video = cam.videoRef.current;
    const container = viewportContainerRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) return null;
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;
    let scale: number, offsetX = 0, offsetY = 0;
    if (videoAspect > containerAspect) { scale = containerHeight / videoHeight; offsetX = (containerWidth - videoWidth * scale) / 2; }
    else { scale = containerWidth / videoWidth; offsetY = (containerHeight - videoHeight * scale) / 2; }
    const faceCenterX = cam.faceBoundingBox.originX + cam.faceBoundingBox.width / 2;
    const faceCenterY = cam.faceBoundingBox.originY + cam.faceBoundingBox.height * 0.35;
    const paddedWidth = cam.faceBoundingBox.width * 1.1;
    const paddedHeight = cam.faceBoundingBox.height * 1.3;
    const rectX = faceCenterX - paddedWidth / 2;
    const rectY = faceCenterY - paddedHeight / 2;
    let displayX = rectX * scale + offsetX;
    const displayY = rectY * scale + offsetY;
    const displayWidth = paddedWidth * scale;
    const displayHeight = paddedHeight * scale;
    if (cam.isFlipped) { displayX = containerWidth - displayX - displayWidth; }
    return { x: displayX, y: displayY, width: displayWidth, height: displayHeight };
  }, [cam.faceBoundingBox, cam.isFlipped, cam.videoRef]);

  const displayFaceRect = getDisplayFaceRect();

  if (cam.error) {
    return (
      <div className={className} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, background: "#111", borderRadius: 16, color: "#f87171", padding: 32, textAlign: "center" }}>
        <p>{cam.error}</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", borderRadius: 16, background: "#111" }}>
      {/* Loading overlay */}
      {(cam.isLoading || cam.isSwitchingCamera) && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,17,17,0.8)", backdropFilter: "blur(16px)" }}>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{cam.isSwitchingCamera ? "Switching camera..." : "Initializing camera..."}</span>
        </div>
      )}

      {/* Background blurred video */}
      <video ref={backgroundVideoRef} autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 16, transform: cam.isFlipped ? "scaleX(-1)" : undefined }}
        controls={false}
      />
      <canvas ref={cam.canvasRef} style={{ display: "none" }} />

      {/* Dark overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(17,17,17,0.8)", backdropFilter: "blur(16px)" }} />

      {/* Circular viewport */}
      <div ref={viewportContainerRef} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", overflow: "hidden", borderRadius: "50%", width: "min(320px, 75vw)", aspectRatio: "1" }}>
        <video ref={cam.videoRef} autoPlay playsInline muted
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", opacity: cam.isSwitchingCamera ? 0.4 : 1, transform: cam.isFlipped ? "scaleX(-1)" : undefined }}
          controls={false}
        />
        {displayFaceRect && (
          <div style={{ position: "absolute", left: displayFaceRect.x, top: displayFaceRect.y, width: displayFaceRect.width, height: displayFaceRect.height, border: "3px solid white", borderRadius: 8, pointerEvents: "none", opacity: 0.8 }} />
        )}
      </div>

      {/* Alignment ring */}
      <AlignmentRing />
    </div>
  );
}
