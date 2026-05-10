import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../models/measurement.dart';
import '../models/user.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  final String _baseUrl = AppConfig.apiBaseUrl;
  String? _token;

  void setToken(String? token) => _token = token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    final response = await http
        .post(
          Uri.parse('$_baseUrl$path'),
          headers: _headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 15));

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException(
        data['detail']?.toString() ?? 'Request failed',
        statusCode: response.statusCode,
      );
    }
    return data;
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await http
        .get(Uri.parse('$_baseUrl$path'), headers: _headers)
        .timeout(const Duration(seconds: 15));

    final data = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      throw ApiException(
        (data as Map<String, dynamic>)['detail']?.toString() ??
            'Request failed',
        statusCode: response.statusCode,
      );
    }
    return data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register(
      String email, String password, String displayName) async {
    return _post('/auth/register', {
      'email': email,
      'password': password,
      'display_name': displayName,
    });
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    return _post('/auth/login', {'email': email, 'password': password});
  }

  Future<User> getMe() async {
    final data = await _get('/auth/me');
    return User.fromJson(data);
  }

  Future<Measurement> submitMeasurement(Measurement m) async {
    final data = await _post('/measurements', m.toJson());
    return Measurement.fromJson(data);
  }

  Future<List<Measurement>> getMyMeasurements({
    int skip = 0,
    int limit = 20,
  }) async {
    final data = await _get('/measurements/me?skip=$skip&limit=$limit');
    final items = data['items'] as List<dynamic>;
    return items
        .map((e) => Measurement.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<GamificationProfile> getProfile() async {
    final data = await _get('/gamification/profile');
    return GamificationProfile.fromJson(data);
  }
}
