import type { FrameBuffer } from "@meeeetup-cam/core";

/**
 * React Native FrameBuffer backed by a base64 JPEG string already captured
 * from a Vision Camera snapshot or frame processor output.
 *
 * Vision Camera v4 exposes `frame.toArrayBuffer()` in frame processors.
 * For simplicity this implementation wraps a pre-captured JPEG base64 string.
 * See RNFrameProcessor for the frame-processor variant.
 */
export class RNFrameBuffer implements FrameBuffer {
  constructor(
    private readonly jpegBase64: string,
    readonly width: number,
    readonly height: number,
  ) {}

  toJpegBase64(_quality?: number): string {
    return this.jpegBase64;
  }

  /**
   * On React Native we return the full frame as the crop — actual pixel-level
   * cropping happens server-side via AWS Rekognition's bounding-box analysis.
   * For higher accuracy, wire up react-native-skia to perform the crop natively.
   */
  cropFaceJpeg(
    _cx: number,
    _cy: number,
    _bw: number,
    _bh: number,
    _quality?: number,
  ): string | null {
    // TODO: use react-native-skia for pixel-accurate crop
    // For now return the full frame — Rekognition will handle the crop server-side
    return this.jpegBase64;
  }
}
