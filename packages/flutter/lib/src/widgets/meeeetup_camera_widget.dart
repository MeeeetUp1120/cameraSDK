import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../types.dart';
import '../session.dart';
import '../pipeline.dart';
import '../mlkit_detector.dart';
import '../frame_buffer.dart';
import 'face_overlay_painter.dart';

/// All-in-one camera widget for passive continuous face capture.
///
/// ```dart
/// MeeeetupCameraWidget(
///   apiBaseUrl:  'https://api.example.com',
///   token:       session.token,
///   sessionType: 'passive',
///   onSelect:    (face) => print('Selected: ${face.trackId}'),
///   onSessionExpired: () => Navigator.pushNamed(context, '/connect'),
/// )
/// ```
class MeeeetupCameraWidget extends StatefulWidget {
  const MeeeetupCameraWidget({
    required this.apiBaseUrl,
    required this.token,
    required this.sessionType,
    this.batchIntervalSeconds = 10,
    this.onSelect,
    this.onSessionExpired,
    this.onCameraNotFound,
    this.showCounter = true,
    this.showOverlay = true,
    super.key,
  });

  final String apiBaseUrl;
  final String token;

  /// 'passive' or 'interactive'
  final String sessionType;
  final int    batchIntervalSeconds;

  final void Function(SelectedFace face)? onSelect;
  final void Function()?                  onSessionExpired;
  final void Function()?                  onCameraNotFound;

  final bool showCounter;
  final bool showOverlay;

  @override
  State<MeeeetupCameraWidget> createState() => _MeeeetupCameraWidgetState();
}

class _MeeeetupCameraWidgetState extends State<MeeeetupCameraWidget> {
  CameraController?       _controller;
  FaceCaptureSession?     _session;
  MLKitFaceDetector?      _detector;

  bool   _ready   = false;
  String _error   = '';
  int    _tracked = 0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      final cameras = await availableCameras();
      final front   = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        front,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await controller.initialize();
      _controller = controller;

      _detector = MLKitFaceDetector();

      _session = FaceCaptureSession(
        apiBaseUrl:   widget.apiBaseUrl,
        token:        widget.token,
        sessionType:  widget.sessionType,
        onSelect:     (face) {
          widget.onSelect?.call(face);
        },
        onSessionExpired: widget.onSessionExpired,
        onCameraNotFound: widget.onCameraNotFound,
        onBatchSent: (_) {},
      );

      // Start image stream for real-time detection
      await controller.startImageStream(_onCameraImage);

      if (mounted) setState(() => _ready = true);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _onCameraImage(CameraImage image) async {
    final detector = _detector;
    final session  = _session;
    if (detector == null || session == null) return;

    try {
      // Convert CameraImage to InputImage for ML Kit
      final inputImage = _cameraImageToInputImage(image);
      final detections = await detector.detectFromInputImage(
        inputImage, image.width, image.height,
      );

      final jpegBytes = await _controller!.takePicture()
          .then((f) => f.readAsBytes())
          .catchError((_) => Uint8List(0));

      if (jpegBytes.isEmpty) return;

      final frame = ImageFrameBuffer(jpegBytes, image.width, image.height);
      session.processDetections(detections, frame);

      if (mounted) setState(() => _tracked = session.trackedCount);
    } catch (_) {
      // Ignore per-frame errors
    }
  }

  InputImage _cameraImageToInputImage(CameraImage image) {
    // Build the InputImage metadata required by ML Kit
    final rotation = InputImageRotation.rotation0deg; // adjust per device orientation
    final format   = InputImageFormatValue.fromRawValue(image.format.raw);

    return InputImage.fromBytes(
      bytes: image.planes.first.bytes,
      metadata: InputImageMetadata(
        size:     Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format:   format ?? InputImageFormat.yuv420,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  @override
  void dispose() {
    _controller?.stopImageStream();
    _controller?.dispose();
    _session?.dispose();
    _detector?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error.isNotEmpty) {
      return Center(
        child: Text(_error, style: const TextStyle(color: Colors.red)),
      );
    }

    if (!_ready || _controller == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Stack(
        fit: StackFit.expand,
        children: [
          CameraPreview(_controller!),

          if (widget.showCounter)
            Positioned(
              bottom: 10,
              left: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$_tracked ${_tracked == 1 ? 'face' : 'faces'}',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
