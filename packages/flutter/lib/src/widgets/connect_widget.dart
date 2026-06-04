import 'package:flutter/material.dart';
import '../api_client.dart';
import '../session.dart';
import '../types.dart';

/// OTP entry screen for connecting a camera client.
///
/// ```dart
/// ConnectWidget(
///   apiBaseUrl: 'https://api.example.com',
///   onConnected: (session) {
///     // save session, navigate to camera
///   },
/// )
/// ```
class ConnectWidget extends StatefulWidget {
  const ConnectWidget({
    required this.apiBaseUrl,
    required this.onConnected,
    this.onError,
    this.initialOtp,
    super.key,
  });

  final String apiBaseUrl;
  final void Function(CameraSession session) onConnected;
  final void Function(Object error)?         onError;
  final String?                              initialOtp;

  @override
  State<ConnectWidget> createState() => _ConnectWidgetState();
}

class _ConnectWidgetState extends State<ConnectWidget> {
  late final TextEditingController _otpController =
      TextEditingController(text: widget.initialOtp?.toUpperCase() ?? '');

  bool   _connecting = false;
  String _error      = '';

  Future<void> _connect() async {
    final otp = _otpController.text.trim().toUpperCase();
    if (otp.length < 6) return;

    setState(() { _connecting = true; _error = ''; });
    try {
      final client  = ApiClient(baseUrl: widget.apiBaseUrl, token: '');
      final session = await client.connect(otp);
      await saveSession(session);
      widget.onConnected(session);
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
      widget.onError?.call(e);
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Connect Camera',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the 6-character code shown in the Meeeetup admin panel.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),

              TextField(
                controller:  _otpController,
                maxLength:   6,
                textAlign:   TextAlign.center,
                textCapitalization: TextCapitalization.characters,
                style: const TextStyle(
                  fontSize:      28,
                  letterSpacing: 12,
                  fontFamily:    'monospace',
                ),
                decoration: InputDecoration(
                  hintText:    'ABC123',
                  counterText: '',
                  border:  OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onChanged: (v) => _otpController.value =
                    _otpController.value.copyWith(text: v.toUpperCase()),
              ),
              const SizedBox(height: 12),

              if (_error.isNotEmpty)
                Text(_error, style: const TextStyle(color: Colors.red)),

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _connecting ||
                          _otpController.text.length < 6
                      ? null
                      : _connect,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: _connecting
                      ? const SizedBox(
                          height: 20,
                          width:  20,
                          child:  CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Connect', style: TextStyle(fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
