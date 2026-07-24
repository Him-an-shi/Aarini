import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Switch, TextInput,
} from 'react-native';
import { ArrowLeft, Download, Share, Globe, Trash2, Archive, UploadCloud, Lock } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { createBackup, shareBackupFile, restoreFromBackup } from '../services/backupService';
import { Card } from '../components/Card';
import { isLockEnabled, setLockEnabled, setPIN, hasPINSet } from '../services/appLockService';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const SettingsScreen = ({ navigation }) => {
  const { userToken, user, logout } = useAuth();
  const { theme } = useTheme();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const { t, language, setLanguage, supportedLanguages } = useLanguage();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    isLockEnabled().then(setLockEnabledState);
  }, []);

  const handleExport = () => {
    navigation.navigate('ExportScreen');
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const result = await createBackup(user?.uid || 'local');
      await shareBackupFile(result.filePath);
      Alert.alert(t('common.success'), t('settings.backupSuccess', { count: result.entryCount }));
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('settings.backupFailed'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) {
        setRestoring(false);
        return;
      }
      const file = result.assets?.[0];
      if (!file) {
        setRestoring(false);
        return;
      }
      const content = await FileSystem.readAsStringAsync(file.uri);
      const userId = user?.uid || 'local';
      const restoreResult = await restoreFromBackup(content, userId);
      if (!restoreResult.success) {
        Alert.alert(t('common.error'), restoreResult.error);
      } else {
        Alert.alert(
          t('common.success'),
          t('settings.restoreSuccess', { count: restoreResult.restoredCount }),
        );
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('settings.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('settings.deleteWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const headers = { 'Content-Type': 'application/json' };
              if (userToken) {
                headers['Authorization'] = `Bearer ${userToken}`;
              } else {
                headers['X-User-Id'] = user?.uid || 'mock_user_123';
              }
              const resp = await fetch(`${API_BASE}/delete-account`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ confirm: true }),
              });
              const data = await resp.json();
              if (!resp.ok) {
                throw new Error(data.error || 'Deletion failed');
              }
              Alert.alert(t('common.success'), t('settings.deleteSuccess'), [
                { text: 'OK', onPress: () => logout() },
              ]);
            } catch (err) {
              Alert.alert(t('common.error'), err.message || t('settings.exportFailed'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {navigation?.canGoBack?.() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
              <ArrowLeft size={22} color={colors.textDark} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={[typography.h2, styles.headerTitle]}>{t('settings.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <Card
          icon={<Download size={20} color={colors.primaryDark} />}
          title={t('settings.exportData')}
          subtitle={t('settings.exportSubtitle')}
        >

          <Text style={styles.infoText}>
            {t('settings.exportInfo')}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.exportButton, styles.exportButtonPrimary]}
              onPress={() => navigation.navigate('ExportScreen')}
              accessibilityLabel={t('settings.exportData')}
            >
              <Download size={18} color={colors.textOnPrimary} />
              <Text style={styles.exportButtonTextPrimary}>{t('settings.readableReport')}</Text>
            </TouchableOpacity>
          </View>

          {lastExport && (
            <Text style={styles.successText}>
              {t('settings.exportSuccess', { count: lastExport.recordCount })}
            </Text>
          )}
        </Card>

        <Card
          icon={<Globe size={20} color={colors.primaryDark} />}
          title={t('settings.language')}
          subtitle={t('settings.languageSubtitle')}
        >

          <View style={styles.languageOptions}>
            {supportedLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.languageOption, language === lang.code && styles.languageOptionActive]}
                onPress={() => setLanguage(lang.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === lang.code }}
                accessibilityLabel={lang.label}
              >
                <Text style={[styles.languageOptionText, language === lang.code && styles.languageOptionTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Lock size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{t('appLock.settingsTitle')}</Text>
              <Text style={styles.cardSubtitle}>{t('appLock.settingsDesc')}</Text>
            </View>
            <Switch
              value={lockEnabled}
              onValueChange={async (val) => {
                if (val) {
                  const hasPin = await hasPINSet();
                  if (!hasPin) {
                    setShowPinSetup(true);
                    return;
                  }
                }
                await setLockEnabled(val);
                setLockEnabledState(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {showPinSetup && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <TextInput
                style={[styles.pinInput, { borderColor: colors.border, color: colors.text }]}
                placeholder={t('appLock.newPin')}
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/[^0-9]/g, ''))}
              />
              <TextInput
                style={[styles.pinInput, { borderColor: colors.border, color: colors.text }]}
                placeholder={t('appLock.confirmPin')}
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity
                style={[styles.exportButton, styles.exportButtonPrimary, { marginTop: 4 }]}
                onPress={async () => {
                  if (newPin.length !== 4) {
                    Alert.alert(t('common.error'), t('appLock.pinRequired'));
                    return;
                  }
                  if (newPin !== confirmPin) {
                    Alert.alert(t('common.error'), t('appLock.pinMismatch'));
                    return;
                  }
                  await setPIN(newPin);
                  await setLockEnabled(true);
                  setLockEnabledState(true);
                  setShowPinSetup(false);
                  setNewPin('');
                  setConfirmPin('');
                  Alert.alert(t('common.success'), t('appLock.pinSet'));
                }}
              >
                <Text style={styles.exportButtonTextPrimary}>{t('appLock.setPin')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {lockEnabled && !showPinSetup && (
            <TouchableOpacity
              style={[styles.exportButton, styles.exportButtonSecondary, { marginTop: 12 }]}
              onPress={() => setShowPinSetup(true)}
            >
              <Text style={styles.exportButtonTextSecondary}>{t('appLock.changePin')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Card
          icon={<Archive size={20} color={colors.primaryDark} />}
          title={t('settings.backup')}
          subtitle={t('settings.backupSubtitle')}
        >

          <Text style={styles.infoText}>
            {t('settings.backupInfo')}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.exportButton, styles.exportButtonPrimary]}
              onPress={handleBackup}
              disabled={backingUp}
              accessibilityLabel={t('settings.createBackup')}
            >
              {backingUp ? (
                <ActivityIndicator size="small" color={colors.textOnPrimary} />
              ) : (
                <>
                  <Archive size={18} color={colors.textOnPrimary} />
                  <Text style={styles.exportButtonTextPrimary}>{t('settings.createBackup')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportButton, styles.exportButtonSecondary]}
              onPress={handleRestore}
              disabled={restoring}
              accessibilityLabel={t('settings.restoreBackup')}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <>
                  <UploadCloud size={18} color={colors.primaryDark} />
                  <Text style={styles.exportButtonTextSecondary}>{t('settings.restoreBackup')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        <Card
          variant="danger"
          icon={<Trash2 size={20} color={colors.error || '#DC2626'} />}
          title={t('settings.deleteAccount')}
          subtitle={t('settings.deleteWarning')}
        >

          <Text style={styles.infoText}>
            This will permanently delete your profile, cycle history, symptom logs, mood entries,
            and any other stored health data. This action cannot be undone.
          </Text>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityLabel="Delete your account permanently"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Trash2 size={18} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>{t('settings.deleteAccount')}</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    backButton: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground },
    headerTitle: { flex: 1, textAlign: 'center' },
    card: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.light },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    cardIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.mutedBackground, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    cardSubtitle: { ...typography.bodySmall, color: colors.textMedium, marginTop: 2 },
    infoText: { ...typography.bodyMedium, color: colors.textMedium, marginBottom: spacing.md },
    buttonRow: { flexDirection: 'row', gap: spacing.sm },
    exportButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 12, borderRadius: borderRadius.md },
    exportButtonPrimary: { backgroundColor: colors.primaryDark },
    exportButtonSecondary: { backgroundColor: colors.mutedBackground, borderWidth: 1, borderColor: colors.border },
    exportButtonTextPrimary: { ...typography.buttonText, color: colors.textOnPrimary },
    exportButtonTextSecondary: { ...typography.buttonText, color: colors.primaryDark },
    successText: { ...typography.bodySmall, color: colors.successDark, marginTop: spacing.md, textAlign: 'center' },
    languageOptions: { flexDirection: 'row', gap: spacing.sm },
    languageOption: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.md, backgroundColor: colors.mutedBackground, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
    languageOptionActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    languageOptionText: { ...typography.buttonText, color: colors.textMedium },
    languageOptionTextActive: { color: colors.textOnPrimary },
    dangerCard: { borderWidth: 1, borderColor: colors.error || '#FCA5A5' },
    dangerIcon: { backgroundColor: (colors.error || '#DC2626') + '15' },
    deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.error || '#DC2626' },
    deleteButtonText: { ...typography.buttonText, color: '#FFFFFF' },
    pinInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, letterSpacing: 8, textAlign: 'center' },
  });
