import 'package:flutter/material.dart';
import '../face_tracker.dart' show TrackedFace, boxDisplayMs;

/// CustomPainter that draws bounding boxes and frontalness labels for
/// all currently visible face tracks.
class FaceOverlayPainter extends CustomPainter {
  FaceOverlayPainter({
    required this.tracks,
    required this.previewSize,
  });

  final List<TrackedFace> tracks;

  /// The raw camera preview resolution (before scaling to the widget).
  final Size previewSize;

  @override
  void paint(Canvas canvas, Size size) {
    final nowMs  = DateTime.now().millisecondsSinceEpoch;
    final scaleX = size.width  / previewSize.width;
    final scaleY = size.height / previewSize.height;

    final boxPaint = Paint()
      ..color       = const Color(0xE522C55E) // green
      ..style       = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final labelBgPaint = Paint()
      ..color = const Color(0xD922C55E)
      ..style = PaintingStyle.fill;

    for (final t in tracks) {
      if (nowMs - t.lastSeenAt >= boxDisplayMs) continue;

      final x = (t.dispCx - t.dispW / 2) * previewSize.width  * scaleX;
      final y = (t.dispCy - t.dispH / 2) * previewSize.height * scaleY;
      final w = t.dispW * previewSize.width  * scaleX;
      final h = t.dispH * previewSize.height * scaleY;

      canvas.drawRect(Rect.fromLTWH(x, y, w, h), boxPaint);

      final label = t.selectedFrontalness > 0
          ? 't${t.id}  ${t.smoothedFrontalness.round()}% (${t.selectedFrontalness.round()}%)'
          : 't${t.id}  ${t.smoothedFrontalness.round()}%';

      final tp = TextPainter(
        text: TextSpan(
          text: label,
          style: const TextStyle(
            color:      Colors.white,
            fontSize:   11,
            fontFamily: 'monospace',
            fontWeight: FontWeight.bold,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      canvas.drawRect(
        Rect.fromLTWH(x, y - 20, tp.width + 8, 18),
        labelBgPaint,
      );
      tp.paint(canvas, Offset(x + 4, y - 18));
    }
  }

  @override
  bool shouldRepaint(FaceOverlayPainter old) => true;
}
