import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'

/**
 * CyclePhaseBadge — Displays the current cycle phase as a coloured pill badge
 * with cycle day and days-until-next-period counter.
 *
 * Props:
 *   prediction — the prediction object from predictCycleLocally() / syncCycles()
 *                (fields: currentPhase, cycleDay, nextPeriodStart, averageCycleLength, confidence)
 *   style      — optional style override for the outer container
 */

const PHASE_META = {
  Menstrual: {
    emoji: '🩸',
    label: 'Menstrual',
    bgKey: 'secondary',
    textKey: 'secondaryDark',
    description: 'Rest, warmth, and gentle movement are your friends right now. 💜',
  },
  Follicular: {
    emoji: '🌱',
    label: 'Follicular',
    bgKey: 'primary',
    textKey: 'primaryDark',
    description: 'Energy is rising — a great time to start new things.',
  },
  Ovulation: {
    emoji: '✨',
    label: 'Ovulation',
    bgKey: 'accent',
    textKey: 'accentDark',
    description: "Peak energy and confidence. You're glowing! 🌟",
  },
  Luteal: {
    emoji: '🌙',
    label: 'Luteal',
    bgKey: 'mutedBackground',
    textKey: 'textMedium',
    description: 'Wind down, nourish your body, and honour your needs.',
  },
}

const daysUntil = (isoDate) => {
  if (!isoDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate + 'T00:00:00')
  const diff = Math.round((target - today) / (24 * 60 * 60 * 1000))
  return diff
}

export const CyclePhaseBadge = ({ prediction, style = {} }) => {
  const { theme } = useTheme()
  const { colors, typography, spacing, borderRadius, shadows } = theme

  const styles = useMemo(
    () => createStyles(colors, spacing, borderRadius, shadows),
    [colors, spacing, borderRadius, shadows],
  )

  // No history yet — show an encouraging placeholder
  if (!prediction || !prediction.hasHistory || !prediction.currentPhase) {
    return (
      <View style={[styles.emptyBadge, style]} accessibilityRole="text">
        <Text style={styles.emptyEmoji}>🌸</Text>
        <Text style={[typography.bodyMedium, styles.emptyText]}>
          Log your first period to unlock your cycle phase prediction.
        </Text>
      </View>
    )
  }

  const phase = prediction.currentPhase // e.g. 'Follicular'
  const meta = PHASE_META[phase] || PHASE_META.Luteal
  const phaseBg = colors[meta.bgKey]
  const phaseText = colors[meta.textKey]
  const daysLeft = daysUntil(prediction.nextPeriodStart)

  return (
    <View
      style={[styles.badge, { backgroundColor: phaseBg }, style]}
      accessible
      accessibilityLabel={`Current phase: ${meta.label}, cycle day ${prediction.cycleDay}`}
      accessibilityRole="text"
    >
      {/* Top row — emoji + phase name + cycle day */}
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <View style={styles.labelGroup}>
          <Text style={[styles.phaseLabel, { color: phaseText }]}>{meta.label.toUpperCase()}</Text>
          <Text style={[styles.cycleDay, { color: phaseText }]}>
            Day {prediction.cycleDay} of cycle
          </Text>
        </View>

        {/* Days-until pill */}
        {daysLeft !== null && daysLeft >= 0 && (
          <View style={[styles.pill, { borderColor: phaseText }]}>
            <Text style={[styles.pillNumber, { color: phaseText }]}>{daysLeft}</Text>
            <Text style={[styles.pillLabel, { color: phaseText }]}>days{'\n'}to period</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: phaseText }]}>{meta.description}</Text>

      {/* Footer — avg cycle + confidence */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: phaseText }]}>
          {prediction.averageCycleLength}-day avg cycle
        </Text>
        {prediction.confidence && (
          <View style={[styles.confidencePill, { borderColor: phaseText }]}>
            <Text style={[styles.confidenceText, { color: phaseText }]}>
              {prediction.confidence} confidence
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const createStyles = (colors, spacing, borderRadius, shadows) =>
  StyleSheet.create({
    badge: {
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.light,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    emoji: {
      fontSize: 32,
      marginRight: spacing.md,
    },
    labelGroup: {
      flex: 1,
    },
    phaseLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    },
    cycleDay: {
      fontSize: 22,
      fontWeight: '700',
      marginTop: 2,
    },
    pill: {
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      minWidth: 54,
    },
    pillNumber: {
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 24,
    },
    pillLabel: {
      fontSize: 9,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 11,
    },
    description: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.md,
      opacity: 0.85,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerText: {
      fontSize: 11,
      fontWeight: '600',
      opacity: 0.7,
    },
    confidencePill: {
      borderWidth: 1,
      borderRadius: borderRadius.round,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    confidenceText: {
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    // Empty state
    emptyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.mutedBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    emptyEmoji: {
      fontSize: 28,
    },
    emptyText: {
      flex: 1,
      color: colors.textMedium,
      lineHeight: 20,
    },
  })
