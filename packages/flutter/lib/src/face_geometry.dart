import 'types.dart';

/// Frontalness score 0–100. Direct port of the TypeScript getFrontalness().
///
/// Blends three metrics:
/// - Eye span ratio (left-right coverage)
/// - Nose symmetry (how centred the nose is between the eyes)
/// - Vertical tilt (nose-to-eye ratio)
///
/// [kps] must have at least 2 entries: [0]=rightEye [1]=leftEye [2]=noseTip
double getFrontalness(
  List<Keypoint> kps,
  double faceWidth,
  double faceHeight,
) {
  if (kps.length < 2) return 50;

  // ── Horizontal: eye span ──────────────────────────────────────────────────
  final eyeSpan = (kps[1].x - kps[0].x).abs();
  final eyeSpanScore = (eyeSpan / faceWidth * 250).clamp(1.0, 100.0);

  if (kps.length < 3) return eyeSpanScore.roundToDouble();

  // ── Horizontal: nose symmetry ─────────────────────────────────────────────
  final rD = (kps[0].x - kps[2].x).abs();
  final lD = (kps[1].x - kps[2].x).abs();
  final tot = rD + lD;
  final symmetryScore =
      tot > 0 ? (2 * rD.compareTo(lD) < 0 ? rD : lD) / tot * 100 : 50.0;

  // ── Vertical: tilt (up/down) ──────────────────────────────────────────────
  final eyeMidY = (kps[0].y + kps[1].y) / 2;
  final noseRatio = (kps[2].y - eyeMidY) / faceHeight;
  final verticalScore =
      (100 - (noseRatio - 0.35).abs() * 280).clamp(1.0, 100.0);

  return (eyeSpanScore * 0.5 + symmetryScore * 0.3 + verticalScore * 0.2)
      .roundToDouble();
}

/// Non-maximum suppression — remove overlapping detections above [iouThreshold].
List<Detection> nmsFilter(List<Detection> faces, {double iouThreshold = 0.35}) {
  final sorted = [...faces]
    ..sort((a, b) => b.score.compareTo(a.score));
  final kept = <Detection>[];
  for (final face in sorted) {
    if (!kept.any((k) => boxIoU(k.boundingBox, face.boundingBox) > iouThreshold)) {
      kept.add(face);
    }
  }
  return kept;
}

double boxIoU(BoundingBox a, BoundingBox b) {
  final ax2 = a.originX + a.width;
  final ay2 = a.originY + a.height;
  final bx2 = b.originX + b.width;
  final by2 = b.originY + b.height;
  final iw = (ax2 < bx2 ? ax2 : bx2) - (a.originX > b.originX ? a.originX : b.originX);
  final ih = (ay2 < by2 ? ay2 : by2) - (a.originY > b.originY ? a.originY : b.originY);
  if (iw <= 0 || ih <= 0) return 0;
  final inter = iw * ih;
  final union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
