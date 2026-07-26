import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ArrowLeft, Award, Flame, Target, Trophy } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../i18n/LanguageContext'
import { getStreakData, getActivityForMonth } from '../services/streakService'

export const AchievementsScreen = ({ navigation }) => {
  const { theme } = useTheme()
  const { t } = useLanguage()
  const { colors, typography, spacing, borderRadius, shadows } = theme
  const styles = useMemo(() => createStyles(theme), [theme])

  const [data, setData] = useState(null)
  const now = new Date()

  const loadData = useCallback(async () => {
    const streak = await getStreakData()
    setData(streak)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!data) return null

  const monthDays = getActivityForMonth(data.loggedDays, now.getFullYear(), now.getMonth())

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[typography.h2, styles.headerTitle]}>{t('achievements.title')}</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.streakCard}>
          <Flame size={32} color={colors.primaryDark} />
          <Text style={styles.streakNumber}>{data.currentStreak}</Text>
          <Text style={styles.streakLabel}>{t('achievements.currentStreak')}</Text>
          <Text style={styles.longestLabel}>
            {t('achievements.longestStreak', { days: data.longestStreak })}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t('achievements.thisMonth')}</Text>
        <View style={styles.heatmapGrid}>
          {monthDays.map(({ date, active }) => (
            <View key={date} style={[styles.heatmapDay, active && styles.heatmapActive]} />
          ))}
        </View>

        {data.milestones.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
              {t('achievements.milestones')}
            </Text>
            {data.milestones.map((milestone, idx) => (
              <View key={idx} style={styles.milestoneRow}>
                <View style={styles.milestoneIcon}>
                  <Award size={18} color={colors.primaryDark} />
                </View>
                <Text style={styles.milestoneText}>{milestone.label}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          {t('achievements.totalDays')}
        </Text>
        <Text style={styles.totalCount}>{Object.keys(data.loggedDays).length}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = ({ colors, typography, spacing, borderRadius, shadows }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
    },
    headerTitle: { flex: 1, textAlign: 'center' },
    streakCard: {
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadows.light,
    },
    streakNumber: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.primaryDark,
      marginTop: spacing.sm,
    },
    streakLabel: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '700' },
    longestLabel: { ...typography.bodySmall, color: colors.textMedium, marginTop: 4 },
    sectionLabel: {
      ...typography.caption,
      color: colors.textMedium,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    heatmapDay: { width: 16, height: 16, borderRadius: 3, backgroundColor: colors.mutedBackground },
    heatmapActive: { backgroundColor: colors.primaryDark },
    milestoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    milestoneIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    milestoneText: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '600' },
    totalCount: { fontSize: 32, fontWeight: '800', color: colors.textDark },
  })
