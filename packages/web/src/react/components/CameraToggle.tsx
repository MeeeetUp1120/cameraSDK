import { SwitchCamera } from "lucide-react";
import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface CameraToggleProps {
  className?: string;
}

/** Front/back camera switch button. Works in both modes. */
export function CameraToggle({ className }: CameraToggleProps) {
  const cam = useMeeeetUpCam();

  return (
    <button
      className={className}
      onClick={cam.toggleCamera}
      title="Switch camera"
      style={{ background: "rgba(0,0,0,0.45)", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <SwitchCamera size={16} color="#fff" />
    </button>
  );
}
