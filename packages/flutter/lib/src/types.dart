/// Shared data types for the meeeetup_cam SDK.

class CameraSession {
  const CameraSession({
    required this.token,
    required this.projectId,
    required this.cameraId,
    required this.cameraName,
    required this.type,
  });

  final String token;
  final String projectId;
  final String cameraId;
  final String cameraName;

  /// Either 'interactive' or 'passive'.
  final String type;

  factory CameraSession.fromJson(Map<String, dynamic> json) => CameraSession(
        token:      json['token']      as String,
        projectId:  json['projectId']  as String,
        cameraId:   json['cameraId']   as String,
        cameraName: json['cameraName'] as String,
        type:       json['type']       as String,
      );

  Map<String, dynamic> toJson() => {
        'token':      token,
        'projectId':  projectId,
        'cameraId':   cameraId,
        'cameraName': cameraName,
        'type':       type,
      };
}

/// Normalised face detection — all coordinates 0–1 relative to frame size.
/// Keypoint index contract: [0]=rightEye [1]=leftEye [2]=noseTip
class Detection {
  const Detection({
    required this.boundingBox,
    required this.keypoints,
    required this.score,
  });

  final BoundingBox boundingBox;
  final List<Keypoint> keypoints;
  final double score;
}

class BoundingBox {
  const BoundingBox({
    required this.originX,
    required this.originY,
    required this.width,
    required this.height,
  });

  final double originX;
  final double originY;
  final double width;
  final double height;
}

class Keypoint {
  const Keypoint({required this.x, required this.y});
  final double x;
  final double y;
}

class SelectedFace {
  const SelectedFace({
    required this.trackId,
    required this.dataUrl,
    required this.frontalness,
    required this.lastSentAt,
    required this.createdAt,
  });

  final String trackId;

  /// base64 JPEG data URI: data:image/jpeg;base64,<data>
  final String dataUrl;

  /// 0–100
  final double frontalness;

  final DateTime lastSentAt;

  final DateTime createdAt;
}

class PersonResult {
  const PersonResult({
    required this.id,
    required this.name,
    required this.status,
  });

  final String id;
  final String? name;
  final String status;

  factory PersonResult.fromJson(Map<String, dynamic> json) => PersonResult(
        id:     json['id']     as String,
        name:   json['name']   as String?,
        status: json['status'] as String,
      );
}
