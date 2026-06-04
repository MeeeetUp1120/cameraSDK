import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:meeeetup_cam/meeeetup_cam.dart';

// ── Change this to your API URL ───────────────────────────────────────────────
const String kApiBaseUrl = 'http://localhost:4000';

void main() {
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'meeeetup-cam demo',
      theme: ThemeData.dark(useMaterial3: true),
      home: const RootScreen(),
    );
  }
}

// ── RootScreen: loads saved session, routes to connect or camera ──────────────
class RootScreen extends StatefulWidget {
  const RootScreen({super.key});
  @override
  State<RootScreen> createState() => _RootScreenState();
}

class _RootScreenState extends State<RootScreen> {
  CameraSession? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSavedSession();
  }

  Future<void> _loadSavedSession() async {
    final saved = await loadSession();
    setState(() { _session = saved; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_session == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0A0A0A),
        body: ConnectWidget(
          apiBaseUrl:  kApiBaseUrl,
          onConnected: (session) => setState(() => _session = session),
        ),
      );
    }

    return CameraScreen(
      session: _session!,
      onDisconnect: () async {
        await clearSession();
        setState(() => _session = null);
      },
    );
  }
}

// ── CameraScreen ──────────────────────────────────────────────────────────────
class CameraScreen extends StatefulWidget {
  const CameraScreen({
    required this.session,
    required this.onDisconnect,
    super.key,
  });
  final CameraSession session;
  final VoidCallback  onDisconnect;

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  final List<SelectedFace> _faces = [];

  void _onFaceSelected(SelectedFace face) {
    setState(() {
      final idx = _faces.indexWhere((f) => f.trackId == face.trackId);
      if (idx != -1) {
        _faces[idx] = face;
      } else {
        _faces.insert(0, face);
        if (_faces.length > 20) _faces.removeLast();
      }
    });
  }

  void _handleExpired() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Session expired — reconnecting')),
    );
    widget.onDisconnect();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.session.cameraName,
                style: const TextStyle(fontSize: 16)),
            Text(widget.session.type,
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: widget.onDisconnect,
            child: const Text('Disconnect',
                style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left: camera feed
            Expanded(
              flex: 3,
              child: MeeeetupCameraWidget(
                apiBaseUrl:       kApiBaseUrl,
                token:            widget.session.token,
                sessionType:      widget.session.type,
                showCounter:      true,
                onSelect:         _onFaceSelected,
                onSessionExpired: _handleExpired,
                onCameraNotFound: _handleExpired,
              ),
            ),

            const SizedBox(width: 16),

            // Right: captured face thumbnails
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Captured (${_faces.length})',
                    style: const TextStyle(
                        fontSize: 13,
                        color: Colors.grey,
                        fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: _faces.isEmpty
                        ? const Center(
                            child: Text('No faces yet',
                                style: TextStyle(
                                    color: Colors.grey, fontSize: 12)),
                          )
                        : GridView.builder(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount:    2,
                              crossAxisSpacing:  6,
                              mainAxisSpacing:   6,
                            ),
                            itemCount: _faces.length,
                            itemBuilder: (_, i) =>
                                _FaceThumbnail(face: _faces[i]),
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Face thumbnail tile ────────────────────────────────────────────────────────
class _FaceThumbnail extends StatelessWidget {
  const _FaceThumbnail({required this.face});
  final SelectedFace face;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: const Color(0xFF1A1A1A),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _Base64Image(dataUrl: face.dataUrl),
          Positioned(
            bottom: 4,
            right: 4,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${face.frontalness.toStringAsFixed(0)}%',
                style: TextStyle(
                  fontSize:   10,
                  fontWeight: FontWeight.bold,
                  color: face.frontalness >= 70
                      ? Colors.greenAccent
                      : Colors.orange,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Base64Image extends StatelessWidget {
  const _Base64Image({required this.dataUrl});
  final String dataUrl;

  @override
  Widget build(BuildContext context) {
    final commaIdx = dataUrl.indexOf(',');
    if (commaIdx == -1) return const ColoredBox(color: Color(0xFF2A2A2A));
    try {
      final bytes = base64.decode(dataUrl.substring(commaIdx + 1));
      return Image.memory(bytes, fit: BoxFit.cover);
    } catch (_) {
      return const ColoredBox(color: Color(0xFF2A2A2A));
    }
  }
}
