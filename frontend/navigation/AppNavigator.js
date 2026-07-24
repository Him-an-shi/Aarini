import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, Smile, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { CycleTrackerScreen } from '../screens/CycleTrackerScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { MoodTrackingScreen } from '../screens/MoodTrackingScreen';
import { SymptomLogScreen } from '../screens/SymptomLogScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { ExportScreen } from '../screens/ExportScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { NotificationPrefsScreen } from '../screens/NotificationPrefsScreen';
import { MedicationScreen } from '../screens/MedicationScreen';
import { CycleDetailScreen } from '../screens/CycleDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const AppTabs = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={CycleTrackerScreen}
        options={{
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Mood"
        component={MoodTrackingScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Smile size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const AppStack = ({ initialRoute = 'Tabs' }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    <Stack.Screen name="Tabs" component={AppTabs} />
    <Stack.Screen name="SymptomLog" component={SymptomLogScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
    <Stack.Screen name="Medication" component={MedicationScreen} />
    <Stack.Screen name="HealthDashboard" component={HealthDashboardScreen} />
    <Stack.Screen name="Achievements" component={AchievementsScreen} />
    <Stack.Screen name="Share" component={ShareScreen} />
    <Stack.Screen name="ExportScreen" component={ExportScreen} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { userToken, isLoading, needsOnboarding } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigationTheme = useMemo(() => ({
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      ...theme.navigation.colors,
    },
  }), [theme]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={theme.typography.bodyMedium}>Synchronizing wellness state...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {userToken ? <AppStack initialRoute={needsOnboarding ? 'Onboarding' : 'Tabs'} /> : <AuthStack />}
    </NavigationContainer>
  );
};

const createStyles = ({ colors }) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
