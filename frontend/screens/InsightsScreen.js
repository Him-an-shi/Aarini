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
import Svg, { Rect, Polyline, Circle, Line, G } from 'react-native-svg';
import { ArrowLeft, TrendingUp, Smile, Droplet, Activity } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.117.86.186:5000';

// Mood values are mapped to a 1–5 scale for the trend line.
const MOOD_SCALE = {
  great: 5,
  good: 4,
  okay: 3,
  low: 2,
  bad: 1,
};

export const InsightsScreen = ({ navigation }) => {
  const { userToken } = useAuth();
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [moods, setMoods] = useState([]);

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
    const moodEntries = (symptomsRes?.symptoms || [])
      .filter((s) => s.mood)
      .map((s) => ({ date: s.date, mood: s.mood }));
    setMoods(moodEntries);

    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Derived analytics -------------------------------------------------

  const avgCycleLength = useMemo(() => {
    const lengths = cycles
      .map((c) => c.cycle_length)
      .filter((n) => typeof n === 'number' && n > 0);
    if (!lengths.length) return null;
    return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  }, [cycles]);

  const recentCycleLengths = useMemo(() => {
    return cycles
      .map((c) => c.cycle_length)
      .filter((n) => typeof n === 'number' && n > 0)
      .slice(-6);
  }, [cycles]);

  const moodSeries = useMemo(() => {
    return moods
      .map((m) => MOOD_SCALE[String(m.mood).toLowerCase()])
      .filter((n) => typeof n === 'number')
      .slice(-7);
  }, [moods]);

  const symptomFrequency = useMemo(() => {
    const counts = {};
    symptoms.forEach((entry) => {
      const list = Array.isArray(entry.symptoms) ? entry.symptoms : [];
      list.forEach((sym) => {
        const key = String(sym).toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [symptoms]);

  // ---- Sub-components -----------------------------------------------------

  const SectionCard = ({ icon, title, subtitle, children, isEmpty, emptyText }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>{icon}</View>
        <View style={styles.flex}>
          <Text style={[typography.h3, styles.cardTitle]}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        children
      )}
    </View>
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
          <Text style={[typography.h2, styles.headerTitle]}>Wellness Insights</Text>
          <View style={styles.backButton} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
            <Text style={styles.loadingText}>Gathering your wellness data…</Text>
          </View>
        ) : (
          <>
            {/* Cycle trend */}
            <SectionCard
              icon={<TrendingUp size={20} color={colors.primaryDark} />}
              title="Cycle Trends"
              subtitle={
                avgCycleLength
                  ? `Average length: ${avgCycleLength} days`
                  : 'Your cycle overview'
              }
              isEmpty={recentCycleLengths.length === 0}
              emptyText="Log a few cycles and your trend will appear here."
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
              title="Mood Patterns"
              subtitle="Recent mood, scaled 1–5"
              isEmpty={moodSeries.length === 0}
              emptyText="Track your mood daily to see patterns emerge."
            >
              <MoodLineChart data={moodSeries} />
              <Text style={styles.caption}>
                Last {moodSeries.length} mood entr
                {moodSeries.length === 1 ? 'y' : 'ies'}
              </Text>
            </SectionCard>

            {/* Symptom frequency */}
            <SectionCard
              icon={<Activity size={20} color={colors.primaryDark} />}
              title="Symptom Frequency"
              subtitle="Your most logged symptoms"
              isEmpty={symptomFrequency.length === 0}
              emptyText="Log symptoms and your most frequent ones will show here."
            >
              <SymptomBarChart data={symptomFrequency} />
            </SectionCard>

            {/* Gentle note */}
            <View style={styles.noteCard}>
              <Droplet size={16} color={colors.primaryDark} />
              <Text style={styles.noteText}>
                These insights are based only on what you've logged. The more you
                track, the clearer your patterns become.
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
    loadingWrap: {
      paddingTop: spacing.xxl,
      alignItems: 'center',
    },
    loadingText: {
      ...typography.bodyMedium,
      color: colors.textMedium,
      marginTop: spacing.md,
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
  });
