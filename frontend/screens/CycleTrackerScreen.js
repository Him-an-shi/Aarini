import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Modal, SafeAreaView, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SkeletonCard } from '../components/SkeletonCard';
import { SyncStatusBar } from '../components/SyncStatusBar';
import { EmptyState } from '../components/EmptyState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, Droplets, LogOut, Plus, Settings, Sparkles,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useNetwork } from '../context/NetworkContext';
import {
  dateInRange, parseLocalDate, predictCycleLocally, toDateKey,
} from '../utils/cyclePrediction';
import {
  cancelAllScheduledNotifications, rescheduleAfterCycleLog, scheduleAllNotifications,
} from '../services/notificationScheduler';
import { syncCycles } from '../services/syncService';
import { CyclePhaseBadge } from '../components/CyclePhaseBadge';
import { HealthAlertCard } from '../components/HealthAlertCard';
import { detectAnomalies, dismissAlert } from '../services/anomalyDetectionService';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const buildMonth = (cursor) => {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  return [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: count }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)),
  ];
};

export const CycleTrackerScreen = () => {
  const { user, userToken, logout } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isOnline } = useNetwork();
  const navigation = useNavigation();
  const [expandedCycleId, setExpandedCycleId] = useState(null);
  const { colors, typography, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const storageKey = `cycles:${user?.uid || 'local'}`;

  const [cycles, setCycles] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [healthAlerts, setHealthAlerts] = useState([]);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userToken}`,
    'X-User-Id': user?.uid || 'mock_user_123',
  }), [user?.uid, userToken]);

  const updateState = useCallback(async (nextCycles, serverPrediction) => {
    const sorted = [...nextCycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
    setCycles(sorted);
    setPrediction(serverPrediction || predictCycleLocally(sorted, user?.cycleLength || 28));
    await AsyncStorage.setItem(storageKey, JSON.stringify(sorted));
  }, [storageKey, user?.cycleLength]);

  const loadCycles = useCallback(async () => {
    setLoading(true);
    setSyncStatus('syncing');
    try {
      const result = await syncCycles({ storageKey, backendUrl: BACKEND_URL, headers });
      setCycles(result.cycles);
      setPrediction(result.prediction || predictCycleLocally(result.cycles, user?.cycleLength || 28));
      setSyncStatus(result.syncStatus);
    } catch {
      const local = JSON.parse((await AsyncStorage.getItem(storageKey)) || '[]');
      await updateState(local);
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  }, [headers, storageKey, updateState, user?.cycleLength]);

  useEffect(() => {
    loadCycles();
    AsyncStorage.getItem('predictionNotificationsEnabled')
      .then((value) => setNotificationsEnabled(value === 'true'));
  }, [loadCycles]);

  useEffect(() => {
    if (isOnline && syncStatus !== 'synced') {
      loadCycles();
    }
  }, [isOnline]);

  useEffect(() => {
    if (notificationsEnabled && prediction?.nextPeriodStart) {
      scheduleAllNotifications(prediction);
    }
  }, [notificationsEnabled, prediction]);

  useEffect(() => {
    if (!loading && cycles.length > 0) {
      detectAnomalies({ cycles, prediction, moodEntries: [], medications: [], symptoms: [] })
        .then(setHealthAlerts);
    }
  }, [cycles, prediction, loading]);

  const saveCycle = async () => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (!start || !end) return Alert.alert('Check the dates', 'Use YYYY-MM-DD for both dates.');
    if (end < start) return Alert.alert('Check the dates', 'The end date must be on or after the start date.');
    if ((end - start) / 86400000 > 13) return Alert.alert('Check the dates', 'A period entry can be at most 14 days.');
    if (start > new Date()) return Alert.alert('Check the dates', 'A period cannot begin in the future.');

    setSaving(true);
    const entry = { id: `local_${Date.now()}`, startDate, endDate };
    try {
      const response = await fetch(`${BACKEND_URL}/add-cycle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...entry, uid: user?.uid }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Could not save this period');
      }
      const data = await response.json();
      await updateState([...cycles, data.cycle || entry], data.prediction);
      const updatedPrediction = data.prediction || predictCycleLocally(
        [...cycles, data.cycle || entry].sort((a, b) => b.startDate.localeCompare(a.startDate)),
        user?.cycleLength || 28,
      );
      if (notificationsEnabled) rescheduleAfterCycleLog(updatedPrediction);
    } catch {
      const newCycles = [...cycles, entry].sort((a, b) => b.startDate.localeCompare(a.startDate));
      await updateState(newCycles);
      if (notificationsEnabled) {
        rescheduleAfterCycleLog(predictCycleLocally(newCycles, user?.cycleLength || 28));
      }
    } finally {
      setSaving(false);
      setModalVisible(false);
      setStartDate('');
      setEndDate('');
    }
  };

  const toggleNotifications = async (enabled) => {
    setNotificationsEnabled(enabled);
    await AsyncStorage.setItem('predictionNotificationsEnabled', String(enabled));
    if (enabled) {
      const scheduled = await scheduleAllNotifications(prediction);
      if (!scheduled) Alert.alert('Notifications unavailable', 'Enable notification permission in device settings.');
    } else {
      await cancelAllScheduledNotifications();
    }
  };

  const calendarDays = useMemo(() => buildMonth(month), [month]);
  const phase = prediction?.currentPhase;
  const dayStyle = (date) => {
    const key = toDateKey(date);
    if (cycles.some((cycle) => dateInRange(key, cycle.startDate, cycle.endDate))) return styles.loggedDay;
    if (dateInRange(key, prediction?.nextPeriodStart, prediction?.nextPeriodEnd)) return styles.predictedDay;
    if (dateInRange(key, prediction?.ovulationWindowStart, prediction?.ovulationWindowEnd)) return styles.ovulationDay;
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {healthAlerts.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            {healthAlerts.map((alert) => (
              <HealthAlertCard
                key={alert.id}
                alert={alert}
                onDismiss={async (id) => {
                  await dismissAlert(id);
                  setHealthAlerts((prev) => prev.filter((a) => a.id !== id));
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MY CYCLE</Text>
            <Text style={typography.h1}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.iconButton} accessibilityLabel="Sign out">
            <LogOut size={20} color={colors.textMedium} />
          </TouchableOpacity>
        </View>

        <SyncStatusBar status={syncStatus} />

        {loading ? (
          <View style={{ paddingTop: spacing.sm }}>
            <SkeletonCard height={200} lines={4} />
            <SkeletonCard height={140} lines={3} />
          </View>
        ) : !prediction?.hasHistory ? (
          <EmptyState
            icon={<Droplets size={30} color={colors.secondaryDark} />}
            title="Start with your latest period"
            message="Log start and end dates to unlock phase and period predictions."
            action={
              <TouchableOpacity style={styles.primaryButton} onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel="Log period">
                <Plus size={18} color={colors.white} />
                <Text style={styles.primaryButtonText}>{t('cycleTracker.logPeriod')}</Text>
              </TouchableOpacity>
            }
          />
        ) : (
          <>
            <View style={styles.phaseCard}>
              <View style={styles.phaseTop}>
                <View style={styles.phaseIcon}><Sparkles size={22} color={colors.primaryDark} /></View>
                <View style={styles.flex}>
                  <Text style={styles.label}>CURRENT PHASE · DAY {prediction.cycleDay}</Text>
                  <Text style={[typography.h1, styles.phaseTitle]}>{phase}</Text>
                </View>
              </View>
              <Text style={styles.phaseCopy}>{t(`cycleTracker.phases.${phase}`)}</Text>
            </View>

            {/* Phase badge — days remaining + contextual description */}
            <CyclePhaseBadge prediction={prediction} />

            <View style={styles.metrics}>
              <View style={styles.metricCard}>
                <Text style={styles.label}>NEXT PERIOD</Text>
                <Text style={styles.metricValue}>{prediction.nextPeriodStart}</Text>
                <Text style={styles.muted}>{prediction.averageCycleLength}-day average · {prediction.confidence} confidence</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.label}>OVULATION WINDOW</Text>
                <Text style={styles.metricValue}>{prediction.ovulationWindowStart}</Text>
                <Text style={styles.muted}>through {prediction.ovulationWindowEnd}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitle}>
            <CalendarDays size={20} color={colors.primaryDark} />
            <Text style={typography.h2}>Cycle calendar</Text>
          </View>
          <TouchableOpacity style={styles.smallButton} onPress={() => setModalVisible(true)} accessibilityRole="button" accessibilityLabel="Log period">
            <Plus size={16} color={colors.primaryDark} /><Text style={styles.smallButtonText}>Log</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityRole="button" accessibilityLabel="Previous month">
              <ChevronLeft color={colors.textDark} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityRole="button" accessibilityLabel="Next month">
              <ChevronRight color={colors.textDark} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {t('cycleTracker.weekdays').map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
          </View>
          <View style={styles.dayGrid}>
            {calendarDays.map((date, index) => (
              <View key={date ? toDateKey(date) : `blank-${index}`} style={styles.dayCell}>
                {date ? (
                  <View style={[styles.dayCircle, dayStyle(date)]}>
                    <Text style={styles.dayText}>{date.getDate()}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <Text style={styles.loggedLegend}>● Logged</Text>
            <Text style={styles.predictedLegend}>● Predicted</Text>
            <Text style={styles.ovulationLegend}>● Ovulation</Text>
          </View>
        </View>

        {cycles.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitle}>
                <Droplets size={20} color={colors.primaryDark} />
                <Text style={typography.h2}>Cycle History</Text>
              </View>
            </View>
            {cycles.slice(0, 6).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.cycleRow}
                onPress={() => navigation.navigate('CycleDetail', { cycle: c })}
                onLongPress={() => {
                  setExpandedCycleId(expandedCycleId === c.id ? null : c.id);
                }}
              >
                <View style={styles.cycleRowInfo}>
                  <Text style={styles.cycleRowDates}>{c.startDate} — {c.endDate}</Text>
                  <Text style={styles.cycleRowMeta}>
                    {(Math.ceil((new Date(c.endDate) - new Date(c.startDate)) / 86400000)) + 1}d
                    {c.flowIntensity ? ` · ${c.flowIntensity}` : ''}
                  </Text>
                </View>
                {expandedCycleId === c.id && (
                  <TouchableOpacity
                    style={styles.cycleRowAction}
                    onPress={() => navigation.navigate('CycleDetail', { cycle: c })}
                  >
                    <Text style={styles.cycleRowActionText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={styles.notificationCard}>
          <View style={styles.bell} importantForAccessibility="no"><Bell size={19} color={colors.primaryDark} /></View>
          <View style={styles.flex}>
            <Text style={styles.notificationTitle}>Prediction reminders</Text>
            <Text style={styles.muted}>A heads-up before your predicted period and ovulation window.</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: colors.primaryDark }}
            accessibilityLabel="Prediction reminders"
            accessibilityRole="switch"
          />
        </View>
        {notificationsEnabled && (
          <TouchableOpacity
            style={styles.prefsLink}
            onPress={() => navigation.navigate('NotificationPrefs', { prediction })}
            accessibilityRole="button"
            accessibilityLabel="Customize notification preferences"
          >
            <Settings size={16} color={colors.primaryDark} />
            <Text style={styles.prefsLinkText}>Customize reminders</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.disclaimer}>Estimates can vary and should not be used as birth control or medical diagnosis.</Text>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.h2}>Log your period</Text>
            <Text style={styles.modalHint}>Enter dates in YYYY-MM-DD format.</Text>
            <Text style={styles.inputLabel}>Start date</Text>
            <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-06-20" placeholderTextColor={colors.textLight} style={styles.input} accessibilityLabel="Start date" />
            <Text style={styles.inputLabel}>End date</Text>
            <TextInput value={endDate} onChangeText={setEndDate} placeholder="2026-06-24" placeholderTextColor={colors.textLight} style={styles.input} accessibilityLabel="End date" />
            <TouchableOpacity style={styles.primaryButton} onPress={saveCycle} disabled={saving} accessibilityRole="button" accessibilityLabel={saving ? 'Saving period' : 'Save period'}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save period'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>{t('cycleTracker.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 80 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  eyebrow: { ...typography.caption, color: colors.primaryDark, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cardBackground, alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  heroCard: { backgroundColor: colors.cardBackground, padding: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, ...shadows.light },
  primaryButton: { minHeight: 50, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  primaryButtonText: { ...typography.buttonText, color: colors.white },
  phaseCard: { padding: spacing.lg, borderRadius: borderRadius.lg, backgroundColor: colors.primary, marginBottom: spacing.md },
  phaseTop: { flexDirection: 'row', alignItems: 'center' },
  phaseIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.cardBackground, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  label: { ...typography.caption, color: colors.textMedium, fontWeight: '800', letterSpacing: 0.6 },
  phaseTitle: { color: colors.textDark, marginTop: 2 },
  phaseCopy: { ...typography.bodyMedium, color: colors.textMedium, marginTop: spacing.md },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  metricCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.cardBackground, ...shadows.light },
  metricValue: { ...typography.h3, fontSize: 16, marginVertical: 6 },
  muted: { ...typography.bodySmall, color: colors.textMedium },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.round },
  smallButtonText: { ...typography.bodySmall, color: colors.primaryDark, fontWeight: '800' },
  calendarCard: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.light },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthTitle: { ...typography.h3 },
  weekRow: { flexDirection: 'row' },
  weekday: { width: '14.285%', textAlign: 'center', ...typography.caption, color: colors.textLight, paddingBottom: spacing.sm },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { ...typography.bodySmall, color: colors.textDark, fontWeight: '600' },
  loggedDay: { backgroundColor: colors.primaryDark },
  predictedDay: { backgroundColor: colors.secondary },
  ovulationDay: { backgroundColor: colors.accent },
  legend: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm },
  loggedLegend: { ...typography.caption, color: colors.primaryDark },
  predictedLegend: { ...typography.caption, color: colors.secondaryDark },
  ovulationLegend: { ...typography.caption, color: colors.accentDark },
  cycleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.light },
  cycleRowInfo: { flex: 1 },
  cycleRowDates: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '600' },
  cycleRowMeta: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  cycleRowAction: { padding: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.sm },
  cycleRowActionText: { ...typography.caption, color: colors.primaryDark, fontWeight: '800' },
  notificationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.md },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  notificationTitle: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '800', marginBottom: 2 },
  prefsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  prefsLinkText: { ...typography.bodySmall, color: colors.primaryDark, fontWeight: '700' },
  disclaimer: { ...typography.caption, color: colors.textLight, textAlign: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.cardBackground, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHint: { ...typography.bodySmall, color: colors.textMedium, marginTop: 4, marginBottom: spacing.lg },
  inputLabel: { ...typography.bodySmall, color: colors.textDark, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.textDark, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  cancelButton: { alignItems: 'center', padding: spacing.md },
  cancelText: { ...typography.bodyMedium, color: colors.textMedium, fontWeight: '700' },
});
