import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'types.dart';

const _kSessionKey = 'meeeetup_cam_session';

/// Decode a JWT payload without verification (client-side only).
Map<String, dynamic> decodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length < 2) throw FormatException('Invalid JWT');
  var payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/');
  // Add padding
  while (payload.length % 4 != 0) {
    payload += '=';
  }
  final decoded = utf8.decode(base64.decode(payload));
  return json.decode(decoded) as Map<String, dynamic>;
}

bool isTokenExpired(String token) {
  try {
    final payload = decodeJwtPayload(token);
    final exp = payload['exp'];
    if (exp == null) return false;
    return DateTime.now().millisecondsSinceEpoch / 1000 > (exp as num);
  } catch (_) {
    return true;
  }
}

CameraSession sessionFromToken(String token) {
  final p = decodeJwtPayload(token);
  return CameraSession(
    token:      token,
    projectId:  p['projectId']  as String,
    cameraId:   p['cameraId']   as String,
    cameraName: p['cameraName'] as String,
    type:       p['type']       as String,
  );
}

Future<CameraSession?> loadSession() async {
  final prefs = await SharedPreferences.getInstance();
  final raw   = prefs.getString(_kSessionKey);
  if (raw == null) return null;
  try {
    final map     = json.decode(raw) as Map<String, dynamic>;
    final session = CameraSession.fromJson(map);
    if (isTokenExpired(session.token)) {
      await clearSession();
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

Future<void> saveSession(CameraSession session) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_kSessionKey, json.encode(session.toJson()));
}

Future<void> clearSession() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_kSessionKey);
}
