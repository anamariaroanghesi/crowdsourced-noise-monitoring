class Measurement {
  final String? id;
  final double measuredDb;
  final double latitude;
  final double longitude;
  final double gpsAccuracy;
  final DateTime timestamp;
  final double durationSeconds;
  final String? deviceModel;
  final String? operatingSystem;
  final String appVersion;
  final String? qualityFlag;
  final int pointsEarned;
  bool submitted;

  Measurement({
    this.id,
    required this.measuredDb,
    required this.latitude,
    required this.longitude,
    required this.gpsAccuracy,
    required this.timestamp,
    required this.durationSeconds,
    this.deviceModel,
    this.operatingSystem,
    required this.appVersion,
    this.qualityFlag,
    this.pointsEarned = 0,
    this.submitted = false,
  });

  Map<String, dynamic> toJson() => {
        'measured_db': measuredDb,
        'latitude': latitude,
        'longitude': longitude,
        'gps_accuracy': gpsAccuracy,
        'timestamp': timestamp.toUtc().toIso8601String(),
        'duration_seconds': durationSeconds,
        if (deviceModel != null) 'device_model': deviceModel,
        if (operatingSystem != null) 'operating_system': operatingSystem,
        'app_version': appVersion,
      };

  factory Measurement.fromJson(Map<String, dynamic> json) => Measurement(
        id: json['id'] as String?,
        measuredDb: (json['measured_db'] as num).toDouble(),
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        gpsAccuracy: (json['gps_accuracy'] as num).toDouble(),
        timestamp: DateTime.parse(json['timestamp'] as String),
        durationSeconds: (json['duration_seconds'] as num).toDouble(),
        qualityFlag: json['quality_flag'] as String?,
        pointsEarned: (json['points_earned'] as int?) ?? 0,
        appVersion: json['app_version'] as String? ?? '1.0.0',
        submitted: true,
      );

  Map<String, dynamic> toLocalDb() => {
        'measured_db': measuredDb,
        'latitude': latitude,
        'longitude': longitude,
        'gps_accuracy': gpsAccuracy,
        'timestamp': timestamp.toIso8601String(),
        'duration_seconds': durationSeconds,
        'device_model': deviceModel,
        'operating_system': operatingSystem,
        'app_version': appVersion,
        'submitted': submitted ? 1 : 0,
      };

  factory Measurement.fromLocalDb(Map<String, dynamic> row) => Measurement(
        measuredDb: (row['measured_db'] as num).toDouble(),
        latitude: (row['latitude'] as num).toDouble(),
        longitude: (row['longitude'] as num).toDouble(),
        gpsAccuracy: (row['gps_accuracy'] as num).toDouble(),
        timestamp: DateTime.parse(row['timestamp'] as String),
        durationSeconds: (row['duration_seconds'] as num).toDouble(),
        deviceModel: row['device_model'] as String?,
        operatingSystem: row['operating_system'] as String?,
        appVersion: row['app_version'] as String? ?? '1.0.0',
        submitted: (row['submitted'] as int) == 1,
      );
}
