import { useMeeeetUpCam } from "../context/useMeeeetUpCam";
import { CircleProgress } from "../CircleProgress";

/** Alignment ring + progress + countdown. Interactive mode only — renders nothing in passive mode. */
export function AlignmentRing() {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "interactive") return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(320px, 75vw)", aspectRatio: "1" }}>
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, borderRadius: "50%",
          border: `3px solid ${cam.isFaceAligned ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.55)"}`,
          boxShadow: cam.isFaceAligned ? "0 0 16px rgba(255,255,255,0.35)" : undefined,
          transition: "all 300ms",
          animation: cam.isFaceAligned ? undefined : "pulse 2s infinite",
        }} />
        {cam.isFaceAligned && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
            <CircleProgress progress={cam.captureProgress} size={320} className="w-full h-full" color="rgba(255,255,255,0.75)" strokeWidth={10} />
          </div>
        )}
        {cam.alignmentCountdown !== null && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: 100, lineHeight: 1, filter: "drop-shadow(0 0 20px rgba(255,255,255,0.8))", animation: "pulse 1s infinite" }}>
              {cam.alignmentCountdown}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
