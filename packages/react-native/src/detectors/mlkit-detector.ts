import type { Detection } from "@meeeetup1120/core";

/**
 * ML Kit face detection adapter for React Native.
 *
 * Install peer deps:
 *   npx expo install @react-native-ml-kit/face-detection
 *   # or for bare RN:
 *   npm i @react-native-ml-kit/face-detection
 *
 * ML Kit keypoint labels → our index mapping:
 *   LEFT_EYE  → [1] (camera-left = subject's left = rightEye in mirror)
 *   RIGHT_EYE → [0]
 *   NOSE_BASE → [2]
 *
 * We normalise all coordinates to 0–1 using the frame dimensions.
 */

interface MLKitFace {
  bounds: { left: number; top: number; width: number; height: number };
  landmarks?: Record<string, { position: { x: number; y: number } }>;
  headEulerAngleY?: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  trackingId?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mlkit(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-ml-kit/face-detection");
}

export async function detectFacesMLKit(
  imagePath: string,
  frameWidth: number,
  frameHeight: number,
): Promise<Detection[]> {
  const FaceDetector = mlkit().default;
  const faces: MLKitFace[] = await FaceDetector.detect(imagePath);

  return faces.map((face) => {
    const b = face.bounds;
    const cx = (b.left + b.width  / 2) / frameWidth;
    const cy = (b.top  + b.height / 2) / frameHeight;
    const bw = b.width  / frameWidth;
    const bh = b.height / frameHeight;

    const lm = face.landmarks ?? {};
    const kp = (label: string) => {
      const pos = lm[label]?.position;
      return pos ? { x: pos.x / frameWidth, y: pos.y / frameHeight } : null;
    };

    const rightEye = kp("RIGHT_EYE") ?? { x: cx - bw * 0.15, y: cy - bh * 0.1 };
    const leftEye  = kp("LEFT_EYE")  ?? { x: cx + bw * 0.15, y: cy - bh * 0.1 };
    const noseTip  = kp("NOSE_BASE") ?? { x: cx,              y: cy + bh * 0.05 };

    return {
      boundingBox: {
        originX: b.left / frameWidth,
        originY: b.top  / frameHeight,
        width:   bw,
        height:  bh,
      },
      keypoints: [rightEye, leftEye, noseTip],
      score: 1,  // ML Kit doesn't expose confidence directly
    };
  });
}
