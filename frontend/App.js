import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { NetworkProvider } from './context/NetworkContext';
import { AppNavigator } from './navigation/AppNavigator';
import { ThemeToggle } from './components/ThemeToggle';
import { AppLockGate } from './components/AppLockGate';
import { OfflineBanner } from './components/OfflineBanner';

const AppContent = () => {
  const { isDark } = useTheme();

  return (
    <AuthProvider>
      <AppLockGate>
        <OfflineBanner />
        <AppNavigator />
        <ThemeToggle />
      </AppLockGate>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </AuthProvider>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NetworkProvider>
            <AppContent />
          </NetworkProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
