import { CanvasFrameBuffer } from "./frame-buffer";
import type { MediapipeDetector } from "./detectors/mediapipe-detector";
import type { TensorFlowDetector } from "./detectors/tensorflow-detector";
import type { Detection } from "@meeeetup-cam/core";

export type SupportedDetector = MediapipeDetector | TensorFlowDetector;

export interface CameraLoopCallbacks {
  onFrame: (detections: Detection[], frame: CanvasFrameBuffer, timestampMs: number) => void;
  onTick:  () => void;
}

/**
 * Manages the getUserMedia stream, offscreen canvas, and per-frame detection
 * scheduling (requestVideoFrameCallback → requestAnimationFrame fallback).
 */
export class CameraLoop {
  private stream:    MediaStream | null    = null;
  private offscreen: HTMLCanvasElement | null = null;
  private vcbHandle: number | null         = null;
  private rafHandle: number | null         = null;
  private running    = false;

  constructor(
    private readonly video:    HTMLVideoElement,
    private readonly detector: SupportedDetector,
    private readonly callbacks: CameraLoopCallbacks,
  ) {}

  async start(deviceId?: string): Promise<void> {
    const constraint: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };

    this.stream = await navigator.mediaDevices.getUserMedia({ video: constraint });
    this.video.srcObject = this.stream;

    await new Promise<void>((res) => {
      this.video.onloadedmetadata = () => res();
    });
    await this.video.play();

    const oc = document.createElement("canvas");
    oc.width  = this.video.videoWidth  || 1280;
    oc.height = this.video.videoHeight || 720;
    this.offscreen = oc;
    this.running   = true;

    this._scheduleDetect(this._detectFrame.bind(this));

    // Overlay / tick loop at display refresh rate
    const tickLoop = () => {
      if (!this.running) return;
      this.callbacks.onTick();
      this.rafHandle = requestAnimationFrame(tickLoop);
    };
    this.rafHandle = requestAnimationFrame(tickLoop);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle)  cancelAnimationFrame(this.rafHandle);
    if (this.vcbHandle && "cancelVideoFrameCallback" in HTMLVideoElement.prototype) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.video as any).cancelVideoFrameCallback(this.vcbHandle);
    } else if (this.vcbHandle) {
      cancelAnimationFrame(this.vcbHandle as unknown as number);
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream    = null;
    this.offscreen = null;
  }

  private _scheduleDetect(cb: (t: DOMHighResTimeStamp) => void): void {
    if (!this.video) return;
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.vcbHandle = (this.video as any).requestVideoFrameCallback(cb) as number;
    } else {
      this.vcbHandle = requestAnimationFrame(cb) as unknown as number;
    }
  }

  private _detectFrame(nowPerf: DOMHighResTimeStamp): void {
    if (!this.running || !this.offscreen || !this.video) return;

    const vw = this.video.videoWidth  || 1280;
    const vh = this.video.videoHeight || 720;
    if (this.offscreen.width !== vw || this.offscreen.height !== vh) {
      this.offscreen.width  = vw;
      this.offscreen.height = vh;
    }

    this.offscreen.getContext("2d")?.drawImage(this.video, 0, 0, vw, vh);

    let detections: Detection[];

    // MediapipeDetector is synchronous; TensorFlowDetector returns a Promise
    const result = (this.detector as MediapipeDetector).detectForVideo?.(
      this.offscreen,
      nowPerf,
    );

    if (result instanceof Promise) {
      result.then((dets) => {
        if (!this.running) return;
        this.callbacks.onFrame(dets, new CanvasFrameBuffer(this.offscreen!), nowPerf);
        this._scheduleDetect(this._detectFrame.bind(this));
      });
      return; // don't re-schedule synchronously
    }

    detections = result as Detection[];
    this.callbacks.onFrame(detections, new CanvasFrameBuffer(this.offscreen), nowPerf);
    this._scheduleDetect(this._detectFrame.bind(this));
  }
}
