import AsyncStorage from '@react-native-async-storage/async-storage'

const STREAK_KEY = '@aarini_streak_data'

function getDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return getDateKey(d)
}

export async function getStreakData() {
  const raw = await AsyncStorage.getItem(STREAK_KEY)
  if (!raw) return { loggedDays: {}, currentStreak: 0, longestStreak: 0, milestones: [] }
  return JSON.parse(raw)
}

async function saveStreakData(data) {
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data))
}

export async function recordActivity(date) {
  const dateKey = date || getDateKey()
  const data = await getStreakData()
  data.loggedDays[dateKey] = true
  const { current, longest } = computeStreaks(data.loggedDays)
  data.currentStreak = current
  data.longestStreak = Math.max(data.longestStreak, longest)
  data.milestones = detectMilestones(data)
  await saveStreakData(data)
  return data
}

export function computeStreaks(loggedDays) {
  const today = getDateKey()
  let current = 0
  let checkDate = today

  while (loggedDays[checkDate]) {
    current++
    checkDate = addDays(checkDate, -1)
  }

  let longest = 0
  let streak = 0
  const sortedDays = Object.keys(loggedDays).sort()

  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      streak = 1
    } else {
      const expected = addDays(sortedDays[i - 1], 1)
      streak = sortedDays[i] === expected ? streak + 1 : 1
    }
    longest = Math.max(longest, streak)
  }

  return { current, longest }
}

const MILESTONE_THRESHOLDS = [
  { days: 7, label: '1 Week Streak', icon: 'flame' },
  { days: 14, label: '2 Week Streak', icon: 'flame' },
  { days: 30, label: '1 Month Streak', icon: 'trophy' },
  { days: 60, label: '2 Month Streak', icon: 'trophy' },
  { days: 90, label: '3 Month Streak', icon: 'star' },
]

const ENTRY_MILESTONES = [
  { count: 50, label: '50 Entries Logged', icon: 'target' },
  { count: 100, label: '100 Entries Logged', icon: 'target' },
  { count: 500, label: '500 Entries Logged', icon: 'crown' },
]

function detectMilestones(data) {
  const earned = []
  const totalEntries = Object.keys(data.loggedDays).length

  for (const milestone of MILESTONE_THRESHOLDS) {
    if (data.longestStreak >= milestone.days || data.currentStreak >= milestone.days) {
      earned.push({ ...milestone, achieved: true })
    }
  }

  for (const milestone of ENTRY_MILESTONES) {
    if (totalEntries >= milestone.count) {
      earned.push({ ...milestone, achieved: true })
    }
  }

  return earned
}

export function getActivityForMonth(loggedDays, year, month) {
  const days = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date: key, active: Boolean(loggedDays[key]) })
  }
  return days
}

export { MILESTONE_THRESHOLDS, ENTRY_MILESTONES }
