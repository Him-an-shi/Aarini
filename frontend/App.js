import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppNavigator } from './navigation/AppNavigator';
import { ThemeToggle } from './components/ThemeToggle';

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
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
