import type { Detection } from "@meeeetup-cam/core";

/**
 * TensorFlow.js BlazeFace adapter.
 *
 * Install peer deps:
 *   npm i @tensorflow/tfjs @tensorflow-models/blazeface
 *
 * Same output shape as MediapipeDetector — drop-in swap.
 *
 * BlazeFace keypoint order: [0] rightEye [1] leftEye [2] noseTip
 *                            [3] mouth [4] rightEar [5] leftEar
 */
export class TensorFlowDetector {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private readonly model: any) {}

  static async create(): Promise<TensorFlowDetector> {
    // String split prevents Vite / Rollup from statically resolving these
    // optional peer deps — they are only loaded if this method is called.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tf, blazeface] = await Promise.all([
      import("@tensorflow" + "/tfjs" as never),
      import("@tensorflow-models" + "/blazeface" as never),
    ]) as any[];
    await tf.ready();
    const model = await blazeface.load();
    return new TensorFlowDetector(model);
  }

  async detectForVideo(
    canvas: HTMLCanvasElement,
  ): Promise<Detection[]> {
    const W = canvas.width;
    const H = canvas.height;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const predictions: any[] = await this.model.estimateFaces(canvas, false);

    return predictions.map((p: {
      topLeft: [number, number];
      bottomRight: [number, number];
      landmarks: Array<[number, number]>;
      probability: [number];
    }) => {
      const [x1, y1] = p.topLeft;
      const [x2, y2] = p.bottomRight;
      const bw = x2 - x1;
      const bh = y2 - y1;

      return {
        boundingBox: {
          originX: x1 / W,
          originY: y1 / H,
          width:   bw  / W,
          height:  bh  / H,
        },
        // BlazeFace landmarks match the same index order as MediaPipe [0..2]
        keypoints: p.landmarks.slice(0, 3).map(([lx, ly]: [number, number]) => ({
          x: lx / W,
          y: ly / H,
        })),
        score: p.probability[0] ?? 1,
      };
    });
  }

  dispose(): void {
    // TensorFlow.js models don't need explicit disposal in most cases
  }
}
