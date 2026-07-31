import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

const MEDS_KEY = '@aarini_medications'
const ADHERENCE_KEY = '@aarini_med_adherence'
const MED_NOTIF_IDS_KEY = '@aarini_med_notification_ids'

export async function getMedications() {
  const raw = await AsyncStorage.getItem(MEDS_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function saveMedications(meds) {
  await AsyncStorage.setItem(MEDS_KEY, JSON.stringify(meds))
}

export async function addMedication(med) {
  const meds = await getMedications()
  const newMed = {
    id: `med_${Date.now()}`,
    name: med.name,
    dosage: med.dosage || '',
    frequency: med.frequency || 'daily',
    reminderHour: med.reminderHour ?? 8,
    reminderMinute: med.reminderMinute ?? 0,
    active: true,
    createdAt: new Date().toISOString(),
  }
  meds.push(newMed)
  await saveMedications(meds)
  await scheduleMedicationReminders()
  return newMed
}

export async function updateMedication(id, updates) {
  const meds = await getMedications()
  const idx = meds.findIndex((m) => m.id === id)
  if (idx === -1) return null
  meds[idx] = { ...meds[idx], ...updates }
  await saveMedications(meds)
  await scheduleMedicationReminders()
  return meds[idx]
}

export async function deleteMedication(id) {
  const meds = await getMedications()
  const filtered = meds.filter((m) => m.id !== id)
  await saveMedications(filtered)
  const adherence = await getAdherence()
  delete adherence[id]
  await AsyncStorage.setItem(ADHERENCE_KEY, JSON.stringify(adherence))
  await scheduleMedicationReminders()
}

function getDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getAdherence() {
  const raw = await AsyncStorage.getItem(ADHERENCE_KEY)
  return raw ? JSON.parse(raw) : {}
}

export async function markTaken(medId, date) {
  const dateKey = date || getDateKey()
  const adherence = await getAdherence()
  if (!adherence[medId]) adherence[medId] = {}
  adherence[medId][dateKey] = 'taken'
  await AsyncStorage.setItem(ADHERENCE_KEY, JSON.stringify(adherence))
}

export async function markSkipped(medId, date) {
  const dateKey = date || getDateKey()
  const adherence = await getAdherence()
  if (!adherence[medId]) adherence[medId] = {}
  adherence[medId][dateKey] = 'skipped'
  await AsyncStorage.setItem(ADHERENCE_KEY, JSON.stringify(adherence))
}

export async function unmarkAdherence(medId, date) {
  const dateKey = date || getDateKey()
  const adherence = await getAdherence()
  if (adherence[medId]) {
    delete adherence[medId][dateKey]
    await AsyncStorage.setItem(ADHERENCE_KEY, JSON.stringify(adherence))
  }
}

export function getTodayAdherence(adherence, medId) {
  const today = getDateKey()
  return adherence[medId]?.[today] || null
}

export function getAdherenceForMonth(adherence, medId, year, month) {
  const days = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date: key, status: adherence[medId]?.[key] || null })
  }
  return days
}

export async function scheduleMedicationReminders() {
  if (Platform.OS === 'web') return

  const stored = JSON.parse((await AsyncStorage.getItem(MED_NOTIF_IDS_KEY)) || '[]')
  await Promise.all(stored.map((id) => Notifications.cancelScheduledNotificationAsync(id)))

  const meds = await getMedications()
  const activeMeds = meds.filter((m) => m.active)
  const ids = []

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medication-reminders', {
      name: 'Medication reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    })
  }

  for (const med of activeMeds) {
    if (med.frequency === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time to take ${med.name}`,
          body: med.dosage ? `Dosage: ${med.dosage}` : 'Tap to mark as taken.',
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: med.reminderHour,
          minute: med.reminderMinute,
          channelId: Platform.OS === 'android' ? 'medication-reminders' : undefined,
        },
      })
      ids.push(id)
    }
  }

  await AsyncStorage.setItem(MED_NOTIF_IDS_KEY, JSON.stringify(ids))
}
