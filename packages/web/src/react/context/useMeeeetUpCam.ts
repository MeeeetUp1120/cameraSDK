import { useContext } from "react";
import { MeeeetUpCamContext, type MeeeetUpCamContextValue } from "./MeeeetUpCamContext";

/**
 * Access the camera state from anywhere inside `<MeeeetUpCamProvider>`.
 *
 * The returned value is a discriminated union on `mode`:
 * ```ts
 * const cam = useMeeeetUpCam();
 * if (cam.mode === "passive") {
 *   cam.trackedCount;  // number
 *   cam.selectedFaces; // SelectedFace[]
 * }
 * ```
 */
export function useMeeeetUpCam(): MeeeetUpCamContextValue {
  const ctx = useContext(MeeeetUpCamContext);
  if (!ctx) {
    throw new Error("useMeeeetUpCam must be used within <MeeeetUpCamProvider>");
  }
  return ctx;
}
