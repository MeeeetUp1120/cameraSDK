import 'dart:convert';
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'face_tracker.dart' show FrameBuffer;

/// Camera-package FrameBuffer implementation.
///
/// Wraps raw JPEG bytes captured from CameraController.takePicture()
/// or a CameraImage converted to JPEG.
class ImageFrameBuffer implements FrameBuffer {
  ImageFrameBuffer(this._jpegBytes, this._width, this._height);

  final Uint8List _jpegBytes;
  final int       _width;
  final int       _height;

  late final img.Image? _decoded = img.decodeJpg(_jpegBytes);

  @override
  int get width  => _width;
  @override
  int get height => _height;

  @override
  String toJpegBase64({double quality = 0.85}) {
    final b64 = base64.encode(_jpegBytes);
    return 'data:image/jpeg;base64,$b64';
  }

  @override
  String? cropFaceJpeg(
    double cx,
    double cy,
    double bw,
    double bh, {
    double quality = 0.85,
  }) {
    final decoded = _decoded;
    if (decoded == null) return null;

    // Asymmetric padding — mirrors CanvasFrameBuffer in the web SDK
    const padX      = 0.4;
    const padTop    = 0.6;
    const padBottom = 0.2;

    final sx = ((cx - bw / 2) * _width  - bw * _width  * padX).clamp(0.0, _width  - 1.0).toInt();
    final sy = ((cy - bh / 2) * _height - bh * _height * padTop).clamp(0.0, _height - 1.0).toInt();
    final sw = (bw * _width  * (1 + padX * 2)).clamp(1.0, (_width  - sx).toDouble()).toInt();
    final sh = (bh * _height * (1 + padTop + padBottom)).clamp(1.0, (_height - sy).toDouble()).toInt();

    final cropped   = img.copyCrop(decoded, x: sx, y: sy, width: sw, height: sh);
    final resized   = img.copyResize(cropped, width: 256, height: 256);
    final jpegBytes = img.encodeJpg(resized, quality: (quality * 100).toInt());

    final b64 = base64.encode(jpegBytes);
    return 'data:image/jpeg;base64,$b64';
  }
}
