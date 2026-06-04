import type { Detection } from "@meeeetup-cam/core";

// Lazily imported so the WASM is only fetched when the detector is created.
type FaceDetector = {
  setOptions(opts: { runningMode: string; minDetectionConfidence: number }): void;
  detectForVideo(canvas: HTMLCanvasElement, timestamp: number): { detections: RawDetection[] };
  close(): void;
};

interface RawDetection {
  boundingBox?: {
    originX: number; originY: number; width: number; height: number;
  };
  keypoints?: Array<{ x: number; y: number }>;
  categories?: Array<{ score: number }>;
}

const DEFAULT_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite";

/**
 * Wraps MediaPipe BlazeFace and converts its output to the shared Detection[].
 *
 * MediaPipe keypoint order: [0] rightEye [1] leftEye [2] noseTip [3] mouth
 *                            [4] rightEar [5] leftEar
 * We keep only [0..2] which matches what getFrontalness() expects.
 */
export class MediapipeDetector {
  private constructor(private readonly detector: FaceDetector) {}

  static async create(options?: {
    wasmUrl?: string;
    modelUrl?: string;
    minConfidence?: number;
  }): Promise<MediapipeDetector> {
    // Dynamic import so the heavy WASM is only loaded on demand
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision" as any);

    const fileset = await FilesetResolver.forVisionTasks(
      options?.wasmUrl ?? DEFAULT_WASM_URL,
    );

    const detector: FaceDetector = await withSilencedConsole(() =>
      FaceDetector.createFromModelPath(
        fileset,
        options?.modelUrl ?? DEFAULT_MODEL_URL,
      ),
    );

    detector.setOptions({
      runningMode: "VIDEO",
      minDetectionConfidence: options?.minConfidence ?? 0.5,
    });

    return new MediapipeDetector(detector);
  }

  /**
   * Run detection on a canvas that contains the current video frame.
   * Returns normalised Detection[] ready for the core pipeline.
   */
  detectForVideo(canvas: HTMLCanvasElement, timestampMs: number): Detection[] {
    const result = this.detector.detectForVideo(canvas, timestampMs);
    const W = canvas.width;
    const H = canvas.height;

    return (result.detections as RawDetection[])
      .filter((d) => d.boundingBox)
      .map((d) => ({
        boundingBox: {
          originX: d.boundingBox!.originX / W,
          originY: d.boundingBox!.originY / H,
          width:   d.boundingBox!.width   / W,
          height:  d.boundingBox!.height  / H,
        },
        keypoints: (d.keypoints ?? []).slice(0, 3).map((kp) => ({
          x: kp.x / W,
          y: kp.y / H,
        })),
        score: d.categories?.[0]?.score ?? 1,
      }));
  }

  dispose(): void { this.detector.close(); }
}

async function withSilencedConsole<T>(fn: () => Promise<T>): Promise<T> {
  const noop = () => {};
  const origLog = console.log, origInfo = console.info, origWarn = console.warn;
  console.log = noop; console.info = noop; console.warn = noop;
  try {
    return await fn();
  } finally {
    console.log = origLog; console.info = origInfo; console.warn = origWarn;
  }
}
