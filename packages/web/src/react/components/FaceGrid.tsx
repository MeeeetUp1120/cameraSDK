import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface FaceGridProps {
  className?: string;
  /** Which faces to show. Default: "selected" (committed). */
  source?: "selected" | "live";
}

/** Thumbnail grid of faces. Passive mode only — renders nothing in interactive mode. */
export function FaceGrid({ className, source = "selected" }: FaceGridProps) {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "passive") return null;

  const faces = source === "live" ? cam.livePreviews : cam.selectedFaces;
  if (faces.length === 0) return null;

  return (
    <div className={className} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {faces.map((f) => (
        <div key={f.trackId} style={{ position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden", background: "#222" }}>
          <img
            src={f.dataUrl}
            alt={`Face ${f.trackId}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <span style={{ position: "absolute", bottom: 2, left: 4, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 3, padding: "0 4px" }}>
            {f.trackId}
          </span>
          {"frontalness" in f && (
            <span style={{ position: "absolute", top: 2, right: 4, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 3, padding: "0 4px" }}>
              {f.frontalness}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
