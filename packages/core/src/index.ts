export type { CameraSession, Detection, FrameBuffer, SelectedFace, PersonResult, CaptureResponse } from "./types";
export { getFrontalness, nmsFilter, boxIoU } from "./face-geometry";
export {
  TRACK_MATCH_THRESHOLD,
  TRACK_STALE_MS,
  TRACK_CONFIRM_MS,
  BOX_DISPLAY_MS,
  TRACK_SELECT_MIN_FRONTALNESS,
  PENDING_CONFIRM_THRESHOLD,
  MIN_PENDING_CONFIRMED_FRAMES,
  createTrack,
  commitPending,
  updateTracks,
  flushStale,
  type TrackedFace,
} from "./face-tracker";
export { decodeJwtPayload, isTokenExpired, sessionFromToken } from "./session";
export { ApiClient } from "./api-client";
export { FaceCaptureSession, type FaceCaptureSessionOptions } from "./pipeline";
