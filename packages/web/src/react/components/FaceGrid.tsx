import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface FaceGridProps {
  className?: string;
}

/** Shows both live previews and committed faces. Passive mode only. */
export function FaceGrid({ className }: FaceGridProps) {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "passive") return null;

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Live — real-time tracking (exclude faces already in buffer) */}
      {(() => {
        const bufferedIds = new Set(cam.selectedFaces.map((f) => f.trackId));
        const live = cam.livePreviews.filter((f) => !bufferedIds.has(f.trackId));
        return <div>
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.5 }}>Live ({live.length})</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, minHeight: 64 }}>
          {live.length === 0 && (
            <span style={{ fontSize: 11, color: "#888" }}>No faces detected</span>
          )}
          {live.map((f) => (
            <div key={f.trackId} style={{ position: "relative", width: 64, height: 64, borderRadius: 6, overflow: "hidden", background: "#222", border: "2px solid rgba(59,130,246,0.5)" }}>
              <img src={f.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 1, left: 2, fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.6)", borderRadius: 2, padding: "0 3px" }}>
                {f.trackId}
              </span>
              <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9, color: "#3b82f6", background: "rgba(0,0,0,0.6)", borderRadius: 2, padding: "0 3px" }}>
                {Math.round(f.frontalness)}%
              </span>
            </div>
          ))}
        </div>
      </div>;
      })()}

      {/* Committed — passed quality gates, waiting to send */}
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.5 }}>Buffer ({cam.selectedFaces.length})</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, minHeight: 64 }}>
          {cam.selectedFaces.length === 0 && (
            <span style={{ fontSize: 11, color: "#888" }}>No faces buffered</span>
          )}
          {cam.selectedFaces.map((f) => (
            <div key={f.trackId} style={{ position: "relative", width: 64, height: 64, borderRadius: 6, overflow: "hidden", background: "#222", border: "2px solid rgba(34,197,94,0.5)" }}>
              <img src={f.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 1, left: 2, fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.6)", borderRadius: 2, padding: "0 3px" }}>
                {f.trackId}
              </span>
              <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9, color: "#22c55e", background: "rgba(0,0,0,0.6)", borderRadius: 2, padding: "0 3px" }}>
                {Math.round(f.frontalness)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
