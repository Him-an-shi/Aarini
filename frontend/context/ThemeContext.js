import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_THEME, LIGHT_THEME } from '../constants/theme';

const THEME_STORAGE_KEY = 'aariniThemePreference';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState(systemScheme === 'dark' ? 'dark' : 'light');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    const restoreTheme = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode === 'light' || storedMode === 'dark') {
          setMode(storedMode);
        }
      } catch (error) {
        console.warn('Failed to restore theme preference', error);
      } finally {
        setIsThemeReady(true);
      }
    };

    restoreTheme();
  }, []);

  const setTheme = useCallback(async (nextMode) => {
    if (nextMode !== 'light' && nextMode !== 'dark') {
      return;
    }

    setMode(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (error) {
      console.warn('Failed to persist theme preference', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setTheme]);

  const value = useMemo(() => {
    const theme = mode === 'dark' ? DARK_THEME : LIGHT_THEME;

    return {
      theme,
      mode,
      isDark: mode === 'dark',
      isThemeReady,
      setTheme,
      toggleTheme,
    };
  }, [isThemeReady, mode, setTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }

  return context;
};
