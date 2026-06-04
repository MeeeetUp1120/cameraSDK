// Core re-exports (convenience)
export type { CameraSession, Detection, FrameBuffer, SelectedFace } from "@meeeetup-cam/core";
export { FaceCaptureSession, ApiClient, isTokenExpired, sessionFromToken } from "@meeeetup-cam/core";

// Web-specific
export { CanvasFrameBuffer, snapshotCanvas } from "./frame-buffer";
export { CameraLoop } from "./camera-loop";
export { drawOverlay } from "./overlay";

// Detectors
export { MediapipeDetector } from "./detectors/mediapipe-detector";
export { TensorFlowDetector } from "./detectors/tensorflow-detector";

// React (only loaded if consumer imports react)
export { useMeeeetupCamera }     from "./react/useMeeeetupCamera";
export { useCameraDevices }      from "./react/useCameraDevices";
export { useConnect }            from "./react/useConnect";
export { MeeeetupCameraView }    from "./react/MeeeetupCameraView";
