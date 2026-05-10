import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  final ApiService _api;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _tokenKey = 'access_token';

  User? _currentUser;
  User? get currentUser => _currentUser;
  bool get isLoggedIn => _currentUser != null;

  AuthService(this._api);

  Future<void> init() async {
    final token = await _storage.read(key: _tokenKey);
    if (token != null) {
      _api.setToken(token);
      try {
        _currentUser = await _api.getMe();
      } catch (_) {
        await _clearSession();
      }
    }
  }

  Future<User> register(
      String email, String password, String displayName) async {
    final data = await _api.register(email, password, displayName);
    return _handleAuthResponse(data);
  }

  Future<User> login(String email, String password) async {
    final data = await _api.login(email, password);
    return _handleAuthResponse(data);
  }

  Future<void> logout() async {
    await _clearSession();
  }

  Future<User> _handleAuthResponse(Map<String, dynamic> data) async {
    final token = data['access_token'] as String;
    await _storage.write(key: _tokenKey, value: token);
    _api.setToken(token);
    _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
    return _currentUser!;
  }

  Future<void> _clearSession() async {
    await _storage.delete(key: _tokenKey);
    _api.setToken(null);
    _currentUser = null;
  }
}
