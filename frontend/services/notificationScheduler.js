import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'

const PREFS_KEY = 'notificationPreferences'
const SCHEDULED_IDS_KEY = 'scheduledNotificationIds'

const DEFAULT_PREFS = {
  periodReminder: true,
  periodLeadDays: 2,
  fertileReminder: false,
  dailyMoodReminder: false,
  moodReminderHour: 9,
  moodReminderMinute: 0,
  quietHoursEnabled: true,
  quietStart: 22,
  quietEnd: 7,
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export const getNotificationPrefs = async () => {
  const stored = await AsyncStorage.getItem(PREFS_KEY)
  if (!stored) return { ...DEFAULT_PREFS }
  return { ...DEFAULT_PREFS, ...JSON.parse(stored) }
}

export const saveNotificationPrefs = async (prefs) => {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export const requestNotificationPermission = async () => {
  if (Platform.OS === 'web') return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

const ensureAndroidChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cycle-reminders', {
      name: 'Cycle reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    })
  }
}

const isInQuietHours = (date, quietStart, quietEnd) => {
  const hour = date.getHours()
  if (quietStart > quietEnd) {
    return hour >= quietStart || hour < quietEnd
  }
  return hour >= quietStart && hour < quietEnd
}

const adjustForQuietHours = (date, prefs) => {
  if (!prefs.quietHoursEnabled) return date
  if (!isInQuietHours(date, prefs.quietStart, prefs.quietEnd)) return date
  const adjusted = new Date(date)
  adjusted.setHours(prefs.quietEnd, 0, 0, 0)
  if (adjusted <= date) {
    adjusted.setDate(adjusted.getDate() + 1)
  }
  return adjusted
}

export const cancelAllScheduledNotifications = async () => {
  if (Platform.OS === 'web') return
  const stored = JSON.parse((await AsyncStorage.getItem(SCHEDULED_IDS_KEY)) || '[]')
  await Promise.all(stored.map((id) => Notifications.cancelScheduledNotificationAsync(id)))
  await AsyncStorage.removeItem(SCHEDULED_IDS_KEY)
}

const scheduleOne = async (title, body, triggerDate) => {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: Platform.OS === 'android' ? 'cycle-reminders' : undefined,
    },
  })
}

export const scheduleAllNotifications = async (prediction) => {
  if (Platform.OS === 'web') return false
  if (!prediction?.nextPeriodStart) return false

  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) return false

  await ensureAndroidChannel()
  await cancelAllScheduledNotifications()

  const prefs = await getNotificationPrefs()
  const scheduledIds = []
  const now = new Date()

  if (prefs.periodReminder && prediction.nextPeriodStart) {
    const periodDate = new Date(`${prediction.nextPeriodStart}T09:00:00`)
    periodDate.setDate(periodDate.getDate() - prefs.periodLeadDays)
    const trigger = adjustForQuietHours(periodDate, prefs)
    if (trigger > now) {
      const daysText = prefs.periodLeadDays === 1 ? 'tomorrow' : `in ${prefs.periodLeadDays} days`
      const id = await scheduleOne(
        `Period expected ${daysText}`,
        'Based on your recent cycle history. Prepare what you need.',
        trigger,
      )
      scheduledIds.push(id)
    }
  }

  if (prefs.fertileReminder && prediction.ovulationWindowStart) {
    const fertileDate = new Date(`${prediction.ovulationWindowStart}T09:00:00`)
    fertileDate.setDate(fertileDate.getDate() - 1)
    const trigger = adjustForQuietHours(fertileDate, prefs)
    if (trigger > now) {
      const id = await scheduleOne(
        'Fertile window starts tomorrow',
        'Your estimated fertile window begins tomorrow based on cycle data.',
        trigger,
      )
      scheduledIds.push(id)
    }
  }

  if (prefs.dailyMoodReminder) {
    const reminderTime = new Date()
    reminderTime.setHours(prefs.moodReminderHour, prefs.moodReminderMinute, 0, 0)
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1)
    }
    const trigger = adjustForQuietHours(reminderTime, prefs)
    if (trigger > now) {
      const id = await scheduleOne(
        'How are you feeling today?',
        'Take a moment to log your mood. It helps reveal patterns over time.',
        trigger,
      )
      scheduledIds.push(id)
    }
  }

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(scheduledIds))
  return scheduledIds.length > 0
}

export const rescheduleAfterCycleLog = async (prediction) => {
  await cancelAllScheduledNotifications()
  const prefs = await getNotificationPrefs()
  const anyEnabled = prefs.periodReminder || prefs.fertileReminder || prefs.dailyMoodReminder
  if (!anyEnabled) return false
  return scheduleAllNotifications(prediction)
}
