import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Default backend URL (pre-configured with your machine's Wi-Fi IP for instant mobile connection)
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
export const DEFAULT_API_URL = configuredApiUrl || 'http://192.168.100.70:5000/api';

const webApiUrl = Platform.OS === 'web' && typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:5000/api`
  : DEFAULT_API_URL;
let currentBaseUrl = configuredApiUrl || webApiUrl;
const AUTH_TOKENS_KEY = '@routinecraft_auth_tokens';
let memoryAuthTokens = null;
let refreshPromise = null;
let rotationTimer = null;
let unauthorizedHandler = null;

const api = axios.create({
  baseURL: currentBaseUrl,
  timeout: 10000,
  withCredentials: Platform.OS === 'web',
  headers: {
    'Content-Type': 'application/json',
    ...(Platform.OS === 'web' ? { 'X-Auth-Transport': 'cookie' } : {}),
  },
});

// Initialize configured base URL from storage
export const initApiConfig = async () => {
  try {
    const savedUrl = await AsyncStorage.getItem('@routinecraft_api_url');
    if (savedUrl) {
      currentBaseUrl = savedUrl;
      api.defaults.baseURL = savedUrl;
    }
  } catch (e) {
    console.error('Failed to load API URL from storage', e);
  }
};

export const setApiBaseUrl = async (newUrl) => {
  try {
    currentBaseUrl = newUrl;
    api.defaults.baseURL = newUrl;
    await AsyncStorage.setItem('@routinecraft_api_url', newUrl);
  } catch (e) {
    console.error('Failed to save API URL to storage', e);
  }
};

export const getApiBaseUrl = () => currentBaseUrl;

const getStoredAuthTokens = async () => {
  if (Platform.OS === 'web') return memoryAuthTokens;

  const stored = await SecureStore.getItemAsync(AUTH_TOKENS_KEY);
  return stored ? JSON.parse(stored) : null;
};

const setStoredAuthTokens = async (tokens) => {
  if (Platform.OS === 'web') {
    memoryAuthTokens = tokens;
    return;
  }

  const serialized = JSON.stringify(tokens);
  await SecureStore.setItemAsync(AUTH_TOKENS_KEY, serialized);
};

export const clearAuthTokens = async () => {
  clearTimeout(rotationTimer);
  rotationTimer = null;
  if (Platform.OS === 'web') {
    memoryAuthTokens = null;
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
};

const scheduleRefreshRotation = (tokens) => {
  clearTimeout(rotationTimer);
  if (!tokens?.refreshTokenRotateAt) return;

  const delay = Math.max(1000, new Date(tokens.refreshTokenRotateAt).getTime() - Date.now());
  rotationTimer = setTimeout(async () => {
    try {
      await refreshAuthTokens();
    } catch (error) {
      if (error.response?.status !== 401) {
        const latestTokens = await getStoredAuthTokens();
        if (latestTokens?.refreshToken) {
          scheduleRefreshRotation({
            ...latestTokens,
            refreshTokenRotateAt: new Date(Date.now() + 60 * 1000).toISOString(),
          });
        }
      }
    }
  }, delay);
};

export const saveAuthTokens = async (tokens) => {
  await setStoredAuthTokens(tokens);
  scheduleRefreshRotation(tokens);
};

export const getAuthTokens = getStoredAuthTokens;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const refreshAuthTokens = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const cookieAuth = Platform.OS === 'web';
      const currentTokens = await getStoredAuthTokens();
      if (!cookieAuth && !currentTokens?.refreshToken) {
        const error = new Error('Refresh token is unavailable');
        error.response = { status: 401 };
        throw error;
      }

      const response = await axios.post(
        `${currentBaseUrl}/auth/refresh`,
        cookieAuth ? {} : { refreshToken: currentTokens.refreshToken },
        {
          timeout: 10000,
          withCredentials: cookieAuth,
          headers: {
            'Content-Type': 'application/json',
            ...(cookieAuth ? { 'X-Auth-Transport': 'cookie' } : {}),
          },
        }
      );
      const tokens = response.data.data;
      await saveAuthTokens(tokens);
      return tokens;
    })()
      .catch(async (error) => {
        if (error.response?.status === 401) {
          await clearAuthTokens();
          unauthorizedHandler?.();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const isPublicAuthRequest = (url = '') =>
  /\/auth\/(login|register|refresh)(\?|$)/.test(url);

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

// Refresh shortly before expiry and attach the latest access token.
api.interceptors.request.use(
  async (config) => {
    try {
      if (isPublicAuthRequest(config.url)) return config;

      let tokens = await getStoredAuthTokens();
      const mutatingMethod = ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase());
      if (
        mutatingMethod &&
        /\/(categories|logs)(\/|\?|$)/.test(config.url || '')
      ) {
        config.headers = config.headers || {};
        config.headers['Idempotency-Key'] ||= createIdempotencyKey();
      }

      if (Platform.OS === 'web') {
        config.withCredentials = true;
        config.headers = config.headers || {};
        config.headers['X-Auth-Transport'] = 'cookie';
        const accessExpiresAt = new Date(tokens?.accessTokenExpiresAt).getTime();
        const rotationAt = new Date(tokens?.refreshTokenRotateAt).getTime();
        if (
          tokens &&
          (accessExpiresAt <= Date.now() + 30 * 1000 || rotationAt <= Date.now())
        ) {
          await refreshAuthTokens();
        }
        return config;
      }

      if (tokens?.accessToken) {
        const expiresAt = new Date(tokens.accessTokenExpiresAt).getTime();
        if (!expiresAt || expiresAt <= Date.now() + 30 * 1000) {
          tokens = await refreshAuthTokens();
        }
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    } catch (e) {
      return Promise.reject(e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Retry a rejected access token once after refreshing the session.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      config &&
      !config._authRetry &&
      !isPublicAuthRequest(config.url) &&
      !config.url?.includes('/auth/logout')
    ) {
      config._authRetry = true;
      try {
        const tokens = await refreshAuthTokens();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      'Network error. Please verify backend server is running.';
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  refresh: refreshAuthTokens,
  getProfile: () => api.get('/auth/me'),
  updatePreferences: (preferences) => api.put('/auth/preferences', preferences),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) =>
    api.post('/auth/reset-password', { email, code, newPassword }),
};

export const appVersionAPI = {
  getLatest: () => api.get('/app-version'),
};

export const categoriesAPI = {
  getAll: (includeArchived = false) => api.get(`/categories?includeArchived=${includeArchived}`),
  getAnalytics: (id) => api.get(`/categories/${id}/analytics`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  toggleArchive: (id) => api.patch(`/categories/${id}/archive`),
  delete: (id) => api.delete(`/categories/${id}`),
  reorder: (orderedIds) => api.put('/categories/reorder', { orderedIds }),
};

export const logsAPI = {
  getByDate: (dateKey) => api.get(`/logs/date/${dateKey || ''}`),
  setProgress: (categoryId, dateKey, value, note) =>
    api.post('/logs/set', { categoryId, dateKey, value, note }),
  increment: (categoryId, dateKey, delta = 1) =>
    api.post('/logs/increment', { categoryId, dateKey, delta }),
  toggleCheck: (categoryId, dateKey) =>
    api.post('/logs/toggle-check', { categoryId, dateKey }),
  getRange: (startDate, endDate) =>
    api.get(`/logs/range?startDate=${startDate || ''}&endDate=${endDate || ''}`),
};

export const analyticsAPI = {
  getAnalytics: (timeframe = 'WEEKLY', year, month) => {
    let url = `/analytics?timeframe=${timeframe}`;
    if (year !== undefined) url += `&year=${year}`;
    if (month !== undefined) url += `&month=${month}`;
    return api.get(url);
  },
};

export default api;
