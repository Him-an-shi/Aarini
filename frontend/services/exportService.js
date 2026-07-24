import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const MOOD_STORAGE_KEY = '@aarini_mood_entries'
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000'

async function fetchCyclesFromBackend(token, userId) {
  try {
    const res = await fetch(`${BACKEND_URL}/cycles`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-User-Id': userId || 'mock_user_123',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.cycles || []
  } catch {
    return []
  }
}

async function fetchSymptomsFromBackend(userId) {
  try {
    const res = await fetch(`${BACKEND_URL}/symptoms?uid=${userId || 'mock_user_123'}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : data.symptoms || []
  } catch {
    return []
  }
}

async function getMoodEntries() {
  try {
    const raw = await AsyncStorage.getItem(MOOD_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function formatReadableReport(cycles, moods, symptoms) {
  const lines = []
  lines.push('=== Aarini Health Data Export ===')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')

  lines.push('--- Cycle History ---')
  if (cycles.length === 0) {
    lines.push('No cycles logged.')
  } else {
    cycles.forEach((c, i) => {
      lines.push(`Cycle ${i + 1}: ${c.startDate} to ${c.endDate || 'ongoing'}`)
      if (c.flowIntensity) lines.push(`  Flow: ${c.flowIntensity}`)
      if (c.symptoms && c.symptoms.length) lines.push(`  Symptoms: ${c.symptoms.join(', ')}`)
      if (c.mood) lines.push(`  Mood: ${c.mood}`)
    })
  }
  lines.push('')

  lines.push('--- Mood History ---')
  const moodEntries = Object.entries(moods)
  if (moodEntries.length === 0) {
    lines.push('No mood entries.')
  } else {
    moodEntries
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([date, entry]) => {
        const note = entry.note ? ` - ${entry.note}` : ''
        lines.push(`${date}: ${entry.mood}${note}`)
      })
  }
  lines.push('')

  lines.push('--- Symptom History ---')
  if (symptoms.length === 0) {
    lines.push('No symptoms logged.')
  } else {
    symptoms.forEach((s) => {
      lines.push(`${s.date}: ${s.type} (${s.severity})`)
    })
  }
  lines.push('')
  lines.push('--- End of Report ---')

  return lines.join('\n')
}

export async function exportHealthData(token, userId) {
  const [cycles, moods, symptoms] = await Promise.all([
    fetchCyclesFromBackend(token, userId),
    getMoodEntries(),
    fetchSymptomsFromBackend(userId),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    app: 'Aarini',
    version: '1.0',
    cycles,
    moods,
    symptoms,
  }

  const jsonContent = JSON.stringify(exportData, null, 2)
  const readableContent = formatReadableReport(cycles, moods, symptoms)

  const timestamp = new Date().toISOString().slice(0, 10)
  const jsonPath = `${FileSystem.cacheDirectory}aarini-export-${timestamp}.json`
  const textPath = `${FileSystem.cacheDirectory}aarini-export-${timestamp}.txt`

  await FileSystem.writeAsStringAsync(jsonPath, jsonContent)
  await FileSystem.writeAsStringAsync(textPath, readableContent)

  return {
    jsonPath,
    textPath,
    readableContent,
    recordCount: cycles.length + Object.keys(moods).length + symptoms.length,
  }
}

export async function shareExportFile(filePath) {
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    throw new Error('Sharing is not available on this device')
  }
  await Sharing.shareAsync(filePath, {
    mimeType: filePath.endsWith('.json') ? 'application/json' : 'text/plain',
    dialogTitle: 'Share Aarini Health Data',
  })
}
