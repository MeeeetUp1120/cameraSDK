import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface FaceCounterProps {
  className?: string;
}

/** Displays tracked face count and total. Passive mode only — renders nothing in interactive mode. */
export function FaceCounter({ className }: FaceCounterProps) {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "passive" || !cam.ready) return null;

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{cam.trackedCount}</span>
        <span style={{ fontSize: 13, opacity: 0.6 }}>{cam.trackedCount === 1 ? "person" : "people"} in frame</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{cam.totalCount}</span>
        <span style={{ fontSize: 13, opacity: 0.6 }}>total captured</span>
      </div>
    </div>
  );
}
