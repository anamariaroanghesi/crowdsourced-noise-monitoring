class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static const String appVersion = '1.0.0';

  // Bucharest bounding box
  static const double minLat = 44.3;
  static const double maxLat = 44.6;
  static const double minLon = 25.9;
  static const double maxLon = 26.3;

  // Noise level thresholds in dB
  static const double quietMax = 50.0;
  static const double moderateMax = 70.0;
  static const double loudMax = 85.0;

  // Measurement settings
  static const int measurementDurationSeconds = 10;
  static const int sampleRateHz = 44100;
}
