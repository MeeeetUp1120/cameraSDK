/// meeeetup_cam — Flutter face-capture SDK
///
/// Quick start:
/// ```dart
/// import 'package:meeeetup_cam/meeeetup_cam.dart';
///
/// // 1. Connect via OTP
/// ConnectWidget(
///   apiBaseUrl: 'https://api.example.com',
///   onConnected: (session) => setState(() => _session = session),
/// )
///
/// // 2. Passive camera (continuous capture)
/// MeeeetupCameraWidget(
///   apiBaseUrl:  'https://api.example.com',
///   token:       _session!.token,
///   sessionType: 'passive',
///   onSelect:    (face) => print(face.frontalness),
/// )
/// ```
library meeeetup_cam;

// Types
export 'src/types.dart';

// Session helpers
export 'src/session.dart'
    show loadSession, saveSession, clearSession, isTokenExpired, sessionFromToken;

// Geometry
export 'src/face_geometry.dart' show getFrontalness, nmsFilter, boxIoU;

// Face tracker
export 'src/face_tracker.dart'
    show
        FrameBuffer,
        TrackedFace,
        createTrack,
        commitPending,
        updateTracks,
        flushStale,
        trackMatchThreshold,
        trackStaleMs,
        boxDisplayMs;

// Detectors
export 'src/mlkit_detector.dart' show MLKitFaceDetector;
export 'src/tflite_detector.dart' show TFLiteBlazeFaceDetector;

// Frame buffer
export 'src/frame_buffer.dart' show ImageFrameBuffer;

// Pipeline
export 'src/pipeline.dart' show FaceCaptureSession;

// API client
export 'src/api_client.dart' show ApiClient;

// Widgets
export 'src/widgets/meeeetup_camera_widget.dart' show MeeeetupCameraWidget;
export 'src/widgets/connect_widget.dart' show ConnectWidget;
export 'src/widgets/face_overlay_painter.dart' show FaceOverlayPainter;
