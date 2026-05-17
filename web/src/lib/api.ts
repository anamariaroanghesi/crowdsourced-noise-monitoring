import axios from 'axios';
import { getToken, clearToken } from './auth';
import type {
  TokenResponse,
  User,
  MapPointsResponse,
  Statistics,
  GamificationProfile,
} from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT from cookie
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 by clearing token and redirecting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  async register(
    email: string,
    password: string,
    display_name: string
  ): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/auth/register', {
      email,
      password,
      display_name,
    });
    return res.data;
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/auth/login', { email, password });
    return res.data;
  },

  async me(): Promise<User> {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};

// ─── Map ─────────────────────────────────────────────────────────────────────

export const mapApi = {
  async getPoints(params: {
    time_window?: string;
    min_db?: number;
    max_db?: number;
  }): Promise<MapPointsResponse> {
    const res = await api.get<MapPointsResponse>('/map/points', { params });
    return res.data;
  },

  async getStatistics(params: { time_window?: string }): Promise<Statistics> {
    const res = await api.get<Statistics>('/map/statistics', { params });
    return res.data;
  },
};

// ─── Measurements ────────────────────────────────────────────────────────────

export const measurementsApi = {
  async getStatistics(): Promise<Statistics> {
    const res = await api.get<Statistics>('/measurements/statistics');
    return res.data;
  },
};

// ─── Gamification ────────────────────────────────────────────────────────────

export const gamificationApi = {
  async getProfile(): Promise<GamificationProfile> {
    const res = await api.get<GamificationProfile>('/gamification/profile');
    return res.data;
  },
};

export default api;
