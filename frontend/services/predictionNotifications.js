import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'

const NOTIFICATION_IDS_KEY = 'cyclePredictionNotificationIds'

export const cancelPredictionNotifications = async () => {
  if (Platform.OS === 'web') return
  const stored = JSON.parse((await AsyncStorage.getItem(NOTIFICATION_IDS_KEY)) || '[]')
  await Promise.all(stored.map((id) => Notifications.cancelScheduledNotificationAsync(id)))
  await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY)
}

export const schedulePredictionNotifications = async (prediction) => {
  if (Platform.OS === 'web' || !prediction?.nextPeriodStart) return false
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cycle-predictions', {
      name: 'Cycle predictions',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
  const permission = await Notifications.requestPermissionsAsync()
  if (permission.status !== 'granted') return false

  await cancelPredictionNotifications()
  const periodReminder = new Date(`${prediction.nextPeriodStart}T09:00:00`)
  periodReminder.setDate(periodReminder.getDate() - 1)
  const ovulationReminder = new Date(`${prediction.ovulationWindowStart}T09:00:00`)
  const scheduled = []

  const schedule = (title, body, date) =>
    Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: Platform.OS === 'android' ? 'cycle-predictions' : undefined,
      },
    })
  if (periodReminder > new Date()) {
    scheduled.push(
      await schedule(
        'Your period may start tomorrow',
        'Aarini’s estimate is based on your recent cycle history.',
        periodReminder,
      ),
    )
  }
  if (ovulationReminder > new Date()) {
    scheduled.push(
      await schedule(
        'Estimated ovulation window',
        'Your predicted fertile window begins today.',
        ovulationReminder,
      ),
    )
  }

  await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(scheduled))
  return true
}
