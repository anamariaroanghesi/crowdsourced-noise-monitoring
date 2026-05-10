import 'package:flutter/material.dart';
import '../config/app_config.dart';

enum NoiseLevel { quiet, moderate, loud, veryLoud }

NoiseLevel classifyDb(double db) {
  if (db < AppConfig.quietMax) return NoiseLevel.quiet;
  if (db < AppConfig.moderateMax) return NoiseLevel.moderate;
  if (db < AppConfig.loudMax) return NoiseLevel.loud;
  return NoiseLevel.veryLoud;
}

Color colorForLevel(NoiseLevel level) {
  switch (level) {
    case NoiseLevel.quiet:
      return const Color(0xFF22c55e);
    case NoiseLevel.moderate:
      return const Color(0xFFeab308);
    case NoiseLevel.loud:
      return const Color(0xFFf97316);
    case NoiseLevel.veryLoud:
      return const Color(0xFFef4444);
  }
}

String labelForLevel(NoiseLevel level) {
  switch (level) {
    case NoiseLevel.quiet:
      return 'Quiet';
    case NoiseLevel.moderate:
      return 'Moderate';
    case NoiseLevel.loud:
      return 'Loud';
    case NoiseLevel.veryLoud:
      return 'Very Loud';
  }
}

class NoiseIndicator extends StatelessWidget {
  final double db;

  const NoiseIndicator({super.key, required this.db});

  @override
  Widget build(BuildContext context) {
    final level = classifyDb(db);
    final color = colorForLevel(level);
    final label = labelForLevel(level);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        border: Border.all(color: color, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}
