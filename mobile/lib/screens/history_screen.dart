import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/measurement.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../widgets/noise_indicator.dart';

class HistoryScreen extends StatefulWidget {
  final ApiService apiService;
  final StorageService storageService;

  const HistoryScreen({
    super.key,
    required this.apiService,
    required this.storageService,
  });

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Measurement> _measurements = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final remote = await widget.apiService.getMyMeasurements();
      setState(() => _measurements = remote);
    } catch (_) {
      // Fall back to local DB
      try {
        final local = await widget.storageService.getAll();
        setState(() => _measurements =
            local.map((r) => Measurement.fromLocalDb(r)).toList());
      } catch (e) {
        setState(() => _error = 'Could not load measurements.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Measurements'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _measurements.isEmpty
                  ? const Center(
                      child: Text(
                        'No measurements yet.\nTap "Measure" to get started.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _measurements.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final m = _measurements[i];
                        return Card(
                          child: ListTile(
                            leading: Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: colorForLevel(classifyDb(m.measuredDb))
                                    .withOpacity(0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Center(
                                child: Text(
                                  '${m.measuredDb.toStringAsFixed(0)} dB',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: colorForLevel(classifyDb(m.measuredDb)),
                                  ),
                                ),
                              ),
                            ),
                            title: Text(
                              labelForLevel(classifyDb(m.measuredDb)),
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              DateFormat('MMM d, yyyy – HH:mm')
                                  .format(m.timestamp.toLocal()),
                            ),
                            trailing: m.submitted
                                ? const Icon(Icons.cloud_done,
                                    color: Colors.green, size: 20)
                                : const Icon(Icons.cloud_upload_outlined,
                                    color: Colors.orange, size: 20),
                          ),
                        );
                      },
                    ),
    );
  }
}
