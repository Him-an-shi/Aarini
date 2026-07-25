import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Plus, Check, Activity } from 'lucide-react-native';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useFormValidation } from '../hooks/useFormValidation';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const SYMPTOMS = [
  'Cramps', 'Headache', 'Bloating', 'Fatigue',
  'Acne', 'Nausea', 'Mood swings', 'Breast tenderness',
];

const SEVERITIES = ['mild', 'moderate', 'severe'];
const VALID_SEVERITIES = new Set(['mild', 'moderate', 'severe']);

const getDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const SymptomLogScreen = ({ navigation }) => {
  const { user, userToken } = useAuth();
  const { theme } = useTheme();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selected, setSelected] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const formValidation = useFormValidation({
    symptom: (v) => !v ? 'Please select a symptom.' : null,
    severity: (v) => !v ? 'Please select a severity level.' : null,
  });

  // Form is valid only when a symptom and a valid severity are both chosen
  const isFormValid = Boolean(selected && severity && VALID_SEVERITIES.has(severity));

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`,
    'X-User-Id': user?.uid || 'mock_user_123',
  }), [user?.uid, userToken]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/symptoms?uid=${user?.uid || 'mock_user_123'}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data.slice(0, 10) : (data.symptoms || []).slice(0, 10));
      }
    } catch {
      // Offline - show empty
    } finally {
      setLoading(false);
    }
  }, [headers, user?.uid]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submit = async () => {
    const isValid = formValidation.validateAll({ symptom: selected, severity });
    if (!isValid) return;
    setSaving(true);
    try {
      await fetch(`${BACKEND_URL}/add-symptom`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: user?.uid || 'mock_user_123',
          type: selected,
          severity,
          date: getDateKey(),
        }),
      });
      setHistory((prev) => [{ type: selected, severity, date: getDateKey() }, ...prev].slice(0, 10));
      setSelected(null);
      setSeverity(null);
    } catch {
      // Silently fail - entry not saved
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          {navigation?.canGoBack?.() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
              <ArrowLeft size={22} color={colors.textDark} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={[typography.h2, styles.headerTitle]}>Log Symptoms</Text>
          <View style={styles.backButton} />
        </View>

        {/* Symptom selector */}
        <Card
          title="What are you experiencing?"
          subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        >
          <View style={styles.chipGrid}>
            {SYMPTOMS.map((s) => {
              const isActive = selected === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    setSelected(isActive ? null : s);
                    if (errors.symptom) setErrors((e) => ({ ...e, symptom: undefined }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.chipText, isActive && { color: colors.primaryDark, fontWeight: '600' }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
            {errors.symptom ? (
            <Text style={styles.errorText} accessibilityRole="alert">{errors.symptom}</Text>
          ) : null}
        </Card>

        {/* Severity */}
        {selected && (
          <Card title="Severity">
            <View style={styles.severityRow}>
              {SEVERITIES.map((s) => {
                const isActive = severity === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.severityButton, isActive && styles.severityActive]}
                    onPress={() => {
                      setSeverity(s);
                      if (errors.severity) setErrors((e) => ({ ...e, severity: undefined }));
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[
                      styles.severityText,
                      isActive && { color: colors.white, fontWeight: '600' },
                      { textTransform: 'capitalize' },
                    ]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.severity ? (
              <Text style={styles.errorText} accessibilityRole="alert">{errors.severity}</Text>
            ) : null}
            {/* Submit button always visible once a symptom is selected; disabled until form valid */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || saving) && styles.submitButtonDisabled,
              ]}
              onPress={submit}
              disabled={saving || !isFormValid}
              accessibilityRole="button"
              accessibilityLabel={`Log ${selected}`}
              accessibilityState={{ disabled: saving || !isFormValid }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Plus size={18} color={isFormValid ? colors.white : colors.textLight} />
                  <Text style={[styles.submitText, !isFormValid && { color: colors.textLight }]}>
                    Log {selected}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Card>
        )}

        {/* History */}
        <Card title="Recent Symptoms">
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : history.length === 0 ? (
            <EmptyState
              compact
              icon={<Activity size={24} color={colors.textLight} />}
              message="No symptoms logged yet. Select one above to start tracking."
            />
          ) : (
            history.map((entry, i) => (
              <View key={`${entry.date}-${entry.type}-${i}`} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyType}>{entry.type}</Text>
                  <Text style={styles.historyMeta}>{entry.severity} - {entry.date}</Text>
                </View>
              </View>
            ))
          )}
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
    subtitle: { ...typography.bodySmall, color: colors.textMedium, marginTop: 2, marginBottom: spacing.md },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.round, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBackground },
    chipActive: { borderColor: colors.primaryDark, backgroundColor: colors.mutedBackground },
    chipText: { ...typography.bodySmall, color: colors.textMedium },
    severityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    severityButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
    severityActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    severityText: { ...typography.bodyMedium, color: colors.textMedium },
    submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primaryDark },
    submitButtonDisabled: { backgroundColor: colors.mutedBackground, borderWidth: 1, borderColor: colors.border },
    submitText: { ...typography.buttonText, color: colors.white },
    errorText: { ...typography.bodySmall, color: colors.errorDark, marginTop: spacing.xs },
    emptyText: { ...typography.bodyMedium, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.lg },
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryDark },
    historyType: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '500' },
    historyMeta: { ...typography.caption, color: colors.textLight },
  });
