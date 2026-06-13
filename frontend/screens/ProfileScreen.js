import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, User, Mail, Calendar, Activity, Pencil } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';

export const ProfileScreen = ({ navigation }) => {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit-mode form state, seeded from the current user object.
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [cycleLength, setCycleLength] = useState(
    user?.cycleLength != null ? String(user.cycleLength) : ''
  );
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!name.trim()) {
      next.name = 'Name cannot be empty';
    }
    const ageNum = parseInt(age, 10);
    if (!age || Number.isNaN(ageNum) || ageNum < 10 || ageNum > 100) {
      next.age = 'Enter a valid age between 10 and 100';
    }
    const cycleNum = parseInt(cycleLength, 10);
    if (!cycleLength || Number.isNaN(cycleNum) || cycleNum < 15 || cycleNum > 60) {
      next.cycleLength = 'Enter a cycle length between 15 and 60 days';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const ok = await updateProfile({
      name: name.trim(),
      age,
      cycleLength,
    });
    setSaving(false);
    if (ok) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    // Reset the form back to the stored values and leave edit mode.
    setName(user?.name || '');
    setAge(user?.age != null ? String(user.age) : '');
    setCycleLength(user?.cycleLength != null ? String(user.cycleLength) : '');
    setErrors({});
    setIsEditing(false);
  };

  const initial = (user?.name || 'A').trim().charAt(0).toUpperCase();

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            {navigation?.canGoBack?.() ? (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={styles.backButton}
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={22} color={colors.textDark} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <Text style={[typography.h2, styles.headerTitle]}>My Profile</Text>
            {!isEditing ? (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                activeOpacity={0.7}
                style={styles.editIconButton}
                accessibilityLabel="Edit profile"
              >
                <Pencil size={18} color={colors.primaryDark} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editIconButton} />
            )}
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={[typography.h3, styles.avatarName]}>{user?.name || 'Aarini User'}</Text>
            <Text style={[typography.bodyMedium, styles.avatarEmail]}>
              {user?.email || 'no email on file'}
            </Text>
          </View>

          {/* Content */}
          {!isEditing ? (
            <View style={styles.card}>
              <InfoRow
                icon={<User size={20} color={colors.primaryDark} />}
                label="Display name"
                value={user?.name || '—'}
              />
              <InfoRow
                icon={<Mail size={20} color={colors.primaryDark} />}
                label="Email"
                value={user?.email || '—'}
              />
              <InfoRow
                icon={<Calendar size={20} color={colors.primaryDark} />}
                label="Age"
                value={user?.age != null ? `${user.age} years` : '—'}
              />
              <InfoRow
                icon={<Activity size={20} color={colors.primaryDark} />}
                label="Typical cycle length"
                value={user?.cycleLength != null ? `${user.cycleLength} days` : '—'}
              />

              <Button
                title="Edit Profile"
                onPress={() => setIsEditing(true)}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.card}>
              <InputField
                label="Display name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                error={errors.name}
              />

              {/* Email is read-only — it is the account identifier. */}
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Email</Text>
                <View style={styles.readOnlyBox}>
                  <Text style={styles.readOnlyValue}>{user?.email || '—'}</Text>
                </View>
                <Text style={styles.readOnlyHint}>Email is linked to your account and can't be changed here.</Text>
              </View>

              <InputField
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 25"
                keyboardType="number-pad"
                error={errors.age}
              />
              <InputField
                label="Typical cycle length (days)"
                value={cycleLength}
                onChangeText={setCycleLength}
                placeholder="e.g. 28"
                keyboardType="number-pad"
                error={errors.cycleLength}
              />

              <Button
                title="Save Changes"
                onPress={handleSave}
                loading={saving}
                style={styles.actionButton}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={handleCancel}
                disabled={saving}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.round,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    editIconButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.round,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedBackground,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: borderRadius.round,
      backgroundColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      ...shadows.medium,
    },
    avatarText: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    avatarName: {
      marginBottom: spacing.xs,
    },
    avatarEmail: {
      color: colors.textMedium,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.light,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.mutedBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    infoTextWrap: {
      flex: 1,
    },
    infoLabel: {
      ...typography.bodySmall,
      color: colors.textLight,
      marginBottom: 2,
    },
    infoValue: {
      ...typography.bodyLarge,
      color: colors.textDark,
      fontWeight: '600',
    },
    actionButton: {
      marginTop: spacing.lg,
    },
    readOnlyField: {
      width: '100%',
      marginVertical: spacing.sm,
    },
    readOnlyLabel: {
      ...typography.bodySmall,
      color: colors.textMedium,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    readOnlyBox: {
      height: 56,
      borderRadius: borderRadius.md,
      backgroundColor: colors.mutedBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    readOnlyValue: {
      ...typography.bodyLarge,
      color: colors.textMedium,
    },
    readOnlyHint: {
      ...typography.bodySmall,
      color: colors.textLight,
      marginTop: spacing.xs,
      marginLeft: spacing.xs,
    },
  });
