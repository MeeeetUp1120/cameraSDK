import 'dart:math';
import 'types.dart';
import 'face_geometry.dart';

// ── Constants ──────────────────────────────────────────────────────────────────
const double trackMatchThreshold     = 0.20;
const int    trackStaleMs            = 3000;
const int    trackConfirmMs          = 300;
const int    boxDisplayMs            = 150;
const double trackSelectMinFrontalness  = 40;
const double pendingConfirmThreshold    = 50;
const int    minPendingConfirmedFrames  = 3;

// ── TrackedFace ────────────────────────────────────────────────────────────────
class TrackedFace {
  TrackedFace({
    required this.id,
    required this.createdAt,
    required double cx,
    required double cy,
    required double nW,
    required double nH,
  })  : cx = cx,
        cy = cy,
        dispCx = cx,
        dispCy = cy,
        dispW = nW,
        dispH = nH,
        bestCx = cx,
        bestCy = cy,
        pendingCx = cx,
        pendingCy = cy,
        pendingBw = nW,
        pendingBh = nH,
        lastSeenAt = DateTime.now().millisecondsSinceEpoch;

  final String id;
  final int    createdAt;

  double cx, cy;
  double dispCx, dispCy, dispW, dispH;
  String? bestJpeg;
  double  bestCx, bestCy;
  double  bestFrontalness = 0;
  String? selectedJpeg;
  double  selectedFrontalness = 0;
  double  currentFrontalness  = 0;
  double  smoothedFrontalness = 0;
  int     lastSeenAt;
  int     lastSentAt          = 0;
  double  lastSentFrontalness = 0;
  String? pendingJpeg;
  double  pendingFrontalness  = 0;
  double  pendingCx, pendingCy;
  double  pendingBw, pendingBh;
  int     pendingStaleFrames      = 0;
  int     pendingConfirmedFrames  = 0;
}

int _trackIdCounter = 0;

TrackedFace createTrack(
  double cx, double cy, double nW, double nH, int nowMs,
) {
  return TrackedFace(
    id:        (++_trackIdCounter).toString(),
    createdAt: nowMs,
    cx: cx, cy: cy, nW: nW, nH: nH,
  );
}

// ── FrameBuffer interface ─────────────────────────────────────────────────────

abstract class FrameBuffer {
  int    get width;
  int    get height;
  String toJpegBase64({double quality = 0.85});
  String? cropFaceJpeg(double cx, double cy, double bw, double bh, {double quality = 0.85});
}

// ── Commit pipeline ────────────────────────────────────────────────────────────

SelectedFace _toSelectedFace(TrackedFace t) => SelectedFace(
  trackId:    t.id,
  dataUrl:    t.selectedJpeg!,
  frontalness: t.selectedFrontalness,
  lastSentAt: DateTime.fromMillisecondsSinceEpoch(t.lastSentAt),
);

void _resetPending(TrackedFace track) {
  track.pendingFrontalness     = 0;
  track.pendingJpeg            = null;
  track.pendingStaleFrames     = 0;
  track.pendingConfirmedFrames = 0;
}

void commitPending(
  TrackedFace track,
  void Function(SelectedFace) onSelect,
) {
  if (track.pendingFrontalness > track.bestFrontalness) {
    track.bestFrontalness = track.pendingFrontalness;
  }
  track.bestJpeg = track.pendingJpeg;
  track.bestCx   = track.pendingCx;
  track.bestCy   = track.pendingCy;

  if (track.pendingFrontalness > track.selectedFrontalness ||
      track.selectedJpeg == null) {
    track.selectedFrontalness = track.pendingFrontalness;
    track.selectedJpeg        = track.pendingJpeg;
    if (track.selectedJpeg != null &&
        track.pendingFrontalness >= trackSelectMinFrontalness) {
      onSelect(_toSelectedFace(track));
    }
  }
  _resetPending(track);
}

// ── Track management ───────────────────────────────────────────────────────────

void updateTracks(
  List<Detection> detections,
  FrameBuffer frame,
  List<TrackedFace> tracks,
  void Function(TrackedFace) onCommit,
) {
  final nowMs    = DateTime.now().millisecondsSinceEpoch;
  final available = List<TrackedFace>.from(tracks);

  for (final det in detections) {
    final box = det.boundingBox;
    final cx  = box.originX + box.width  / 2;
    final cy  = box.originY + box.height / 2;
    final nW  = box.width;
    final nH  = box.height;

    int    bestIdx  = -1;
    double bestDist = double.infinity;
    for (var i = 0; i < available.length; i++) {
      final dist = sqrt(
        pow(cx - available[i].cx, 2) + pow(cy - available[i].cy, 2),
      );
      if (dist < trackMatchThreshold && dist < bestDist) {
        bestDist = dist; bestIdx = i;
      }
    }

    TrackedFace track;
    if (bestIdx == -1) {
      track = createTrack(cx, cy, nW, nH, nowMs);
      tracks.add(track);
    } else {
      track = available[bestIdx];
      available.removeAt(bestIdx);
    }

    track
      ..cx        = cx
      ..cy        = cy
      ..lastSeenAt = nowMs
      ..dispCx    = cx
      ..dispCy    = cy
      ..dispW     = nW
      ..dispH     = nH;

    final frontalness = getFrontalness(det.keypoints, nW, nH) * det.score;
    track.currentFrontalness  = frontalness;
    track.smoothedFrontalness = track.smoothedFrontalness == 0
        ? frontalness
        : track.smoothedFrontalness * 0.7 + frontalness * 0.3;

    final confirmed = nowMs - track.createdAt >= trackConfirmMs;
    if (confirmed) {
      if (frontalness >= pendingConfirmThreshold) track.pendingConfirmedFrames++;

      if (track.smoothedFrontalness > track.pendingFrontalness ||
          track.pendingJpeg == null) {
        track.pendingFrontalness = track.smoothedFrontalness;
        track.pendingJpeg        =
            frame.cropFaceJpeg(cx, cy, nW, nH) ?? frame.toJpegBase64();
        track.pendingCx          = cx;
        track.pendingCy          = cy;
        track.pendingBw          = nW;
        track.pendingBh          = nH;
        track.pendingStaleFrames = 0;
      } else {
        track.pendingStaleFrames++;
        if (track.pendingStaleFrames >= 2 && track.pendingJpeg != null) {
          onCommit(track);
        }
      }
    }
  }

  for (final track in available) {
    track.pendingStaleFrames++;
    if (track.pendingStaleFrames >= 2 &&
        track.pendingFrontalness > track.bestFrontalness) {
      onCommit(track);
    }
  }
}

List<TrackedFace> flushStale(
  List<TrackedFace> tracks,
  void Function(TrackedFace) onCommit,
  void Function(String) onRemove,
) {
  final nowMs   = DateTime.now().millisecondsSinceEpoch;
  final removed = tracks.where((t) => nowMs - t.lastSeenAt >= trackStaleMs).toList();
  for (final t in removed) {
    if (t.pendingJpeg != null) onCommit(t);
    onRemove(t.id);
  }
  return tracks.where((t) => nowMs - t.lastSeenAt < trackStaleMs).toList();
}
