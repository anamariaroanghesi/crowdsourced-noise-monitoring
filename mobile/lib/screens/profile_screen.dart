import 'package:flutter/material.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ProfileScreen extends StatefulWidget {
  final AuthService authService;
  final ApiService apiService;

  const ProfileScreen({
    super.key,
    required this.authService,
    required this.apiService,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  GamificationProfile? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final profile = await widget.apiService.getProfile();
      if (mounted) setState(() => _profile = profile);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await widget.authService.logout();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, '/login');
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.authService.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
            tooltip: 'Log out',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // User card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          const CircleAvatar(
                            radius: 36,
                            backgroundColor: Color(0xFF1a1a2e),
                            child: Icon(Icons.person, color: Colors.white, size: 36),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            user?.displayName ?? '',
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            user?.email ?? '',
                            style: const TextStyle(color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Gamification card
                  if (_profile != null) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _profile!.levelName,
                                      style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF1a1a2e)),
                                    ),
                                    Text(
                                      'Level ${_profile!.level}',
                                      style: const TextStyle(color: Colors.grey),
                                    ),
                                  ],
                                ),
                                Chip(
                                  label: Text(
                                    '${_profile!.totalPoints} pts',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white),
                                  ),
                                  backgroundColor: const Color(0xFF1a1a2e),
                                ),
                              ],
                            ),
                            const Divider(height: 24),
                            Row(
                              children: [
                                _statItem(
                                    Icons.local_fire_department,
                                    '${_profile!.currentStreak}',
                                    'day streak',
                                    Colors.orange),
                                const SizedBox(width: 24),
                                _statItem(
                                    Icons.emoji_events,
                                    '${_profile!.longestStreak}',
                                    'best streak',
                                    Colors.amber),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Badges
                    if (_profile!.badges.isNotEmpty) ...[
                      const Text(
                        'Badges',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _profile!.badges
                            .map((b) => Chip(
                                  avatar: const Icon(Icons.military_tech,
                                      size: 16),
                                  label: Text(b.name,
                                      style: const TextStyle(fontSize: 12)),
                                  backgroundColor: Colors.amber[50],
                                ))
                            .toList(),
                      ),
                    ],
                  ],
                ],
              ),
            ),
    );
  }

  Widget _statItem(
      IconData icon, String value, String label, Color color) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}
