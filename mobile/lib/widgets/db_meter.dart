import 'package:flutter/material.dart';
import 'noise_indicator.dart';

class DbMeter extends StatelessWidget {
  final double db;
  final bool isActive;

  const DbMeter({super.key, required this.db, required this.isActive});

  @override
  Widget build(BuildContext context) {
    final level = classifyDb(db);
    final color = colorForLevel(level);
    final clampedDb = db.clamp(20.0, 130.0);
    final fraction = (clampedDb - 20) / (130 - 20);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              width: 200,
              height: 200,
              child: CircularProgressIndicator(
                value: fraction,
                strokeWidth: 14,
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  db > 0 ? db.toStringAsFixed(1) : '--',
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.bold,
                    color: isActive ? color : Colors.grey,
                  ),
                ),
                const Text(
                  'dB',
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (db > 0) NoiseIndicator(db: db),
      ],
    );
  }
}
