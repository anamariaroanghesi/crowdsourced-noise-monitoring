import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/measurement.dart';

class StorageService {
  static Database? _db;

  Future<Database> get db async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final path = join(await getDatabasesPath(), 'noise_monitor.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pending_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            measured_db REAL NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            gps_accuracy REAL NOT NULL,
            timestamp TEXT NOT NULL,
            duration_seconds REAL NOT NULL,
            device_model TEXT,
            operating_system TEXT,
            app_version TEXT NOT NULL,
            submitted INTEGER NOT NULL DEFAULT 0
          )
        ''');
      },
    );
  }

  Future<int> savePending(Measurement m) async {
    final database = await db;
    return database.insert('pending_measurements', m.toLocalDb());
  }

  Future<List<Map<String, dynamic>>> getPending() async {
    final database = await db;
    return database.query(
      'pending_measurements',
      where: 'submitted = 0',
      orderBy: 'id ASC',
    );
  }

  Future<void> markSubmitted(int localId) async {
    final database = await db;
    await database.update(
      'pending_measurements',
      {'submitted': 1},
      where: 'id = ?',
      whereArgs: [localId],
    );
  }

  Future<List<Map<String, dynamic>>> getAll({int limit = 50}) async {
    final database = await db;
    return database.query(
      'pending_measurements',
      orderBy: 'id DESC',
      limit: limit,
    );
  }
}
