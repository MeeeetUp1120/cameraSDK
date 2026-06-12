import { Camera, Loader2 } from "lucide-react";
import { useMeeeetUpCam } from "../context/useMeeeetUpCam";

export interface CaptureButtonProps {
  className?: string;
}

/** Manual capture button. Interactive mode only — renders nothing in passive mode. */
export function CaptureButton({ className }: CaptureButtonProps) {
  const cam = useMeeeetUpCam();
  if (cam.mode !== "interactive") return null;

  const disabled = cam.isCapturing || cam.isLoading || cam.isSwitchingCamera;

  return (
    <button
      className={className}
      onClick={() => cam.captureImage()}
      disabled={disabled}
      style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {cam.isCapturing
        ? <Loader2 size={16} color="rgba(255,255,255,0.9)" style={{ animation: "spin 1s linear infinite" }} />
        : <Camera size={16} color="rgba(255,255,255,0.4)" />
      }
    </button>
  );
}
