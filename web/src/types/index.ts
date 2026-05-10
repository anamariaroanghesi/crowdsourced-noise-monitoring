export interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
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
