import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Polyline, Line } from 'react-native-svg';
import { Calendar, Flame, Heart, MessageCircle, Pill } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { predictCycleLocally } from '../utils/cyclePrediction';
import { getDashboardData } from '../utils/dashboardData';
import { markTaken } from '../services/medicationService';

const PHASE_COLORS = { Menstrual: '#FFDFE5', Follicular: '#E6E2F8', Ovulation: '#FFE5D9', Luteal: '#E8F5E9' };

export const HealthDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [dashData, setDashData] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const loadData = useCallback(async () => {
    const storageKey = `cycles:${user?.uid || 'local'}`;
    const raw = await AsyncStorage.getItem(storageKey);
    const cycles = raw ? JSON.parse(raw) : [];
    const pred = predictCycleLocally(cycles, user?.cycleLength || 28);
    setPrediction(pred);
    const data = await getDashboardData(cycles, pred);
    setDashData(data);
  }, [user?.uid, user?.cycleLength]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMarkMed = async (medId) => {
    await markTaken(medId);
    await loadData();
  };

  if (!dashData) return null;

  const MiniSparkline = ({ data }) => {
    if (data.length < 2) return null;
    const w = 120, h = 40, pad = 4;
    const stepX = (w - pad * 2) / (data.length - 1);
    const points = data.map((v, i) => `${pad + i * stepX},${pad + (h - pad * 2) * (1 - (v - 1) / 4)}`).join(' ');
    return (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Polyline points={points} fill="none" stroke={colors.primaryDark} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{t('dashboard.greeting', { name: user?.name?.split(' ')[0] || '' })}</Text>

        {prediction?.hasHistory && (
          <View style={[styles.phaseCard, { backgroundColor: PHASE_COLORS[dashData.currentPhase] || colors.primary }]}>
            <View style={styles.cycleDayCircle}>
              <Text style={styles.cycleDayNumber}>{dashData.cycleDay}</Text>
            </View>
            <View style={styles.phaseInfo}>
              <Text style={styles.phaseLabel}>{dashData.currentPhase} Phase</Text>
              <Text style={styles.cycleDayLabel}>Day {dashData.cycleDay}</Text>
            </View>
            {dashData.daysUntilNext && (
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownNumber}>{dashData.daysUntilNext}</Text>
                <Text style={styles.countdownLabel}>days to {dashData.nextEvent}</Text>
              </View>
            )}
          </View>
        )}

        {dashData.moodSparkline.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Heart size={18} color={colors.secondaryDark} />
              <Text style={styles.cardLabel}>{t('dashboard.moodTrend')}</Text>
            </View>
            <MiniSparkline data={dashData.moodSparkline} />
          </View>
        )}

        {dashData.todayMeds.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Pill size={18} color={colors.primaryDark} />
              <Text style={styles.cardLabel}>{t('dashboard.todayMeds')}</Text>
            </View>
            {dashData.todayMeds.map((med) => (
              <TouchableOpacity
                key={med.id}
                style={[styles.medRow, med.taken && styles.medRowTaken]}
                onPress={() => handleMarkMed(med.id)}
              >
                <Text style={[styles.medName, med.taken && styles.medNameDone]}>{med.name}</Text>
                {med.taken && <Text style={styles.checkmark}>&#10003;</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Mood')}>
            <Heart size={20} color={colors.primaryDark} />
            <Text style={styles.actionLabel}>{t('dashboard.logMood')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('SymptomLog')}>
            <Calendar size={20} color={colors.primaryDark} />
            <Text style={styles.actionLabel}>{t('dashboard.logSymptom')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Achievements')}>
            <Flame size={20} color={colors.primaryDark} />
            <Text style={styles.actionLabel}>{t('dashboard.streaks')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { ...typography.h1, color: colors.textDark, marginBottom: spacing.lg },
  phaseCard: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  cycleDayCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cardBackground, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  cycleDayNumber: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  phaseInfo: { flex: 1 },
  phaseLabel: { ...typography.h3, color: colors.textDark },
  cycleDayLabel: { ...typography.bodySmall, color: colors.textMedium },
  countdownBadge: { alignItems: 'center', backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, padding: spacing.sm, paddingHorizontal: spacing.md },
  countdownNumber: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  countdownLabel: { ...typography.caption, color: colors.textMedium, fontSize: 9 },
  card: { backgroundColor: colors.cardBackground, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.light },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardLabel: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '700' },
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  medRowTaken: { opacity: 0.6 },
  medName: { ...typography.bodyMedium, color: colors.textDark },
  medNameDone: { textDecorationLine: 'line-through', color: colors.textLight },
  checkmark: { color: colors.successDark, fontSize: 18, fontWeight: '700' },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1, alignItems: 'center', gap: spacing.xs, backgroundColor: colors.cardBackground, borderRadius: borderRadius.md, paddingVertical: spacing.md, ...shadows.light },
  actionLabel: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
});
