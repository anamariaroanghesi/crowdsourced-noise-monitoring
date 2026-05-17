import 'package:sqflite_common_ffi/sqflite_ffi.dart';

// Initialises sqflite to use the FFI implementation on macOS / Linux / Windows.
Future<void> initSqfliteForDesktop() async {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;
}
