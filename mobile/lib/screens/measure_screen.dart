import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import '../config/app_config.dart';
import '../models/measurement.dart';
import '../services/api_service.dart';
import '../services/noise_service.dart';
import '../services/location_service.dart';
import '../services/storage_service.dart';
import '../widgets/db_meter.dart';

enum MeasureState { idle, measuring, submitting, done, error }

class MeasureScreen extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const MeasureScreen({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<MeasureScreen> createState() => _MeasureScreenState();
}

class _MeasureScreenState extends State<MeasureScreen> {
  final _noiseService = NoiseService();
  final _locationService = LocationService();

  MeasureState _state = MeasureState.idle;
  double _currentDb = 0;
  String? _statusMessage;
  Measurement? _lastMeasurement;

  @override
  void initState() {
    super.initState();
    _noiseService.dbStream.listen((db) {
      if (mounted && _state == MeasureState.measuring) {
        setState(() => _currentDb = db);
      }
    });
  }

  @override
  void dispose() {
    _noiseService.dispose();
    super.dispose();
  }

  Future<void> _startMeasurement() async {
    setState(() {
      _state = MeasureState.measuring;
      _statusMessage = 'Measuring for ${AppConfig.measurementDurationSeconds} seconds...';
      _currentDb = 0;
    });

    final position = await _locationService.getCurrentPosition();
    if (position == null) {
      setState(() {
        _state = MeasureState.error;
        _statusMessage = 'Could not get GPS location. Check permissions.';
      });
      return;
    }

    final result = await _noiseService.measure(AppConfig.measurementDurationSeconds);
    if (result == null || result.meanDb <= 0) {
      setState(() {
        _state = MeasureState.error;
        _statusMessage = 'Could not measure sound. Check microphone permissions.';
      });
      return;
    }

    setState(() {
      _state = MeasureState.submitting;
      _statusMessage = 'Submitting...';
      _currentDb = result.meanDb;
    });

    final deviceInfo = DeviceInfoPlugin();
    String? deviceModel;
    String? os;

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      final android = await deviceInfo.androidInfo;
      deviceModel = android.model;
      os = 'Android ${android.version.release}';
    } else if (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS) {
      final ios = await deviceInfo.iosInfo;
      deviceModel = ios.model;
      os = 'iOS ${ios.systemVersion}';
    }

    final pkgInfo = await PackageInfo.fromPlatform();

    final measurement = Measurement(
      measuredDb: result.meanDb,
      latitude: position.latitude,
      longitude: position.longitude,
      gpsAccuracy: position.accuracy,
      timestamp: DateTime.now(),
      durationSeconds: AppConfig.measurementDurationSeconds.toDouble(),
      deviceModel: deviceModel,
      operatingSystem: os,
      appVersion: pkgInfo.version,
    );

    final connectivity = await Connectivity().checkConnectivity();
    final hasInternet = connectivity != ConnectivityResult.none;

    if (hasInternet) {
      try {
        final submitted = await widget.apiService.submitMeasurement(measurement);
        setState(() {
          _state = MeasureState.done;
          _lastMeasurement = submitted;
          _statusMessage = 'Submitted! ${result.meanDb.toStringAsFixed(1)} dB recorded.';
        });
      } catch (e) {
        await widget.storageService.savePending(measurement);
        setState(() {
          _state = MeasureState.done;
          _statusMessage = 'Saved offline. Will submit when online.';
        });
      }
    } else {
      await widget.storageService.savePending(measurement);
      setState(() {
        _state = MeasureState.done;
        _statusMessage = 'No internet. Saved locally for later submission.';
      });
    }
  }

  void _reset() => setState(() {
        _state = MeasureState.idle;
        _statusMessage = null;
        _currentDb = 0;
        _lastMeasurement = null;
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Measure Noise'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Safety warning banner
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber[50],
                  border: Border.all(color: Colors.amber),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.warning_amber, color: Colors.amber),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Do not use while driving. Stay safe.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Expanded(
                child: Center(
                  child: DbMeter(
                    db: _currentDb,
                    isActive: _state == MeasureState.measuring,
                  ),
                ),
              ),
              if (_statusMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  _statusMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
              const SizedBox(height: 24),
              if (_state == MeasureState.idle)
                ElevatedButton.icon(
                  onPressed: _startMeasurement,
                  icon: const Icon(Icons.mic),
                  label: const Text('Start Measurement'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1a1a2e),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                )
              else if (_state == MeasureState.measuring)
                ElevatedButton.icon(
                  onPressed: null,
                  icon: const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2),
                  ),
                  label: const Text('Measuring...'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                )
              else if (_state == MeasureState.done ||
                  _state == MeasureState.error)
                ElevatedButton.icon(
                  onPressed: _reset,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Measure Again'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1a1a2e),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 52),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
