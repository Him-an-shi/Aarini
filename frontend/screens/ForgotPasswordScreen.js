import React, { useMemo, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, CheckCircle2, ChevronLeft } from 'lucide-react-native';

export const ForgotPasswordScreen = ({ navigation }) => {
  const { resetPassword, isLoading, error: authError } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleReset = async () => {
    if (!email) {
      setEmailError('Email is required.');
      return;
    }
    if (emailError) {
      return;
    }

    const success = await resetPassword(email);
    if (success) {
      setIsSuccess(true);
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
          {/* Custom Back Button */}
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.textDark} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Core Content */}
          <View style={styles.content}>
            {!isSuccess ? (
              // Phase 1: Request Form
              <View style={styles.card}>
                <View style={styles.iconBadge}>
                  <Mail size={24} color={colors.primaryDark} />
                </View>
                <Text style={[typography.h1, styles.title]}>Reset Password</Text>
                <Text style={[typography.bodyLarge, styles.subtitle]}>
                  Enter the email address linked with your Aarini profile, and we will dispatch a secure reset link.
                </Text>

                <InputField
                  label="EMAIL ADDRESS"
                  value={email}
                  onChangeText={validateEmail}
                  placeholder="e.g., jane@example.com"
                  keyboardType="email-address"
                  error={emailError || authError}
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleReset}
                  loading={isLoading}
                  style={styles.submitButton}
                />
              </View>
            ) : (
              // Phase 2: Recovery Link Sent Success Display
              <View style={[styles.card, styles.successCard]}>
                <View style={styles.successBadge}>
                  <CheckCircle2 size={40} color={colors.successDark} />
                </View>
                <Text style={[typography.h1, styles.title]}>Check Your Inbox</Text>
                <Text style={[typography.bodyLarge, styles.subtitle]}>
                  A password restoration link has been transmitted successfully to:{'\n'}
                  <Text style={styles.successEmail}>{email}</Text>
                </Text>
                <Text style={[typography.bodySmall, styles.noteText]}>
                  If you do not see the message in a couple of minutes, please check your spam folder.
                </Text>

                <Button
                  title="Return to Login"
                  onPress={() => navigation.navigate('Login')}
                  style={styles.submitButton}
                />
              </View>
            )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.textDark,
    fontWeight: '600',
    marginLeft: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  successCard: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  iconBadge: {
    backgroundColor: colors.mutedBackground,
    padding: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successBadge: {
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: 30,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textMedium,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  successEmail: {
    color: colors.textDark,
    fontWeight: '700',
  },
  noteText: {
    textAlign: 'center',
    color: colors.textLight,
    lineHeight: 18,
    backgroundColor: colors.mutedBackground,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    width: '100%',
  },
  submitButton: {
    width: '100%',
  },
});
