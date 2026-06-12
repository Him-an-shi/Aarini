import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flower } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export const SplashScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Animation values for smooth welcome fades
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Parallel animations: Fade in logo and scale up smoothly
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 10,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Once logo completes, fade in the brand texts
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        // Redirect to Login page after a calm 2-second pause
        const timer = setTimeout(() => {
          navigation.replace('Login');
        }, 2200);
        return () => clearTimeout(timer);
      });
    });
  }, [logoOpacity, logoScale, textOpacity, navigation]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.splashGradient}
        style={styles.background}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      >
        <View style={styles.content}>
          {/* Logo Animation */}
          <Animated.View
            style={[
              styles.logoContainer,
              { opacity: logoOpacity, transform: [{ scale: logoScale }] },
            ]}
          >
            <View style={styles.flowerIcon}>
              <Flower size={48} color={colors.primaryDark} strokeWidth={1.5} />
            </View>
          </Animated.View>

          {/* Text Fades */}
          <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
            <Text style={[typography.h1, styles.brandName]}>Aarini</Text>
            <Text style={[typography.bodyLarge, styles.tagline]}>
              Hormonal Wellness & Period Companion
            </Text>
          </Animated.View>

          {/* Safe Private Indicator */}
          <Animated.View style={[styles.footerContainer, { opacity: textOpacity }]}>
            <ActivityIndicator size="small" color={colors.primaryDark} style={styles.loader} />
            <Text style={[typography.caption, styles.secureLabel]}>
              🔒 Secure, private, and encrypted
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
};

const createStyles = ({ colors }) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 5,
  },
  flowerIcon: {
    backgroundColor: colors.cardBackground,
    padding: 24,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.border,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 8,
    color: colors.textDark,
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMedium,
    fontSize: 15,
    paddingHorizontal: 20,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  loader: {
    marginBottom: 12,
  },
  secureLabel: {
    color: colors.textLight,
  },
});
