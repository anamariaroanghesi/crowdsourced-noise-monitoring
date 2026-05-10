class User {
  final String id;
  final String email;
  final String displayName;
  final String role;

  const User({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        displayName: json['display_name'] as String,
        role: json['role'] as String,
      );
}

class GamificationProfile {
  final String userId;
  final int totalPoints;
  final int level;
  final String levelName;
  final int currentStreak;
  final int longestStreak;
  final List<BadgeItem> badges;

  const GamificationProfile({
    required this.userId,
    required this.totalPoints,
    required this.level,
    required this.levelName,
    required this.currentStreak,
    required this.longestStreak,
    required this.badges,
  });

  factory GamificationProfile.fromJson(Map<String, dynamic> json) =>
      GamificationProfile(
        userId: json['user_id'] as String,
        totalPoints: json['total_points'] as int,
        level: json['level'] as int,
        levelName: json['level_name'] as String,
        currentStreak: json['current_streak'] as int,
        longestStreak: json['longest_streak'] as int,
        badges: (json['badges'] as List<dynamic>)
            .map((b) => BadgeItem.fromJson(b as Map<String, dynamic>))
            .toList(),
      );
}

class BadgeItem {
  final String code;
  final String name;
  final String description;
  final DateTime awardedAt;

  const BadgeItem({
    required this.code,
    required this.name,
    required this.description,
    required this.awardedAt,
  });

  factory BadgeItem.fromJson(Map<String, dynamic> json) => BadgeItem(
        code: json['code'] as String,
        name: json['name'] as String,
        description: json['description'] as String,
        awardedAt: DateTime.parse(json['awarded_at'] as String),
      );
}
