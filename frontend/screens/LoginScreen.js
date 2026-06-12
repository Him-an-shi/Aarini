import React, { useMemo, useState } from 'react';
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
import { Sparkles } from 'lucide-react-native';

export const LoginScreen = ({ navigation }) => {
  const { login, isLoading, error: authError } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Validation state
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Email Validation regex
  const validateEmail = (text) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (text.trim() === '') {
      setEmailError('Email is required.');
    } else if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address.');
    } else {
      setEmailError(null);
    }
  };

  // Password validation
  const validatePassword = (text) => {
    setPassword(text);
    if (text.trim() === '') {
      setPasswordError('Password is required.');
    } else if (text.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
    } else {
      setPasswordError(null);
    }
  };

  const handleLogin = async () => {
    // Check if there are blank inputs
    let valid = true;
    if (!email) {
      setEmailError('Email is required.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }

    if (!valid || emailError || passwordError) {
      return;
    }

    const success = await login(email, password);
    if (!success) {
      Alert.alert('Login Error', authError || 'Failed to authenticate. Please check your credentials.');
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
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Sparkles size={24} color={colors.primaryDark} />
            </View>
            <Text style={[typography.h1, styles.title]}>Welcome Back</Text>
            <Text style={[typography.bodyLarge, styles.subtitle]}>
              Step into your safe, mindful wellness space.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <InputField
              label="EMAIL ADDRESS"
              value={email}
              onChangeText={validateEmail}
              placeholder="e.g., jane@example.com"
              keyboardType="email-address"
              error={emailError}
            />

            <InputField
              label="PASSWORD"
              value={password}
              onChangeText={validatePassword}
              placeholder="Enter your password"
              secureTextEntry={true}
              error={passwordError}
            />

            {/* Forgot Password Link */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.submitButton}
            />

            {/* Quick Demo Info banner */}
            <View style={styles.demoBanner}>
              <Text style={styles.demoText}>
                💡 Dev Mode: Use <Text style={{fontWeight: '700'}}>test@aarini.com</Text> with password <Text style={{fontWeight: '700'}}>password123</Text> for rapid testing!
              </Text>
            </View>
          </View>

          {/* Bottom Onboarding Switch Link */}
          <View style={styles.footer}>
            <Text style={[typography.bodyMedium, styles.footerText]}>
              New to Aarini?{' '}
            </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}
            >
              <Text style={styles.signupLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const createStyles = ({ colors, typography, spacing }) => StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
    paddingHorizontal: 20,
  },
  form: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginVertical: spacing.xs,
  },
  forgotText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: spacing.md,
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
