export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  measured_db: number;
  quality_flag: string;
  timestamp: string;
}

export interface MapPointsResponse {
  points: MapPoint[];
  total: number;
  data_density: 'low' | 'sufficient';
}

export interface Statistics {
  total_count: number;
  valid_count: number;
  avg_db: number;
  min_db: number;
  max_db: number;
  percentile_50: number;
  percentile_95: number;
}

export interface GamificationProfile {
  user_id: string;
  total_points: number;
  level: number;
  level_name: string;
  current_streak: number;
  longest_streak: number;
  badges: Badge[];
}

export interface Badge {
  code: string;
  name: string;
  description: string;
  awarded_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  total_points: number;
  measurement_count: number;
  level: number;
  level_name: string;
}

export interface LeaderboardResponse {
  period: string;
  entries: LeaderboardEntry[];
}

export interface BadgeCatalogItem {
  code: string;
  name: string;
  description: string;
  points_reward: number;
  earned: boolean;
  awarded_at: string | null;
}
