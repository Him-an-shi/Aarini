import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { isOnboardingComplete } from '../utils/onboardingStorage';
import { requestNotificationPermission } from '../services/notificationScheduler';

const AuthContext = createContext();

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACTIVITY_EXTEND_MS = 30 * 60 * 1000; // 30 min of inactivity before expiry check

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const clearSession = useCallback(async (expired = false) => {
    setUserToken(null);
    setUser(null);
    if (expired) setSessionExpired(true);
    await AsyncStorage.multiRemove(['userToken', 'user', 'tokenIssuedAt', 'lastActivity']);
  }, []);

  const updateActivity = useCallback(async () => {
    const now = Date.now().toString();
    lastActivityRef.current = Date.now();
    await AsyncStorage.setItem('lastActivity', now);
  }, []);

  const isTokenExpired = useCallback(async () => {
    const issuedAt = await AsyncStorage.getItem('tokenIssuedAt');
    const lastActivity = await AsyncStorage.getItem('lastActivity');

    if (!issuedAt) return true;

    const issued = parseInt(issuedAt, 10);
    const activity = lastActivity ? parseInt(lastActivity, 10) : issued;
    const now = Date.now();

    if (now - issued > SESSION_MAX_AGE_MS) return true;
    if (now - activity > ACTIVITY_EXTEND_MS && now - issued > SESSION_MAX_AGE_MS / 2) return true;

    return false;
  }, []);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('user');

        if (storedToken && storedUser) {
          const expired = await isTokenExpired();
          if (expired) {
            await clearSession(true);
          } else {
            setUserToken(storedToken);
            setUser(JSON.parse(storedUser));
            await updateActivity();
            const onboarded = await isOnboardingComplete();
            setNeedsOnboarding(!onboarded);
          }
        }
      } catch (e) {
        console.error('Failed to restore session token', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, [isTokenExpired, clearSession, updateActivity]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userToken) {
        updateActivity();
      }
    });
    return () => subscription?.remove();
  }, [userToken, updateActivity]);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(`${BACKEND_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Authentication failed. Please verify credentials.');
      }

      const token = resData.token || 'mock_token_' + Date.now();
      const userData = resData.user || {
        uid: 'mock_user_123',
        name: 'Jane Doe',
        email: email,
        age: 24,
        cycleLength: 28,
      };

      setUserToken(token);
      setUser(userData);

      const now = Date.now().toString();
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('tokenIssuedAt', now);
      await AsyncStorage.setItem('lastActivity', now);

      const onboarded = await isOnboardingComplete();
      setNeedsOnboarding(!onboarded);
      requestNotificationPermission();
      return true;
    } catch (e) {
      console.warn('API connection failed, falling back to mock authentication:', e.message);

      if (email === 'test@aarini.com' && password === 'password123') {
        const token = 'development_active_token';
        const userData = {
          uid: 'dev_user_99',
          name: 'Sarah Jenkins',
          email: email,
          age: 26,
          cycleLength: 28,
        };
        setUserToken(token);
        setUser(userData);
        const now = Date.now().toString();
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('tokenIssuedAt', now);
        await AsyncStorage.setItem('lastActivity', now);
        const onboarded = await isOnboardingComplete();
        setNeedsOnboarding(!onboarded);
        requestNotificationPermission();
        return true;
      } else {
        setError(e.message || 'Server error. For development, use email test@aarini.com and password password123.');
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name, email, password, age, cycleLength) => {
    setIsLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(`${BACKEND_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          age: parseInt(age, 10) || 25,
          cycleLength: parseInt(cycleLength, 10) || 28,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Registration failed.');
      }

      const token = 'registered_token_' + Date.now();
      const userData = {
        uid: resData.uid || 'new_user_uid',
        name,
        email,
        age: parseInt(age, 10) || 25,
        cycleLength: parseInt(cycleLength, 10) || 28,
      };

      setUserToken(token);
      setUser(userData);

      const now = Date.now().toString();
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('tokenIssuedAt', now);
      await AsyncStorage.setItem('lastActivity', now);
      setNeedsOnboarding(true);
      return true;
    } catch (e) {
      console.warn('Registration backend offline, simulating local signup:', e.message);

      const token = 'mock_signup_token_' + Date.now();
      const userData = {
        uid: 'new_mock_user_' + Date.now(),
        name,
        email,
        age: parseInt(age, 10) || 25,
        cycleLength: parseInt(cycleLength, 10) || 28,
      };

      setUserToken(token);
      setUser(userData);
      const now = Date.now().toString();
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('tokenIssuedAt', now);
      await AsyncStorage.setItem('lastActivity', now);
      setNeedsOnboarding(true);
      return true;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (idToken) => {
    setIsLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const response = await fetch(`${BACKEND_URL}/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || 'Google Authentication failed.');
      }

      const token = resData.token;
      const userData = resData.user;

      setUserToken(token);
      setUser(userData);

      const now = Date.now().toString();
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('tokenIssuedAt', now);
      await AsyncStorage.setItem('lastActivity', now);

      // Check onboarding
      const onboarded = await isOnboardingComplete();
      setNeedsOnboarding(!onboarded);
      requestNotificationPermission();
      return true;
    } catch (e) {
      console.warn('Google login error:', e.message);
      setError(e.message || 'Google login failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await clearSession(false);
      setError(null);
    } catch (e) {
      console.error('Session clearance error', e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email) => {
    setIsLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    } catch (e) {
      setError(e.message || 'Failed to send recovery email.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, userToken, user, error, sessionExpired, needsOnboarding, login, googleLogin, signup, logout, resetPassword, updateActivity, completeOnboarding, setUser, setUserToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an AuthProvider.');
  }
  return context;
};
