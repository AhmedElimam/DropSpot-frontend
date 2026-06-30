import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const rt = await SecureStore.getItemAsync('refresh_token');
        if (!rt) throw new Error('no refresh');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: rt });
        const at = data.data.attributes.tokens.access_token;
        await SecureStore.setItemAsync('access_token', at);
        original.headers.Authorization = `Bearer ${at}`;
        return client(original);
      } catch {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        router.replace('/(auth)/login');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
