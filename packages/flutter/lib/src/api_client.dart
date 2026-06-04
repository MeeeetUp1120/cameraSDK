import 'dart:convert';
import 'package:http/http.dart' as http;
import 'session.dart';
import 'types.dart';

class ApiClient {
  ApiClient({required this.baseUrl, required this.token});

  final String baseUrl;
  String token;

  /// Exchange a 6-char OTP for a JWT session.
  Future<CameraSession> connect(String otp) async {
    final res = await http.post(
      Uri.parse('$baseUrl/camera/connect'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'otp': otp.toUpperCase()}),
    );
    if (res.statusCode != 200 && res.statusCode != 201) {
      final body = json.decode(res.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Connect failed: ${res.statusCode}');
    }
    final body    = json.decode(res.body) as Map<String, dynamic>;
    token         = body['token'] as String;
    final session = sessionFromToken(token);
    return session;
  }

  /// Send a batch of face images. Returns the list of matched persons.
  Future<List<PersonResult>> capture(List<String> images) async {
    final res = await http.post(
      Uri.parse('$baseUrl/camera/capture'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({'images': images}),
    );
    if (res.statusCode != 200) {
      throw _ApiException(res.statusCode, 'Capture failed');
    }
    final body    = json.decode(res.body) as Map<String, dynamic>;
    final persons = (body['persons'] as List<dynamic>)
        .map((p) => PersonResult.fromJson(p as Map<String, dynamic>))
        .toList();
    return persons;
  }

  /// Heartbeat — verify the session is still active.
  Future<Map<String, dynamic>> heartbeat() async {
    final res = await http.get(
      Uri.parse('$baseUrl/camera/me'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) {
      throw _ApiException(res.statusCode, 'Heartbeat failed');
    }
    return json.decode(res.body) as Map<String, dynamic>;
  }
}

class _ApiException implements Exception {
  _ApiException(this.statusCode, this.message);
  final int statusCode;
  final String message;
  @override
  String toString() => 'ApiException($statusCode): $message';
}
