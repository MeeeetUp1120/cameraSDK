import type { Detection } from "@meeeetup1120/core";

/**
 * TensorFlow.js BlazeFace adapter for React Native.
 *
 * Install peer deps:
 *   npm i @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow-models/blazeface
 *   npm i @tensorflow/tfjs-backend-rn   # or cpu backend
 *
 * Usage:
 *   const detector = await TFBlazeFaceDetector.create();
 *   const detections = await detector.detect(base64Jpeg, width, height);
 */

export class TFBlazeFaceDetector {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private readonly model: any) {}

  static async create(): Promise<TFBlazeFaceDetector> {
    const [tf, blazeface] = await Promise.all([
      import("@tensorflow/tfjs" as never),
      import("@tensorflow-models/blazeface" as never),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]) as any[];
    // For React Native, also import the RN backend before calling ready()
    await import("@tensorflow/tfjs-react-native" as never);
    await tf.ready();
    const model = await blazeface.load();
    return new TFBlazeFaceDetector(model);
  }

  async detect(
    base64Jpeg: string,
    frameWidth: number,
    frameHeight: number,
  ): Promise<Detection[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tf = await import("@tensorflow/tfjs" as never) as any;
    // Decode base64 JPEG to a tensor via the RN backend
    const tensor = tf.browser
      ? await tf.browser.fromPixelsAsync({ uri: `data:image/jpeg;base64,${base64Jpeg}` })
      : null;
    if (!tensor) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preds: any[] = await this.model.estimateFaces(tensor, false);
    tensor.dispose();

    return preds.map((p: {
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
          originX: x1 / frameWidth,
          originY: y1 / frameHeight,
          width:   bw  / frameWidth,
          height:  bh  / frameHeight,
        },
        keypoints: p.landmarks.slice(0, 3).map(([lx, ly]: [number, number]) => ({
          x: lx / frameWidth,
          y: ly / frameHeight,
        })),
        score: p.probability[0] ?? 1,
      };
    });
  }
}
