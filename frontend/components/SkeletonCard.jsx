import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet } from 'react-native'
import { useTheme } from '../context/ThemeContext'

/**
 * SkeletonCard — A pulsing shimmer placeholder that mirrors the SectionCard
 * shape used across InsightsScreen and CycleTrackerScreen.
 *
 * Props:
 *   height   — total card height in px. Default 140
 *   lines    — number of shimmer body lines to render. Default 3
 *   showIcon — whether to render the icon placeholder. Default true
 *   style    — additional style overrides for the outer card View
 */
export const SkeletonCard = ({ height = 140, lines = 3, showIcon = true, style = {} }) => {
  const { theme } = useTheme()
  const { colors, borderRadius, spacing, shadows } = theme
  const pulse = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  const s = StyleSheet.create({
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      minHeight: height,
      ...shadows.light,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.mutedBackground,
      marginRight: spacing.md,
    },
    titleArea: {
      flex: 1,
      gap: 6,
    },
    titleLine: {
      height: 14,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.mutedBackground,
      width: '70%',
    },
    subtitleLine: {
      height: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.mutedBackground,
      width: '50%',
    },
    body: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    bodyLine: {
      height: 10,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.mutedBackground,
    },
  })

  const lineWidths = ['100%', '80%', '65%']

  return (
    <View
      style={[s.card, style]}
      accessible
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
    >
      {/* Card header row */}
      <View style={s.header}>
        {showIcon && <Animated.View style={[s.iconBox, { opacity: pulse }]} />}
        <View style={s.titleArea}>
          <Animated.View style={[s.titleLine, { opacity: pulse }]} />
          <Animated.View style={[s.subtitleLine, { opacity: pulse }]} />
        </View>
      </View>

      {/* Body shimmer lines */}
      <View style={s.body}>
        {Array.from({ length: lines }).map((_, i) => (
          <Animated.View
            key={i}
            style={[s.bodyLine, { opacity: pulse, width: lineWidths[i % lineWidths.length] }]}
          />
        ))}
      </View>
    </View>
  )
}
