import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { ArrowLeft, Download, FileText, FileJson, Share2, Database } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { gatherAllData, exportAsJson, exportAsText, shareFile, getExportStats } from '../utils/exportData';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const ExportScreen = ({ navigation }) => {
  const { user, userToken } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(null);

  const apiFetch = useCallback(async (path) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
      'X-User-Id': user?.uid || 'mock_user_123',
    };
    return fetch(`${BACKEND_URL}${path}`, { headers });
  }, [userToken, user]);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getExportStats(user?.uid, apiFetch);
      setStats(s);
    } catch (err) {
      Alert.alert('Error', 'Could not gather data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  const handleExport = useCallback(async (format) => {
    setExporting(format);
    try {
      const data = await gatherAllData(user?.uid, apiFetch);
      const { path } = format === 'json' ? await exportAsJson(data) : await exportAsText(data);
      await shareFile(path);
    } catch (err) {
      Alert.alert('Export Error', err.message || 'Could not export data.');
    } finally {
      setExporting(null);
    }
  }, [user, apiFetch]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[typography.h2, styles.headerTitle]}>Export Health Data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Database size={24} color={colors.primaryDark} />
          <Text style={styles.infoText}>
            Download your complete health history for backup or sharing with a healthcare provider.
            Your export includes cycles, symptoms, mood entries, medications, and chat history.
          </Text>
        </View>

        <TouchableOpacity style={styles.previewButton} onPress={handlePreview} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <FileText size={18} color={colors.white} />
              <Text style={styles.previewText}>Preview Export Stats</Text>
            </>
          )}
        </TouchableOpacity>

        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Data Summary</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Cycle entries:</Text>
              <Text style={styles.statValue}>{stats.count.cycles}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Symptoms:</Text>
              <Text style={styles.statValue}>{stats.count.symptoms}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Mood logs:</Text>
              <Text style={styles.statValue}>{stats.count.moods}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Medications:</Text>
              <Text style={styles.statValue}>{stats.count.medications}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Chat messages:</Text>
              <Text style={styles.statValue}>{stats.count.messages}</Text>
            </View>
            <Text style={styles.statsDate}>
              Generated: {new Date(stats.generatedAt).toLocaleString()}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Export Formats</Text>

        <TouchableOpacity
          style={styles.exportCard}
          onPress={() => handleExport('json')}
          disabled={exporting !== null}
        >
          <View style={styles.exportIcon}>
            <FileJson size={22} color={colors.primaryDark} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>JSON Export</Text>
            <Text style={styles.exportDesc}>Machine-readable format for data portability</Text>
          </View>
          {exporting === 'json' ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Share2 size={18} color={colors.textLight} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exportCard}
          onPress={() => handleExport('text')}
          disabled={exporting !== null}
        >
          <View style={styles.exportIcon}>
            <FileText size={22} color={colors.secondaryDark} />
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Readable Report</Text>
            <Text style={styles.exportDesc}>Human-friendly text format for sharing or printing</Text>
          </View>
          {exporting === 'text' ? (
            <ActivityIndicator size="small" color={colors.secondaryDark} />
          ) : (
            <Download size={18} color={colors.textLight} />
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your data is exported as-is from local storage and server records.
          Exported files are unencrypted - handle them with care.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  backButton: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground },
  headerTitle: { flex: 1, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg, ...shadows.light },
  infoText: { flex: 1, ...typography.bodyMedium, color: colors.textDark, lineHeight: 20 },
  previewButton: { minHeight: 48, borderRadius: borderRadius.md, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: spacing.md },
  previewText: { ...typography.buttonText, color: colors.white },
  statsCard: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg, ...shadows.light },
  statsTitle: { ...typography.h3, marginBottom: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statLabel: { ...typography.bodyMedium, color: colors.textMedium },
  statValue: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '700' },
  statsDate: { ...typography.caption, color: colors.textLight, marginTop: spacing.sm },
  sectionTitle: { ...typography.h3, marginBottom: spacing.md },
  exportCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.light },
  exportIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  exportInfo: { flex: 1 },
  exportTitle: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '700' },
  exportDesc: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  disclaimer: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
});
