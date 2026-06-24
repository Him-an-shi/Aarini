import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppNavigator } from './navigation/AppNavigator';
import { ThemeToggle } from './components/ThemeToggle';

// Only import SpeedInsights on web platform
const SpeedInsights = Platform.OS === 'web' 
  ? require('@vercel/speed-insights/react').SpeedInsights 
  : null;

const AppContent = () => {
  const { isDark } = useTheme();

  return (
    <AuthProvider>
      <AppNavigator />
      <ThemeToggle />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </AuthProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
        {SpeedInsights && <SpeedInsights />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
