import { nmsFilter } from "./face-geometry";
import {
  commitPending,
  flushStale,
  updateTracks,
  type TrackedFace,
} from "./face-tracker";
import { ApiClient } from "./api-client";
import type { Detection, FrameBuffer, SelectedFace } from "./types";

export interface FaceCaptureSessionOptions {
  apiBaseUrl: string;
  token: string;
  sessionType: "interactive" | "passive";

  /** How often to batch-send in passive mode (ms). Default: 10 000 */
  batchIntervalMs?: number;
  /** How often to poll /camera/me (ms). Default: 30 000 */
  heartbeatIntervalMs?: number;

  /** Called each time a new best face is selected for a track. */
  onSelect?: (face: SelectedFace) => void;
  /** Called when a track is removed (face left the frame). */
  onTrackRemoved?: (trackId: string) => void;
  /** Called after each successful batch send. */
  onBatchSent?: (count: number) => void;
  /** Called when /camera/me returns 401. */
  onSessionExpired?: () => void;
  /** Called when /camera/me returns 404. */
  onCameraNotFound?: () => void;
}

/**
 * Orchestrates face tracking, quality selection, and API sending.
 * Platform adapters call `processDetections()` each frame and `tick()` each
 * animation frame. Dispose with `dispose()` on unmount.
 */
export class FaceCaptureSession {
  private readonly api: ApiClient;
  private readonly opts: Required<FaceCaptureSessionOptions>;

  private tracks: TrackedFace[] = [];
  private buffer: SelectedFace[] = [];

  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: FaceCaptureSessionOptions) {
    this.opts = {
      batchIntervalMs:    opts.batchIntervalMs    ?? 10_000,
      heartbeatIntervalMs: opts.heartbeatIntervalMs ?? 30_000,
      onSelect:           opts.onSelect           ?? (() => {}),
      onTrackRemoved:     opts.onTrackRemoved      ?? (() => {}),
      onBatchSent:        opts.onBatchSent         ?? (() => {}),
      onSessionExpired:   opts.onSessionExpired    ?? (() => {}),
      onCameraNotFound:   opts.onCameraNotFound    ?? (() => {}),
      ...opts,
    };

    this.api = new ApiClient(opts.apiBaseUrl, opts.token);

    if (opts.sessionType === "passive") {
      this.batchTimer = setInterval(() => void this.flushBatch(), this.opts.batchIntervalMs);
    }

    this.heartbeatTimer = setInterval(() => void this._heartbeat(), this.opts.heartbeatIntervalMs);
    void this._heartbeat(); // immediate first check
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get trackedCount(): number { return this.tracks.length; }
  get pendingFaces(): SelectedFace[] { return [...this.buffer]; }
  get activeTracks(): readonly TrackedFace[] { return this.tracks; }

  /**
   * Feed one frame's worth of detections into the pipeline.
   * Call this for every video frame (or every ML Kit result).
   *
   * @param detections  Normalised Detection[] from the platform detector.
   * @param frame       FrameBuffer wrapping the current video frame pixels.
   */
  processDetections(detections: Detection[], frame: FrameBuffer): void {
    const valid = nmsFilter(detections);
    const onCommit = (track: TrackedFace) => commitPending(track, this._onSelect);
    updateTracks(valid, frame, this.tracks, onCommit);
  }

  /**
   * Flush stale tracks. Call periodically (e.g. each rAF or on a timer).
   */
  tick(): void {
    this.tracks = flushStale(
      this.tracks,
      (t) => commitPending(t, this._onSelect),
      (id) => this.opts.onTrackRemoved(id),
    );
  }

  /**
   * Immediately send all buffered faces to the API then clear the buffer.
   * Passive mode calls this automatically on the batch timer; you can also
   * call it manually (e.g. on page hide / app background).
   */
  async flushBatch(): Promise<void> {
    const nowMs = Date.now();
    const faces = this.buffer.filter((f) => f.createdAt < nowMs - 5_000);
    this.buffer = this.buffer.filter((f) => f.createdAt >= nowMs - 5_000);
    if (faces.length === 0) return;
    try {
      await this.api.capture(faces.map((f) => f.dataUrl));
      this.opts.onBatchSent(faces.length);
    } catch {
      // Put them back on failure so we don't lose data
      this.buffer.unshift(...faces);
    }
  }

  /** Stop all timers. Call on component unmount / widget dispose. */
  dispose(): void {
    if (this.batchTimer)     clearInterval(this.batchTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.tracks = [];
    this.buffer = [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private readonly _onSelect = (face: SelectedFace): void => {
    // Update or insert the face slot for this track in the buffer
    const idx = this.buffer.findIndex((f) => f.trackId === face.trackId);
    if (idx !== -1) {
      this.buffer[idx] = face;
    } else {
      this.buffer.unshift(face);
    }
    this.opts.onSelect(face);
  };

  private async _heartbeat(): Promise<void> {
    try {
      await this.api.heartbeat();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) this.opts.onSessionExpired();
      else if (status === 404) this.opts.onCameraNotFound();
    }
  }
}
