/// TFLite BlazeFace alternative detector.
///
/// Uncomment in pubspec.yaml:
///   tflite_flutter: ^0.10.4
///
/// Place the model file in assets/blaze_face_short_range.tflite
/// and declare it in pubspec.yaml under flutter.assets.
///
/// This file is intentionally thin — it converts TFLite raw output
/// into [Detection] objects compatible with the rest of the pipeline.

// ignore_for_file: unused_import
import 'types.dart';

// Stub class — uncomment the implementation below once tflite_flutter is added.
class TFLiteBlazeFaceDetector {
  TFLiteBlazeFaceDetector._();

  static Future<TFLiteBlazeFaceDetector> create({
    String modelAsset = 'assets/blaze_face_short_range.tflite',
  }) async {
    throw UnimplementedError(
      'Add tflite_flutter to pubspec.yaml and implement TFLiteBlazeFaceDetector.',
    );
  }

  Future<List<Detection>> detect(
    // ignore: avoid_unused_constructor_parameters
    List<int> jpegBytes,
    int frameWidth,
    int frameHeight,
  ) async {
    throw UnimplementedError();
  }

  void dispose() {}
}

/*
// ──────────────────────────────────────────────────────────────────────────────
// Full implementation (requires tflite_flutter: ^0.10.4 in pubspec.yaml)
// ──────────────────────────────────────────────────────────────────────────────

import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:image/image.dart' as img;

class TFLiteBlazeFaceDetector {
  TFLiteBlazeFaceDetector._(this._interpreter);
  final Interpreter _interpreter;

  static Future<TFLiteBlazeFaceDetector> create({
    String modelAsset = 'assets/blaze_face_short_range.tflite',
  }) async {
    final interpreter = await Interpreter.fromAsset(modelAsset);
    return TFLiteBlazeFaceDetector._(interpreter);
  }

  Future<List<Detection>> detect(
    List<int> jpegBytes,
    int frameWidth,
    int frameHeight,
  ) async {
    // Decode + resize to 128×128 (BlazeFace short-range input size)
    final decoded = img.decodeImage(jpegBytes);
    if (decoded == null) return [];
    final resized = img.copyResize(decoded, width: 128, height: 128);

    // Normalise to [-1, 1]
    final input = List.generate(128, (y) =>
      List.generate(128, (x) {
        final pixel = resized.getPixel(x, y);
        return [
          (img.getRed(pixel)   / 127.5) - 1.0,
          (img.getGreen(pixel) / 127.5) - 1.0,
          (img.getBlue(pixel)  / 127.5) - 1.0,
        ];
      }),
    );

    // Run inference — output shape depends on model version
    // For short-range: [1, 896, 16] boxes + [1, 896, 1] scores
    final outputBoxes  = List.filled(1 * 896 * 16, 0.0).reshape([1, 896, 16]);
    final outputScores = List.filled(1 * 896,      0.0).reshape([1, 896, 1]);

    _interpreter.runForMultipleInputs(
      [input],
      {0: outputBoxes, 1: outputScores},
    );

    // Decode anchors + apply sigmoid → Detection list
    // (anchor decoding omitted for brevity — use the official BlazeFace post-processing)
    return [];
  }

  void dispose() => _interpreter.close();
}
*/
