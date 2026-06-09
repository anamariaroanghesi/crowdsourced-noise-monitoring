import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';
import 'storage_service.dart';
import '../models/measurement.dart';

class SyncResult {
  final int synced;
  final int totalPoints;
  const SyncResult({required this.synced, required this.totalPoints});
  bool get hasWork => synced > 0;
}

class SyncService {
  final ApiService _api;
  final StorageService _storage;

  StreamSubscription? _connectivitySub;
  bool _syncing = false;

  // Broadcast stream so HomeScreen can show a snackbar
  final _resultController = StreamController<SyncResult>.broadcast();
  Stream<SyncResult> get onSyncComplete => _resultController.stream;

  SyncService(this._api, this._storage);

  void start() {
    if (kIsWeb) return;
    // Try once on startup (in case items were queued in a previous session)
    _trySync();
    // Then listen for connectivity changes
    _connectivitySub = Connectivity().onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) _trySync();
    });
  }

  void _trySync() {
    if (!_syncing) _doSync();
  }

  Future<void> _doSync() async {
    _syncing = true;
    try {
      final pending = await _storage.getPending();
      if (pending.isEmpty) return;

      int synced = 0;
      int totalPoints = 0;

      for (final row in pending) {
        final localId = row['id'] as int;
        final measurement = Measurement.fromLocalDb(row);
        try {
          final submitted = await _api.submitMeasurement(measurement);
          await _storage.markSubmitted(localId);
          synced++;
          totalPoints += submitted.pointsEarned;
        } catch (_) {
          // Leave it pending; will retry on next connectivity event
        }
      }

      if (synced > 0) {
        _resultController.add(SyncResult(synced: synced, totalPoints: totalPoints));
      }
    } finally {
      _syncing = false;
    }
  }

  /// Call to manually trigger a sync (e.g. after user returns to the app).
  Future<void> syncNow() async => _doSync();

  void dispose() {
    _connectivitySub?.cancel();
    _resultController.close();
  }
}
