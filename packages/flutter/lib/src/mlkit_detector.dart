import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'types.dart';

/// ML Kit face detector with landmark extraction.
///
/// Converts ML Kit [Face] objects into the SDK's [Detection] type.
/// Keypoint mapping:
///   FaceLandmarkType.leftEye  → [1] (camera-left = subject's right eye → index 0)
///   FaceLandmarkType.rightEye → [0]
///   FaceLandmarkType.noseBase → [2]
class MLKitFaceDetector {
  MLKitFaceDetector()
      : _detector = FaceDetector(
          options: FaceDetectorOptions(
            enableLandmarks:    true,
            enableClassification: false,
            enableTracking:     true,
            minFaceSize:        0.1,
            performanceMode:    FaceDetectorMode.accurate,
          ),
        );

  final FaceDetector _detector;

  Future<List<Detection>> detectFromInputImage(
    InputImage image,
    int frameWidth,
    int frameHeight,
  ) async {
    final faces = await _detector.processImage(image);
    return faces.map((face) => _convert(face, frameWidth, frameHeight)).toList();
  }

  Detection _convert(Face face, int w, int h) {
    final r = face.boundingBox;

    // Normalise bounding box
    final originX = r.left   / w;
    final originY = r.top    / h;
    final bWidth  = r.width  / w;
    final bHeight = r.height / h;

    final cx = originX + bWidth  / 2;
    final cy = originY + bHeight / 2;

    // Landmarks — fall back to estimated positions if not detected
    Keypoint kp(FaceLandmarkType type, double defaultX, double defaultY) {
      final lm = face.landmarks[type];
      if (lm == null) return Keypoint(x: defaultX, y: defaultY);
      return Keypoint(x: lm.position.x / w, y: lm.position.y / h);
    }

    final rightEye = kp(FaceLandmarkType.rightEye, cx - bWidth * 0.15, cy - bHeight * 0.1);
    final leftEye  = kp(FaceLandmarkType.leftEye,  cx + bWidth * 0.15, cy - bHeight * 0.1);
    final noseTip  = kp(FaceLandmarkType.noseBase, cx,                 cy + bHeight * 0.05);

    return Detection(
      boundingBox: BoundingBox(
        originX: originX,
        originY: originY,
        width:   bWidth,
        height:  bHeight,
      ),
      keypoints: [rightEye, leftEye, noseTip],
      score:     1.0,  // ML Kit doesn't expose confidence directly
    );
  }

  void dispose() => _detector.close();
}
