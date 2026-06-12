// Types
export type { SelectedFace, LiveFacePreview, PersonResult } from "@meeeetup-cam/core";
export { ApiClient, isTokenExpired, sessionFromToken } from "@meeeetup-cam/core";

// ── Context API (primary) ───────────────────────────────────────────────────────
export { MeeeetUpCamProvider }    from "./react/context/MeeeetUpCamProvider";
export type { MeeeetUpCamProviderProps } from "./react/context/MeeeetUpCamProvider";
export { useMeeeetUpCam }         from "./react/context/useMeeeetUpCam";
export type { MeeeetUpCamContextValue, CameraMode, PassiveState, InteractiveState } from "./react/context/MeeeetUpCamContext";

// ── Built-in components ─────────────────────────────────────────────────────────
export { CameraViewport }         from "./react/components/CameraViewport";
export { FaceCounter }            from "./react/components/FaceCounter";
export { FaceGrid }               from "./react/components/FaceGrid";
export { CameraToggle }           from "./react/components/CameraToggle";
export { DevicePicker }           from "./react/components/DevicePicker";
export { AlignmentRing }          from "./react/components/AlignmentRing";
export { CaptureButton }          from "./react/components/CaptureButton";

// ── Hooks ───────────────────────────────────────────────────────────────────────
export { useConnect }             from "./react/useConnect";

