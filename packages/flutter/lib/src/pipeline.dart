import 'dart:async';
import 'api_client.dart';
import 'face_geometry.dart';
import 'face_tracker.dart';
import 'types.dart';

/// Orchestrates detection → tracking → quality selection → API sending.
///
/// Usage:
/// ```dart
/// final session = FaceCaptureSession(
///   apiBaseUrl: 'https://api.example.com',
///   token:      jwtToken,
///   sessionType: 'passive',
///   onSelect: (face) => setState(() => _faces.add(face)),
///   onSessionExpired: () => Navigator.pushNamed(context, '/connect'),
/// );
///
/// // Each camera frame:
/// session.processDetections(detections, frameBuffer);
///
/// // On dispose:
/// session.dispose();
/// ```
class FaceCaptureSession {
  FaceCaptureSession({
    required String apiBaseUrl,
    required String token,
    required this.sessionType,
    this.batchIntervalSeconds = 10,
    this.heartbeatIntervalSeconds = 30,
    this.onSelect,
    this.onTrackRemoved,
    this.onBatchSent,
    this.onSessionExpired,
    this.onCameraNotFound,
  }) : _api = ApiClient(baseUrl: apiBaseUrl, token: token) {
    if (sessionType == 'passive') {
      _batchTimer = Timer.periodic(
        Duration(seconds: batchIntervalSeconds),
        (_) => flushBatch(),
      );
    }
    _heartbeatTimer = Timer.periodic(
      Duration(seconds: heartbeatIntervalSeconds),
      (_) => _heartbeat(),
    );
    _heartbeat(); // immediate first check

    // Tick timer — flush stale tracks
    _tickTimer = Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
  }

  final String sessionType;
  final int    batchIntervalSeconds;
  final int    heartbeatIntervalSeconds;

  final void Function(SelectedFace face)? onSelect;
  final void Function(String trackId)?   onTrackRemoved;
  final void Function(int count)?        onBatchSent;
  final void Function()?                 onSessionExpired;
  final void Function()?                 onCameraNotFound;

  final ApiClient _api;

  final List<TrackedFace> _tracks = [];
  final List<SelectedFace> _buffer = [];

  Timer? _batchTimer;
  Timer? _heartbeatTimer;
  Timer? _tickTimer;

  int get trackedCount => _tracks.length;
  List<SelectedFace> get pendingFaces => List.unmodifiable(_buffer);

  // ── Public API ──────────────────────────────────────────────────────────────

  /// Feed one frame's ML Kit detections into the tracking pipeline.
  void processDetections(List<Detection> detections, FrameBuffer frame) {
    final valid = nmsFilter(detections);
    updateTracks(valid, frame, _tracks, (t) => commitPending(t, _onSelect));
  }

  /// Send all buffered faces to the API and clear the buffer.
  Future<void> flushBatch() async {
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final toSend = _buffer.where((f) => f.createdAt.millisecondsSinceEpoch < nowMs - 5000).toList();
    _buffer.removeWhere((f) => f.createdAt.millisecondsSinceEpoch < nowMs - 5000);
    if (toSend.isEmpty) return;
    try {
      await _api.capture(toSend.map((f) => f.dataUrl).toList());
      onBatchSent?.call(toSend.length);
    } catch (_) {
      // Put back on failure
      _buffer.insertAll(0, toSend);
    }
  }

  /// Release all timers. Call from State.dispose() or widget teardown.
  void dispose() {
    _batchTimer?.cancel();
    _heartbeatTimer?.cancel();
    _tickTimer?.cancel();
    _tracks.clear();
    _buffer.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  void _tick() {
    final updated = flushStale(
      _tracks,
      (t) => commitPending(t, _onSelect),
      (id) => onTrackRemoved?.call(id),
    );
    _tracks
      ..clear()
      ..addAll(updated);
  }

  void _onSelect(SelectedFace face) {
    final idx = _buffer.indexWhere((f) => f.trackId == face.trackId);
    if (idx != -1) {
      _buffer[idx] = face;
    } else {
      _buffer.insert(0, face);
    }
    onSelect?.call(face);
  }

  Future<void> _heartbeat() async {
    try {
      await _api.heartbeat();
    } catch (e) {
      if (e.toString().contains('401')) {
        onSessionExpired?.call();
      } else if (e.toString().contains('404')) {
        onCameraNotFound?.call();
      }
    }
  }
}
