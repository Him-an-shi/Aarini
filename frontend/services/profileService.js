import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const PROFILE_CACHE_KEY = '@aarini_profile_cache';

export async function getProfile(token, userId) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-User-Id': userId || 'mock_user_123',
  };
  try {
    const res = await fetch(`${BACKEND_URL}/profile`, { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    const data = await res.json();
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) return JSON.parse(cached);
    throw new Error('Unable to load profile');
  }
}

export async function updateProfile(token, userId, updates) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-User-Id': userId || 'mock_user_123',
  };
  const res = await fetch(`${BACKEND_URL}/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile');
  return data;
}

export async function updateLocalProfile(updates) {
  const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (cached) {
    const merged = { ...JSON.parse(cached), ...updates };
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(merged));
  }
}
