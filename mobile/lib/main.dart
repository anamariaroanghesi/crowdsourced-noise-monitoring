import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/storage_service.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const NoiseMonitorApp());
}

class NoiseMonitorApp extends StatelessWidget {
  const NoiseMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiService = ApiService();
    final authService = AuthService(apiService);
    final storageService = StorageService();

    return MaterialApp(
      title: 'Noise Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1a1a2e),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1a1a2e),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (ctx) => SplashScreen(authService: authService),
        '/login': (ctx) => LoginScreen(authService: authService),
        '/register': (ctx) => RegisterScreen(authService: authService),
        '/home': (ctx) => HomeScreen(
              authService: authService,
              apiService: apiService,
              storageService: storageService,
            ),
      },
    );
  }
}
