import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ArrowLeft, Save, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { getProfile, updateProfile, updateLocalProfile } from '../services/profileService';

const CYCLE_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 20);

export const ProfileScreen = ({ navigation }) => {
  const { user, userToken, setUser } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getProfile(userToken, user?.uid);
        setName(profile.name || user?.name || '');
        setAge(String(profile.age || user?.age || ''));
        setCycleLength(profile.cycleLength || user?.cycleLength || 28);
      } catch {
        setName(user?.name || '');
        setAge(String(user?.age || ''));
        setCycleLength(user?.cycleLength || 28);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userToken, user]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (age && (isNaN(ageNum) || ageNum < 10 || ageNum > 120)) {
      setError('Please enter a valid age');
      return;
    }
    setError(null);
    setSaving(true);
    const updates = { name: name.trim(), age: ageNum || null, cycleLength };
    try {
      const result = await updateProfile(userToken, user?.uid, updates);
      const updatedUser = { ...user, ...result.profile };
      setUser(updatedUser);
      await updateLocalProfile(updates);
      Alert.alert(t('common.success'), 'Profile updated successfully');
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }, [name, age, cycleLength, userToken, user, navigation, t, setUser]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {navigation?.canGoBack?.() ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
                <ArrowLeft size={22} color={colors.textDark} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <Text style={[typography.h2, styles.headerTitle]}>{t('profile.title')}</Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <User size={36} color={colors.primaryDark} />
            </View>
            <Text style={[typography.h2, styles.userName]}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>{t('profile.nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('signup.namePlaceholder')}
              placeholderTextColor={colors.textLight}
              autoCapitalize="words"
              accessibilityLabel={t('profile.nameLabel')}
            />

            <Text style={styles.inputLabel}>{t('profile.ageLabel')}</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="e.g., 28"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              accessibilityLabel={t('profile.ageLabel')}
            />

            <Text style={styles.inputLabel}>{t('profile.cycleLengthLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {CYCLE_OPTIONS.map((len) => (
                <TouchableOpacity
                  key={len}
                  onPress={() => setCycleLength(len)}
                  style={[styles.pickerChip, len === cycleLength && styles.pickerChipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: len === cycleLength }}
                  accessibilityLabel={`${len} days`}
                >
                  <Text style={[styles.pickerChipText, len === cycleLength && styles.pickerChipTextActive]}>
                    {len}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {error && (
              <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Save size={18} color={colors.textOnPrimary} />
                  <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backButton: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground },
  headerTitle: { flex: 1, textAlign: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  userName: { color: colors.textDark, marginBottom: 4 },
  userEmail: { ...typography.bodyMedium, color: colors.textMedium },
  card: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.light },
  inputLabel: { ...typography.bodySmall, color: colors.textDark, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textDark, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  pickerRow: { paddingVertical: spacing.sm },
  pickerChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardBackground, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  pickerChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  pickerChipText: { ...typography.bodyMedium, fontWeight: '600', color: colors.textMedium },
  pickerChipTextActive: { color: colors.textOnPrimary },
  errorText: { ...typography.bodySmall, color: colors.errorDark, marginTop: spacing.sm },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.primaryDark, marginTop: spacing.lg },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { ...typography.buttonText, color: colors.textOnPrimary },
});
