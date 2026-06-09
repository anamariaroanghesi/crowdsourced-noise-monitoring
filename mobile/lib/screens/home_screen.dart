import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import '../services/sync_service.dart';
import 'measure_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  final AuthService authService;
  final ApiService apiService;
  final StorageService storageService;

  const HomeScreen({
    super.key,
    required this.authService,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  late final SyncService _syncService;
  late final List<Widget> _tabs;
  StreamSubscription? _syncSub;

  @override
  void initState() {
    super.initState();
    _syncService = SyncService(widget.apiService, widget.storageService);
    _syncService.start();
    _syncSub = _syncService.onSyncComplete.listen(_onSyncComplete);
    _tabs = [
      MeasureScreen(
        apiService: widget.apiService,
        storageService: widget.storageService,
      ),
      HistoryScreen(
        apiService: widget.apiService,
        storageService: widget.storageService,
      ),
      ProfileScreen(
        authService: widget.authService,
        apiService: widget.apiService,
      ),
    ];
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    _syncService.dispose();
    super.dispose();
  }

  void _onSyncComplete(SyncResult result) {
    if (!mounted) return;
    final msg = result.totalPoints > 0
        ? '${result.synced} offline measurement${result.synced == 1 ? '' : 's'} synced · +${result.totalPoints} pts'
        : '${result.synced} offline measurement${result.synced == 1 ? '' : 's'} synced';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFF1a1a2e),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: _tabs,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.mic_none),
            selectedIcon: Icon(Icons.mic),
            label: 'Measure',
          ),
          NavigationDestination(
            icon: Icon(Icons.history),
            label: 'History',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
