import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { ArrowLeft, Smile, Frown, Meh, ThumbsUp, ThumbsDown, Calendar, TrendingUp, Heart } from 'lucide-react-native';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

const MOODS = [
  { key: 'great', label: 'Great', value: 5, Icon: ThumbsUp },
  { key: 'good', label: 'Good', value: 4, Icon: Smile },
  { key: 'okay', label: 'Okay', value: 3, Icon: Meh },
  { key: 'low', label: 'Low', value: 2, Icon: Frown },
  { key: 'bad', label: 'Bad', value: 1, Icon: ThumbsDown },
];

const STORAGE_KEY = '@aarini_mood_entries';

const getDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MoodTrackingScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.uid || 'local';
  const { colors, typography, spacing, borderRadius, shadows } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [entries, setEntries] = useState({});
  const [todayMood, setTodayMood] = useState(null);
  const [note, setNote] = useState('');
  const [moodError, setMoodError] = useState('');
  const today = getDateKey();

  const loadEntries = useCallback(async () => {
    try {
      const raw = await secureGetItem(STORAGE_KEY, userId);
      if (raw) {
        const parsed = JSON.parse(raw);
        setEntries(parsed);
        if (parsed[today]) {
          setTodayMood(parsed[today].mood);
          setNote(parsed[today].note || '');
        }
      }
    } catch {
      // Fail silently on corrupt storage
    }
  }, [today]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const saveMood = async (moodKey) => {
    setMoodError('');
    setTodayMood(moodKey);
    const updated = {
      ...entries,
      [today]: { mood: moodKey, note, date: today },
    };
    setEntries(updated);
    try {
      await secureSetItem(STORAGE_KEY, JSON.stringify(updated), userId);
    } catch {
      // Storage full or unavailable
    }
  };

  const saveNote = async (text) => {
    setNote(text);
    if (!todayMood) return;
    const updated = {
      ...entries,
      [today]: { ...entries[today], note: text },
    };
    setEntries(updated);
    try {
      await secureSetItem(STORAGE_KEY, JSON.stringify(updated), userId);
    } catch {
      // Storage full or unavailable
    }
  };

  // Recent 7 days for trend chart
  const recentSeries = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      const entry = entries[key];
      days.push({
        date: key,
        value: entry ? MOODS.find((m) => m.key === entry.mood)?.value || 0 : 0,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      });
    }
    return days;
  }, [entries]);

  const filledSeries = recentSeries.filter((d) => d.value > 0);

  // Stats
  const stats = useMemo(() => {
    const values = Object.values(entries);
    if (!values.length) return null;
    const moodCounts = {};
    values.forEach((e) => {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
    });
    const mostCommon = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    const avg = values.reduce((sum, e) => sum + (MOODS.find((m) => m.key === e.mood)?.value || 0), 0) / values.length;
    return {
      total: values.length,
      average: avg.toFixed(1),
      mostCommon: mostCommon ? mostCommon[0] : null,
    };
  }, [entries]);

  // SVG trend line
  const TrendChart = () => {
    if (filledSeries.length < 2) return null;
    const width = 300;
    const height = 120;
    const pad = 24;
    const stepX = (width - pad * 2) / (filledSeries.length - 1);
    const points = filledSeries
      .map((d, i) => {
        const x = pad + i * stepX;
        const y = pad + (height - pad * 2) * (1 - (d.value - 1) / 4);
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[1, 2, 3, 4, 5].map((lvl) => {
          const y = pad + (height - pad * 2) * (1 - (lvl - 1) / 4);
          return (
            <Line key={lvl} x1={pad} y1={y} x2={width - pad} y2={y} stroke={colors.border} strokeWidth="1" />
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
        {filledSeries.map((d, i) => {
          const x = pad + i * stepX;
          const y = pad + (height - pad * 2) * (1 - (d.value - 1) / 4);
          return <Circle key={i} cx={x} cy={y} r="4" fill={colors.primaryDark} />;
        })}
      </Svg>
    );
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
          <Text style={[typography.h2, styles.headerTitle]}>{t('moodTracking.title')}</Text>
          <View style={styles.backButton} />
        </View>

        {/* Today's mood selector */}
        <Card
          icon={<Smile size={20} color={colors.primaryDark} />}
          title={t('moodTracking.howFeeling')}
          subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        >
          <View style={styles.moodRow}>
            {MOODS.map((mood) => {
              const isSelected = todayMood === mood.key;
              return (
                <TouchableOpacity
                  key={mood.key}
                  style={[styles.moodButton, isSelected && styles.moodButtonSelected]}
                  onPress={() => saveMood(mood.key)}
                  accessibilityLabel={`Mood: ${mood.label}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <mood.Icon size={24} color={isSelected ? colors.primaryDark : colors.textLight} />
                  <Text style={[styles.moodLabel, isSelected && { color: colors.primaryDark, fontWeight: '600' }]}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!todayMood && moodError ? (
            <Text style={styles.errorText} accessibilityRole="alert">{moodError}</Text>
          ) : null}
          {todayMood ? (
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note (optional)"
              placeholderTextColor={colors.textLight}
              value={note}
              onChangeText={saveNote}
              multiline
              maxLength={200}
              accessibilityLabel="Mood note"
              accessibilityHint="Add an optional note about how you feel today"
            />
          ) : (
            <TouchableOpacity
              onPress={() => setMoodError('Please select a mood above before adding a note.')}
              style={styles.noteInputDisabled}
              accessibilityLabel="Select a mood first"
              accessibilityHint="Tap a mood above to unlock the note field"
            >
              <Text style={styles.noteInputPlaceholder}>Add a note (select a mood first)</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Weekly trend */}
        <Card
          icon={<TrendingUp size={20} color={colors.primaryDark} />}
          title={t('moodTracking.trend')}
          subtitle={t('moodTracking.trendSubtitle')}
          accessibilityLabel="7-day mood trend chart"
        >
          {filledSeries.length >= 2 ? (
            <>
              <TrendChart />
              <View style={styles.dayLabels}>
                {recentSeries.map((d) => (
                  <Text key={d.date} style={styles.dayLabel}>{d.label}</Text>
                ))}
              </View>
            </>
          ) : (
            <EmptyState compact message={t('moodTracking.noTrend')} />
          )}
        </Card>

        {/* Stats */}
        {stats && (
          <Card
            icon={<Calendar size={20} color={colors.primaryDark} />}
            title={t('moodTracking.insights')}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>{t('moodTracking.daysLogged')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.average}</Text>
                <Text style={styles.statLabel}>{t('moodTracking.average')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { textTransform: 'capitalize' }]}>{stats.mostCommon}</Text>
                <Text style={styles.statLabel}>{t('moodTracking.mostCommon')}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Recent history */}
        <Card title={t('moodTracking.recentEntries')}>
          {Object.entries(entries)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 7)
            .map(([date, entry]) => {
              const moodInfo = MOODS.find((m) => m.key === entry.mood);
              return (
                <View key={date} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                  <View style={styles.historyMood}>
                    {moodInfo && <moodInfo.Icon size={16} color={colors.primaryDark} />}
                    <Text style={styles.historyMoodText}>{moodInfo?.label}</Text>
                  </View>
                  {entry.note ? <Text style={styles.historyNote} numberOfLines={1}>{entry.note}</Text> : null}
                </View>
              );
            })}
          {Object.keys(entries).length === 0 && (
            <EmptyState compact message={t('moodTracking.noEntries')} />
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    cardIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.mutedBackground, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    cardSubtitle: { ...typography.bodySmall, color: colors.textMedium },
    moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
    moodButton: { alignItems: 'center', padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, flex: 1, marginHorizontal: 3 },
    moodButtonSelected: { borderColor: colors.primaryDark, backgroundColor: colors.mutedBackground },
    moodLabel: { ...typography.caption, marginTop: 4, color: colors.textLight },
    noteInput: { ...typography.bodyMedium, color: colors.textDark, backgroundColor: colors.inputBackground, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md, minHeight: 60, textAlignVertical: 'top' },
    noteInputDisabled: { backgroundColor: colors.mutedBackground, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md, minHeight: 60, justifyContent: 'center' },
    noteInputPlaceholder: { ...typography.bodyMedium, color: colors.textLight },
    errorText: { ...typography.bodySmall, color: colors.errorDark, marginTop: spacing.sm },
    dayLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: spacing.xs },
    dayLabel: { ...typography.caption, color: colors.textLight, textAlign: 'center', width: 36 },
    emptyState: { paddingVertical: spacing.xl, alignItems: 'center' },
    emptyText: { ...typography.bodyMedium, color: colors.textLight, textAlign: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statValue: { ...typography.h2, color: colors.primaryDark },
    statLabel: { ...typography.caption, color: colors.textMedium, marginTop: 2 },
    historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    historyDate: { ...typography.bodySmall, color: colors.textMedium, width: 50 },
    historyMood: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm, width: 70 },
    historyMoodText: { ...typography.bodySmall, color: colors.textDark, marginLeft: 4, fontWeight: '500' },
    historyNote: { ...typography.bodySmall, color: colors.textLight, flex: 1, marginLeft: spacing.sm },
  });
