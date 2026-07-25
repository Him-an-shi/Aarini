import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SkeletonCard } from '../components/SkeletonCard';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import Svg, { Rect, Polyline, Circle, Line, G } from 'react-native-svg';
import { ArrowLeft, TrendingUp, Smile, Droplet, Activity, Target, Lightbulb, Heart } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { predictCycleLocally } from '../utils/cyclePrediction';
import {
  computeCycleLengths,
  computePredictionAccuracy,
  computeSymptomFrequency,
  computeCycleVariance,
  computeCycleStability,
  getPhaseAwareTips,
} from '../utils/analyticsEngine';
import { calculateCycleQualityScore, analyzeCycleRegularity, analyzeMoodTrendByPhase } from '../utils/patternAnalyzer';
import {
  computeSymptomPhaseCorrelation,
  generateSymptomPhaseSummary,
} from '../utils/symptomPhaseCorrelation';
import {
  computeMoodCycleCorrelation,
  generatePatternSummary,
  PHASE_COLORS,
} from '../utils/moodCycleCorrelation';
import { secureGetItem } from '../utils/secureStorage';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Mood values are mapped to a 1–5 scale for the trend line.
const MOOD_SCALE = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  bad: 1,
};

export const InsightsScreen = ({ navigation }) => {
  const { userToken, user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, typography, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [moods, setMoods] = useState([]);
  const [moodEntries, setMoodEntries] = useState({});

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    }),
    [userToken]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    // Each fetch is independent and fails soft — a single down endpoint
    // shouldn't blank the whole screen (offline-first, matching AuthContext).
    const safeGet = async (path) => {
      try {
        const res = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders });
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        return null;
      }
    };

    const [cyclesRes, symptomsRes] = await Promise.all([
      safeGet('/cycles'),
      safeGet('/symptoms'),
    ]);

    setCycles(cyclesRes?.cycles || []);
    setSymptoms(symptomsRes?.symptoms || []);
    // Mood entries may ride along with symptoms or come from a mood field.
    const moodEntries2 = (symptomsRes?.symptoms || [])
      .filter((s) => s.mood)
      .map((s) => ({ date: s.date, mood: s.mood }));
    setMoods(moodEntries2);

    // Load local mood entries from secure storage (MoodTrackingScreen data)
    try {
      const userId = user?.uid || 'local';
      const raw = await secureGetItem('@aarini_mood_entries', userId);
      if (raw) setMoodEntries(JSON.parse(raw));
    } catch {
      // Fail silently - correlation just won't show
    }

    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Derived analytics -------------------------------------------------

  const cycleLengths = useMemo(() => computeCycleLengths(cycles), [cycles]);

  const avgCycleLength = useMemo(() => {
    if (!cycleLengths.length) return null;
    return Math.round(cycleLengths.reduce((a, b) => a + b.length, 0) / cycleLengths.length);
  }, [cycleLengths]);

  const cycleVariance = useMemo(() => computeCycleVariance(cycleLengths), [cycleLengths]);

  const recentCycleLengths = useMemo(() => {
    return cycleLengths.slice(-6).map((c) => c.length);
  }, [cycleLengths]);

  const predictionAccuracy = useMemo(
    () => computePredictionAccuracy(cycles),
    [cycles]
  );

  const cycleQuality = useMemo(
    () => calculateCycleQualityScore(cycles, symptoms, moodEntries),
    [cycles, symptoms, moodEntries]
  );

  const cycleStability = useMemo(
    () => computeCycleStability(cycleLengths),
    [cycleLengths]
  );

  const phaseMoodAnalysis = useMemo(
    () => analyzeMoodTrendByPhase(moodEntries, cycles),
    [moodEntries, cycles]
  );

  const prediction = useMemo(
    () => predictCycleLocally(cycles),
    [cycles]
  );

  const phaseAwareTips = useMemo(
    () => getPhaseAwareTips(prediction.currentPhase || 'Luteal'),
    [prediction.currentPhase]
  );

  const moodSeries = useMemo(() => {
    return moods
      .map((m) => MOOD_SCALE[String(m.mood).toLowerCase()])
      .filter((n) => typeof n === 'number')
      .slice(-7);
  }, [moods]);

  const symptomFrequency = useMemo(() => computeSymptomFrequency(symptoms), [symptoms]);

  const symptomPhaseData = useMemo(
    () => computeSymptomPhaseCorrelation(symptoms, cycles),
    [symptoms, cycles]
  );

  const moodCycleCorrelation = useMemo(
    () => computeMoodCycleCorrelation(moodEntries, cycles),
    [moodEntries, cycles]
  );

  // ---- Sub-components -----------------------------------------------------

  const SectionCard = ({ icon, title, subtitle, children, isEmpty, emptyText }) => (
    <Card icon={icon} title={title} subtitle={subtitle}>
      {isEmpty ? (
        <EmptyState compact message={emptyText} />
      ) : (
        children
      )}
    </Card>
  );

  // Simple SVG line chart for the mood trend (values 1–5).
  const MoodLineChart = ({ data }) => {
    const width = 300;
    const height = 140;
    const pad = 24;
    const maxV = 5;
    const minV = 1;
    const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
    const points = data
      .map((v, i) => {
        const x = pad + i * stepX;
        const y = pad + (height - pad * 2) * (1 - (v - minV) / (maxV - minV));
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* baseline grid lines */}
        {[1, 2, 3, 4, 5].map((lvl) => {
          const y = pad + (height - pad * 2) * (1 - (lvl - minV) / (maxV - minV));
          return (
            <Line
              key={lvl}
              x1={pad}
              y1={y}
              x2={width - pad}
              y2={y}
              stroke={colors.border}
              strokeWidth="1"
            />
          );
        })}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.primaryDark}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((v, i) => {
          const x = pad + i * stepX;
          const y = pad + (height - pad * 2) * (1 - (v - minV) / (maxV - minV));
          return <Circle key={i} cx={x} cy={y} r="4" fill={colors.primaryDark} />;
        })}
      </Svg>
    );
  };

  const MoodCycleChart = ({ correlation }) => {
    const { dayAverages, phaseBands, avgCycleLength } = correlation;
    const width = 320;
    const height = 160;
    const pad = 28;
    const chartW = width - pad * 2;
    const chartH = height - pad * 2;
    const maxV = 5;
    const minV = 1;

    const validPoints = dayAverages.filter((d) => d.average !== null);
    const points = validPoints
      .map((d) => {
        const x = pad + ((d.day - 1) / (avgCycleLength - 1)) * chartW;
        const y = pad + chartH * (1 - (d.average - minV) / (maxV - minV));
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {phaseBands.map((band) => {
          const x = pad + ((band.start - 1) / avgCycleLength) * chartW;
          const w = ((band.end - band.start + 1) / avgCycleLength) * chartW;
          return (
            <Rect
              key={band.phase}
              x={x}
              y={pad}
              width={w}
              height={chartH}
              fill={PHASE_COLORS[band.phase] || '#F3F0FC'}
              opacity={0.5}
            />
          );
        })}
        {[1, 3, 5].map((lvl) => {
          const y = pad + chartH * (1 - (lvl - minV) / (maxV - minV));
          return (
            <Line key={lvl} x1={pad} y1={y} x2={width - pad} y2={y} stroke={colors.border} strokeWidth="0.5" />
          );
        })}
        {validPoints.length > 1 && (
          <Polyline
            points={points}
            fill="none"
            stroke={colors.primaryDark}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {validPoints.map((d) => {
          const x = pad + ((d.day - 1) / (avgCycleLength - 1)) * chartW;
          const y = pad + chartH * (1 - (d.average - minV) / (maxV - minV));
          return <Circle key={d.day} cx={x} cy={y} r="3" fill={colors.primaryDark} />;
        })}
      </Svg>
    );
  };

  // Horizontal-ish bar chart for symptom frequency.
  const SymptomBarChart = ({ data }) => {
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    return (
      <View style={styles.barChart}>
        {data.map((item) => (
          <View key={item.label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(item.count / maxCount) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.barCount}>{item.count}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Mini cycle-length bar chart.
  const CycleBars = ({ data }) => {
    const width = 300;
    const height = 120;
    const pad = 20;
    const maxV = Math.max(...data, 35);
    const barW = data.length ? (width - pad * 2) / data.length - 8 : 0;
    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.map((v, i) => {
          const h = (height - pad * 2) * (v / maxV);
          const x = pad + i * ((width - pad * 2) / data.length) + 4;
          const y = height - pad - h;
          return (
            <G key={i}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="4"
                fill={colors.primaryDark}
              />
            </G>
          );
        })}
      </Svg>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <Text style={[typography.h2, styles.headerTitle]}>{t('insights.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <>
            <SkeletonCard height={160} lines={4} />
            <SkeletonCard height={180} lines={3} />
            <SkeletonCard height={140} lines={4} />
          </>
        ) : (
          <>
            {/* Cycle trend */}
            <SectionCard
              icon={<TrendingUp size={20} color={colors.primaryDark} />}
              title={t('insights.cycleTrends')}
              subtitle={
                avgCycleLength
                  ? t('insights.avgLength', { days: avgCycleLength })
                  : t('insights.cycleOverview')
              }
              isEmpty={recentCycleLengths.length === 0}
              emptyText={t('insights.noCycleData')}
            >
              <CycleBars data={recentCycleLengths} />
              <Text style={styles.caption}>
                Last {recentCycleLengths.length} cycle
                {recentCycleLengths.length === 1 ? '' : 's'} (in days)
              </Text>
            </SectionCard>

            {/* Mood tracking */}
            <SectionCard
              icon={<Smile size={20} color={colors.primaryDark} />}
              title={t('insights.moodPatterns')}
              subtitle={t('insights.moodSubtitle')}
              isEmpty={moodSeries.length === 0}
              emptyText={t('insights.noMoodData')}
            >
              <MoodLineChart data={moodSeries} />
              <Text style={styles.caption}>
                Last {moodSeries.length} mood entr
                {moodSeries.length === 1 ? 'y' : 'ies'}
              </Text>
            </SectionCard>

            {/* Mood-cycle correlation */}
            <SectionCard
              icon={<Heart size={20} color={colors.secondaryDark} />}
              title={t('insights.moodCycleTitle')}
              subtitle={
                moodCycleCorrelation
                  ? t('insights.moodCycleSubtitle', { cycles: moodCycleCorrelation.cyclesUsed })
                  : t('insights.moodCycleOverview')
              }
              isEmpty={!moodCycleCorrelation}
              emptyText={t('insights.noMoodCycleData')}
            >
              {moodCycleCorrelation && (
                <>
                  <MoodCycleChart correlation={moodCycleCorrelation} />
                  <View style={styles.phaseLegend}>
                    {moodCycleCorrelation.phaseBands.map((band) => (
                      <View key={band.phase} style={styles.phaseLegendItem}>
                        <View style={[styles.phaseLegendDot, { backgroundColor: PHASE_COLORS[band.phase] }]} />
                        <Text style={styles.phaseLegendLabel}>{band.phase}</Text>
                      </View>
                    ))}
                  </View>
                  {moodCycleCorrelation.patterns.map((pattern, idx) => (
                    <View key={idx} style={styles.patternRow}>
                      <View style={[styles.patternDot, { backgroundColor: pattern.type === 'dip' ? colors.secondaryDark : colors.successDark }]} />
                      <Text style={styles.patternText}>{generatePatternSummary(pattern)}</Text>
                    </View>
                  ))}
                  <Text style={styles.caption}>
                    {t('insights.moodCycleCaption', { count: moodCycleCorrelation.totalMoodsMapped })}
                  </Text>
                </>
              )}
            </SectionCard>

            {/* Symptom frequency */}
            <SectionCard
              icon={<Activity size={20} color={colors.primaryDark} />}
              title={t('insights.symptomFrequency')}
              subtitle={t('insights.symptomSubtitle')}
              isEmpty={symptomFrequency.length === 0}
              emptyText={t('insights.noSymptomData')}
            >
              <SymptomBarChart data={symptomFrequency} />
            </SectionCard>

            {/* Symptom-phase correlation */}
            {symptomPhaseData && symptomPhaseData.dominantSymptoms.length > 0 && (
              <SectionCard
                icon={<Activity size={20} color={colors.accentDark} />}
                title={t('insights.symptomPhaseTitle')}
                subtitle={t('insights.symptomPhaseSubtitle', { cycles: symptomPhaseData.cyclesUsed })}
                isEmpty={false}
              >
                {symptomPhaseData.dominantSymptoms.map((item, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <View style={[styles.tipBullet, { backgroundColor: colors.accentDark }]} />
                    <Text style={styles.tipText}>{generateSymptomPhaseSummary(item)}</Text>
                  </View>
                ))}
                <Text style={styles.caption}>
                  {t('insights.symptomPhaseCaption', { count: symptomPhaseData.totalMapped })}
                </Text>
              </SectionCard>
            )}

            {/* Prediction accuracy */}
            <SectionCard
              icon={<Target size={20} color={colors.primaryDark} />}
              title={t('insights.predictionAccuracy')}
              subtitle={
                predictionAccuracy.accuracy !== null
                  ? t('insights.accuracyPercent', { percent: predictionAccuracy.accuracy })
                  : t('insights.needsMoreCycles')
              }
              isEmpty={predictionAccuracy.entries.length === 0}
              emptyText={t('insights.noAccuracyData')}
            >
              <View style={styles.accuracyList}>
                {predictionAccuracy.entries.slice(-5).map((entry, idx) => (
                  <View key={idx} style={styles.accuracyRow}>
                    <View style={[styles.accuracyDot, { backgroundColor: entry.accurate ? colors.successDark : colors.errorDark }]} />
                    <Text style={styles.accuracyLabel}>
                      Cycle {entry.cycleIndex}
                    </Text>
                    <Text style={[styles.accuracyDelta, { color: entry.accurate ? colors.successDark : colors.errorDark }]}>
                      {entry.deltaDays === 0 ? 'Exact' : `${entry.deltaDays > 0 ? '+' : ''}${entry.deltaDays}d`}
                    </Text>
                  </View>
                ))}
              </View>
              {cycleVariance !== null && (
                <Text style={styles.caption}>
                  {t('insights.cycleVariability', { days: cycleVariance })}
                </Text>
              )}
            </SectionCard>

            {/* Cycle Quality Score */}
            {cycleQuality && (
              <SectionCard
                icon={<Target size={20} color={colors.primaryDark} />}
                title={`Wellness Score: ${cycleQuality.score}/100`}
                subtitle={cycleQuality.interpretation}
              >
                <View style={styles.qualityRow}>
                  <View style={styles.qualityItem}>
                    <Text style={styles.qualityValue}>{cycleQuality.regularity}</Text>
                    <Text style={styles.qualityLabel}>Regularity</Text>
                  </View>
                  <View style={styles.qualityItem}>
                    <Text style={styles.qualityValue}>{cycleQuality.dataCompleteness}%</Text>
                    <Text style={styles.qualityLabel}>Data completeness</Text>
                  </View>
                  <View style={styles.qualityItem}>
                    <Text style={styles.qualityValue}>{cycleQuality.cycleCount}</Text>
                    <Text style={styles.qualityLabel}>Cycles tracked</Text>
                  </View>
                </View>
              </SectionCard>
            )}

            {/* Phase-aware tips */}
            <SectionCard
              icon={<Lightbulb size={20} color={colors.primaryDark} />}
              title={prediction.currentPhase ? t('insights.phaseAwareTips', { phase: prediction.currentPhase }) : t('insights.wellnessTips')}
              subtitle={prediction.cycleDay ? t('insights.cycleDay', { day: prediction.cycleDay }) : t('insights.personalizedPhase')}
              isEmpty={false}
            >
              {phaseAwareTips.map((tip, idx) => (
                <View key={idx} style={styles.tipRow}>
                  <View style={styles.tipBullet} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </SectionCard>

            {/* Gentle note */}
            <View style={styles.noteCard} accessibilityRole="text">
              <View importantForAccessibility="no">
                <Droplet size={16} color={colors.primaryDark} />
              </View>
              <Text style={styles.noteText}>
                {t('insights.noteText')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
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

    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.light,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.mutedBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    cardTitle: {
      marginBottom: 2,
    },
    cardSubtitle: {
      ...typography.bodySmall,
      color: colors.textMedium,
    },
    caption: {
      ...typography.bodySmall,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    emptyState: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...typography.bodyMedium,
      color: colors.textLight,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
    barChart: {
      marginTop: spacing.xs,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing.xs,
    },
    barLabel: {
      ...typography.bodySmall,
      color: colors.textDark,
      width: 80,
      textTransform: 'capitalize',
    },
    barTrack: {
      flex: 1,
      height: 14,
      borderRadius: borderRadius.round,
      backgroundColor: colors.mutedBackground,
      overflow: 'hidden',
      marginHorizontal: spacing.sm,
    },
    barFill: {
      height: '100%',
      borderRadius: borderRadius.round,
      backgroundColor: colors.primaryDark,
    },
    barCount: {
      ...typography.bodySmall,
      color: colors.textMedium,
      fontWeight: '700',
      width: 24,
      textAlign: 'right',
    },
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.mutedBackground,
      borderRadius: borderRadius.md,
      padding: spacing.md,
    },
    noteText: {
      ...typography.bodySmall,
      color: colors.textMedium,
      flex: 1,
      marginLeft: spacing.sm,
      lineHeight: 18,
    },
    accuracyList: {
      marginTop: spacing.xs,
    },
    accuracyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
    },
    accuracyDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: spacing.sm,
    },
    accuracyLabel: {
      ...typography.bodySmall,
      color: colors.textDark,
      flex: 1,
    },
    accuracyDelta: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    tipBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primaryDark,
      marginTop: 6,
      marginRight: spacing.sm,
    },
    tipText: {
      ...typography.bodyMedium,
      color: colors.textMedium,
      flex: 1,
      lineHeight: 20,
    },
    phaseLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    phaseLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    phaseLegendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    phaseLegendLabel: {
      ...typography.caption,
      color: colors.textMedium,
    },
    patternRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    patternDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
      marginRight: spacing.sm,
    },
    patternText: {
      ...typography.bodySmall,
      color: colors.textMedium,
      flex: 1,
      lineHeight: 18,
    },
    qualityRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.sm,
    },
    qualityItem: {
      alignItems: 'center',
    },
    qualityValue: {
      ...typography.h3,
      color: colors.primaryDark,
      marginBottom: 2,
    },
    qualityLabel: {
      ...typography.caption,
      color: colors.textMedium,
    },
  });
