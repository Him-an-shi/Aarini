import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { ArrowLeft, Bell, BellOff, Clock, Moon } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../i18n/LanguageContext'
import {
  getNotificationPrefs,
  requestNotificationPermission,
  saveNotificationPrefs,
  scheduleAllNotifications,
  cancelAllScheduledNotifications,
} from '../services/notificationScheduler'

const LEAD_OPTIONS = [1, 2, 3]
const HOUR_OPTIONS = [7, 8, 9, 10, 12, 14, 18, 20]

const formatHour = (hour) => {
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:00 ${period}`
}

export const NotificationPrefsScreen = ({ navigation, route }) => {
  const { theme } = useTheme()
  const { t } = useLanguage()
  const { colors, typography, spacing, borderRadius, shadows } = theme
  const styles = useMemo(() => createStyles(theme), [theme])
  const prediction = route?.params?.prediction

  const [prefs, setPrefs] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)

  useEffect(() => {
    const load = async () => {
      const stored = await getNotificationPrefs()
      setPrefs(stored)
      const granted = await requestNotificationPermission()
      setPermissionGranted(granted)
    }
    load()
  }, [])

  const updatePref = useCallback(
    async (key, value) => {
      const next = { ...prefs, [key]: value }
      setPrefs(next)
      await saveNotificationPrefs(next)
      if (prediction) {
        await scheduleAllNotifications(prediction)
      }
    },
    [prefs, prediction],
  )

  const handleToggle = useCallback(
    async (key, value) => {
      if (value && !permissionGranted) {
        const granted = await requestNotificationPermission()
        setPermissionGranted(granted)
        if (!granted) {
          Alert.alert(
            'Permission required',
            'Enable notifications in your device settings to receive reminders.',
          )
          return
        }
      }
      await updatePref(key, value)
      if (!value) {
        const next = { ...prefs, [key]: false }
        const anyEnabled = next.periodReminder || next.fertileReminder || next.dailyMoodReminder
        if (!anyEnabled) {
          await cancelAllScheduledNotifications()
        }
      }
    },
    [prefs, permissionGranted, updatePref],
  )

  if (!prefs) return null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={22} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[typography.h2, styles.headerTitle]}>Notification Preferences</Text>
          <View style={styles.backButton} />
        </View>

        {!permissionGranted && (
          <View style={styles.warningCard}>
            <BellOff size={20} color={colors.error || '#DC2626'} />
            <Text style={styles.warningText}>
              Notifications are disabled. Enable them in device settings to receive reminders.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Bell size={20} color={colors.primaryDark} />
            </View>
            <Text style={typography.h3}>Period Reminder</Text>
          </View>
          <Text style={styles.description}>
            Get a heads-up before your predicted period starts so you can be prepared.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable</Text>
            <Switch
              value={prefs.periodReminder}
              onValueChange={(v) => handleToggle('periodReminder', v)}
              trackColor={{ true: colors.primaryDark }}
              accessibilityLabel="Period reminder toggle"
            />
          </View>
          {prefs.periodReminder && (
            <View style={styles.optionSection}>
              <Text style={styles.optionLabel}>Remind me</Text>
              <View style={styles.chipRow}>
                {LEAD_OPTIONS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[styles.chip, prefs.periodLeadDays === days && styles.chipActive]}
                    onPress={() => updatePref('periodLeadDays', days)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: prefs.periodLeadDays === days }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        prefs.periodLeadDays === days && styles.chipTextActive,
                      ]}
                    >
                      {days === 1 ? '1 day before' : `${days} days before`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.cardIcon, { backgroundColor: (colors.accent || '#FDE68A') + '30' }]}
            >
              <Bell size={20} color={colors.accentDark || '#D97706'} />
            </View>
            <Text style={typography.h3}>Fertile Window</Text>
          </View>
          <Text style={styles.description}>
            Get notified when your estimated fertile window is about to begin.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable</Text>
            <Switch
              value={prefs.fertileReminder}
              onValueChange={(v) => handleToggle('fertileReminder', v)}
              trackColor={{ true: colors.primaryDark }}
              accessibilityLabel="Fertile window reminder toggle"
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.cardIcon, { backgroundColor: (colors.secondary || '#A78BFA') + '30' }]}
            >
              <Clock size={20} color={colors.secondaryDark || '#7C3AED'} />
            </View>
            <Text style={typography.h3}>Daily Mood Reminder</Text>
          </View>
          <Text style={styles.description}>
            A gentle nudge to log your mood each day. Consistent logging reveals patterns.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable</Text>
            <Switch
              value={prefs.dailyMoodReminder}
              onValueChange={(v) => handleToggle('dailyMoodReminder', v)}
              trackColor={{ true: colors.primaryDark }}
              accessibilityLabel="Daily mood reminder toggle"
            />
          </View>
          {prefs.dailyMoodReminder && (
            <View style={styles.optionSection}>
              <Text style={styles.optionLabel}>Reminder time</Text>
              <View style={styles.chipRow}>
                {HOUR_OPTIONS.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[styles.chip, prefs.moodReminderHour === hour && styles.chipActive]}
                    onPress={() => updatePref('moodReminderHour', hour)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: prefs.moodReminderHour === hour }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        prefs.moodReminderHour === hour && styles.chipTextActive,
                      ]}
                    >
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#1E293B20' }]}>
              <Moon size={20} color={colors.textDark} />
            </View>
            <Text style={typography.h3}>Quiet Hours</Text>
          </View>
          <Text style={styles.description}>
            No notifications between 10 PM and 7 AM. Reminders scheduled during this time will be
            delivered after quiet hours end.
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable quiet hours</Text>
            <Switch
              value={prefs.quietHoursEnabled}
              onValueChange={(v) => updatePref('quietHoursEnabled', v)}
              trackColor={{ true: colors.primaryDark }}
              accessibilityLabel="Quiet hours toggle"
            />
          </View>
        </View>
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
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: '#FEF2F2',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: '#FECACA',
    },
    warningText: { ...typography.bodySmall, color: '#991B1B', flex: 1 },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.light,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary || '#EDE9FE',
      alignItems: 'center',
      justifyContent: 'center',
    },
    description: { ...typography.bodyMedium, color: colors.textMedium, marginBottom: spacing.md },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    toggleLabel: { ...typography.bodyMedium, color: colors.textDark, fontWeight: '600' },
    optionSection: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    optionLabel: {
      ...typography.bodySmall,
      color: colors.textMedium,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: borderRadius.round || 999,
      backgroundColor: colors.mutedBackground || '#F1F5F9',
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    chipText: { ...typography.bodySmall, color: colors.textMedium, fontWeight: '600' },
    chipTextActive: { color: colors.white || '#FFFFFF' },
  })
