import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';

// Import Screens
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';

// Stack instances
const Stack = createStackNavigator();

// Temporary Dashboard Placeholder to complete the Authentication flow beautifully
const DashboardPlaceholder = () => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <View style={styles.dashboardContent}>
        <Text style={[typography.caption, styles.tag]}>🌿 MVP CORE ACTIVE</Text>
        <Text style={[typography.h1, styles.title]}>Hello, {user?.name || 'Jane'} ✨</Text>
        <Text style={[typography.bodyLarge, styles.subtitle]}>
          Welcome to your customized Aarini hormonal wellness space.
        </Text>

        <View style={styles.card}>
          <Text style={[typography.h3, styles.cardTitle]}>Cycle Status Calibration</Text>
          <View style={styles.specRow}>
            <Text style={typography.bodyMedium}>Age Profile:</Text>
            <Text style={styles.specVal}>{user?.age || '25'} years old</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={typography.bodyMedium}>Typical Cycle Length:</Text>
            <Text style={styles.specVal}>{user?.cycleLength || '28'} days</Text>
          </View>
          <Text style={styles.successNote}>
            ✓ Authentication and Session state have successfully synced with Firestore and local caches.
          </Text>
        </View>

        <Button 
          title="Sign Out" 
          variant="outline"
          onPress={logout} 
          style={[styles.logoutBtn, { borderColor: colors.secondaryDark }]}
        />
      </View>
    </SafeAreaView>
  );
};

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard" component={DashboardPlaceholder} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { userToken, isLoading } = useAuth();
  const { theme } = useTheme();
  const { typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigationTheme = useMemo(() => ({
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      ...theme.navigation.colors,
    },
  }), [theme]);

  // Simple clean Loading page while checking storage token restore
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={typography.bodyMedium}>Synchronizing wellness state...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {userToken ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const createStyles = ({ colors, isDark, typography, spacing }) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dashboardContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tag: {
    color: colors.primaryDark,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 0,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textMedium,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: spacing.lg,
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: spacing.xl,
  },
  cardTitle: {
    marginBottom: spacing.md,
    color: colors.textDark,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specVal: {
    ...typography.bodyMedium,
    color: colors.textDark,
    fontWeight: '700',
  },
  successNote: {
    ...typography.bodySmall,
    color: colors.textMedium,
    lineHeight: 18,
    backgroundColor: isDark ? colors.mutedBackground : colors.success,
    borderWidth: 1,
    borderColor: isDark ? colors.border : colors.success,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  logoutBtn: {
    borderColor: colors.secondaryDark,
  },
});
