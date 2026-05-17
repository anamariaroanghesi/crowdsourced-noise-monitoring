import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:noise_meter/noise_meter.dart';
import 'package:permission_handler/permission_handler.dart';

class NoiseMeasurementResult {
  final double meanDb;
  final double maxDb;
  final double minDb;
  final int sampleCount;

  const NoiseMeasurementResult({
    required this.meanDb,
    required this.maxDb,
    required this.minDb,
    required this.sampleCount,
  });
}

// noise_meter only has a native implementation on iOS and Android.
bool get _nativeMicAvailable =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS);

class NoiseService {
  NoiseMeter? _noiseMeter;
  StreamSubscription<NoiseReading>? _subscription;

  final _dbStreamController = StreamController<double>.broadcast();
  Stream<double> get dbStream => _dbStreamController.stream;

  Future<bool> requestPermission() async {
    if (!_nativeMicAvailable) return true;
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  Future<NoiseMeasurementResult?> measure(int durationSeconds) async {
    if (!_nativeMicAvailable) {
      return _simulateWithStream(durationSeconds);
    }

    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    final readings = <double>[];
    final completer = Completer<NoiseMeasurementResult>();

    _noiseMeter = NoiseMeter();
    _subscription = _noiseMeter!.noise.listen(
      (NoiseReading reading) {
        final db = reading.meanDecibel;
        if (db.isFinite && db > 0) {
          readings.add(db);
          _dbStreamController.add(db);
        }
      },
      onError: (_) {
        if (!completer.isCompleted) completer.complete(_buildResult(readings));
      },
    );

    await Future.delayed(Duration(seconds: durationSeconds));
    await _subscription?.cancel();
    _subscription = null;

    if (!completer.isCompleted) completer.complete(_buildResult(readings));
    return completer.future;
  }

  // Simulates a measurement with animated ticks for macOS / web / emulators.
  Future<NoiseMeasurementResult> _simulateWithStream(int durationSeconds) async {
    final rng = Random();
    final base = 45.0 + rng.nextDouble() * 30.0; // 45–75 dB
    final readings = <double>[];
    final ticks = durationSeconds * 4;

    for (var i = 0; i < ticks; i++) {
      await Future.delayed(const Duration(milliseconds: 250));
      final db = base + rng.nextDouble() * 6 - 3;
      readings.add(db);
      if (!_dbStreamController.isClosed) _dbStreamController.add(db);
    }
    return _buildResult(readings);
  }

  NoiseMeasurementResult _buildResult(List<double> readings) {
    if (readings.isEmpty) {
      return const NoiseMeasurementResult(
          meanDb: 0, maxDb: 0, minDb: 0, sampleCount: 0);
    }
    final linearSum =
        readings.fold<double>(0, (s, db) => s + pow(10, db / 10).toDouble());
    final meanLinear = linearSum / readings.length;
    final meanDb = 10 * log(meanLinear) / ln10;
    return NoiseMeasurementResult(
      meanDb: double.parse(meanDb.toStringAsFixed(1)),
      maxDb: readings.reduce(max),
      minDb: readings.reduce(min),
      sampleCount: readings.length,
    );
  }

  void dispose() {
    _subscription?.cancel();
    _dbStreamController.close();
  }
}
