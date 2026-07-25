import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useFormValidation } from '../hooks/useFormValidation';
import { validateEmail, validatePassword } from '../utils/validators';
import { Sparkles } from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export const LoginScreen = ({ navigation }) => {
  const { login, googleLogin, isLoading, error: authError, sessionExpired } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'dummy_client_id_for_dev', // Configure with actual ID in production
      offlineAccess: true,
    });
  }, []);

  const { errors, handleChange, handleBlur, validateAll, clearFieldError } = useFormValidation({
    email: (v) => validateEmail(v),
    password: (v) => validatePassword(v),
  });

  const handleLogin = async () => {
    const isValid = validateAll({ email, password });
    if (!isValid) return;

    const success = await login(email, password);
    if (!success) {
      Alert.alert(t('login.loginError'), authError || t('login.loginFailed'));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      if (idToken) {
        const success = await googleLogin(idToken);
        if (!success) {
          Alert.alert(t('login.loginError'), authError || t('login.loginFailed'));
        }
      } else {
        Alert.alert(t('login.loginError'), 'Could not get Google token');
      }
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(t('login.loginError'), 'Play services not available or outdated');
      } else {
        Alert.alert(t('login.loginError'), error.message || t('login.loginFailed'));
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <LinearGradient
        colors={theme.gradient}
        style={styles.background}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWrapper}>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.iconBadge} importantForAccessibility="no">
                <Sparkles size={24} color={colors.primaryDark} />
              </View>
              <Text style={[typography.h1, styles.title]}>{t('login.title')}</Text>
              <Text style={[typography.bodyLarge, styles.subtitle]}>
                {t('login.subtitle')}
              </Text>
              {sessionExpired && (
                <View
                  style={styles.sessionAlert}
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                >
                  <Text style={styles.sessionAlertText}>
                    {t('login.sessionExpired')}
                  </Text>
                </View>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <InputField
                label={t('login.emailLabel')}
                value={email}
                onChangeText={(text) => { setEmail(text); handleChange('email', text); }}
                onBlur={() => handleBlur('email', email)}
                placeholder={t('login.emailPlaceholder')}
                keyboardType="email-address"
                error={errors.email}
                containerStyle={styles.formField}
              />

              <InputField
                label={t('login.passwordLabel')}
                value={password}
                onChangeText={(text) => { setPassword(text); handleChange('password', text); }}
                onBlur={() => handleBlur('password', password)}
                placeholder={t('login.passwordPlaceholder')}
                secureTextEntry={true}
                error={errors.password}
                containerStyle={styles.formField}
              />

              <TouchableOpacity 
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotContainer}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={t('login.forgotPassword')}
              >
                <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
              </TouchableOpacity>

              <Button
                title={t('login.signIn')}
                onPress={handleLogin}
                loading={isLoading}
                style={styles.submitButton}
              />

              <Button
                title="Sign in with Google"
                onPress={handleGoogleLogin}
                loading={isLoading}
                style={[styles.submitButton, { marginTop: 12, backgroundColor: '#DB4437', borderColor: '#DB4437' }]}
              />

              <View style={styles.demoBanner} importantForAccessibility="no">
                <Text style={styles.demoText}>
                  {t('login.demoHint')}
                </Text>
              </View>
            </View>

            {/* Bottom Onboarding Switch Link */}
            <View style={styles.footer}>
              <Text style={[typography.bodyMedium, styles.footerText]}>
                {t('login.noAccount')}{' '}
              </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Signup')}
                activeOpacity={0.7}
                accessibilityRole="link"
                accessibilityLabel={t('login.createAccount')}
              >
                <Text style={styles.signupLink}>{t('login.createAccount')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const AUTH_FORM_MAX_WIDTH = 420;

const createStyles = ({ colors, typography, spacing }) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'web' ? spacing.xxl : 60,
    paddingBottom: spacing.xl,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: AUTH_FORM_MAX_WIDTH,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconBadge: {
    backgroundColor: colors.cardBackground,
    padding: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textMedium,
    paddingHorizontal: spacing.sm,
  },
  sessionAlert: {
    backgroundColor: colors.error,
    borderRadius: 8,
    padding: spacing.sm + spacing.xs,
    marginTop: spacing.sm + spacing.xs,
    width: '100%',
  },
  sessionAlertText: {
    color: colors.errorDark,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: spacing.lg,
    width: '100%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  formField: {
    marginVertical: 0,
    marginBottom: spacing.md,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  forgotText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  submitButton: {
    marginVertical: 0,
  },
  demoBanner: {
    backgroundColor: colors.mutedBackground,
    padding: spacing.sm,
    borderRadius: 12,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoText: {
    ...typography.bodySmall,
    color: colors.textOnSoft,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.textMedium,
  },
  signupLink: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
