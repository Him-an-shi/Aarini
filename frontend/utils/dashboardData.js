import AsyncStorage from '@react-native-async-storage/async-storage';

const MOOD_KEY = '@aarini_mood_entries';
const MED_ADHERENCE_KEY = '@aarini_med_adherence';
const MEDS_KEY = '@aarini_medications';

function getDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateKey, days) {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getDateKey(d);
}

export function computeLoggingStreak(loggedDays) {
  const today = getDateKey();
  let count = 0;
  let check = today;
  while (loggedDays[check]) {
    count++;
    check = addDays(check, -1);
  }
  return count;
}

export async function getDashboardData(cycles, prediction) {
  const today = getDateKey();

  const moodRaw = await AsyncStorage.getItem(MOOD_KEY);
  const moods = moodRaw ? JSON.parse(moodRaw) : {};

  const moodValues = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDays(today, -i);
    const entry = moods[key];
    if (entry && entry.mood && moodValues[entry.mood]) {
      last7.push(moodValues[entry.mood]);
    }
  }

  const medsRaw = await AsyncStorage.getItem(MEDS_KEY);
  const meds = medsRaw ? JSON.parse(medsRaw) : [];
  const adherenceRaw = await AsyncStorage.getItem(MED_ADHERENCE_KEY);
  const adherence = adherenceRaw ? JSON.parse(adherenceRaw) : {};

  const activeMeds = meds.filter((m) => m.active);
  const todayMeds = activeMeds.map((m) => ({
    id: m.id,
    name: m.name,
    dosage: m.dosage,
    taken: adherence[m.id]?.[today] === 'taken',
  }));

  let daysUntilNext = null;
  let nextEvent = null;
  if (prediction?.nextPeriodStart) {
    const nextDate = new Date(prediction.nextPeriodStart + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diff = Math.round((nextDate - todayDate) / (24 * 60 * 60 * 1000));
    if (diff > 0) {
      daysUntilNext = diff;
      nextEvent = 'period';
    }
  }
  if (prediction?.ovulationWindowStart && (!daysUntilNext || daysUntilNext > 14)) {
    const ovDate = new Date(prediction.ovulationWindowStart + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diff = Math.round((ovDate - todayDate) / (24 * 60 * 60 * 1000));
    if (diff > 0 && diff < (daysUntilNext || Infinity)) {
      daysUntilNext = diff;
      nextEvent = 'fertile window';
    }
  }

  return {
    moodSparkline: last7,
    todayMeds,
    daysUntilNext,
    nextEvent,
    cycleDay: prediction?.cycleDay || null,
    currentPhase: prediction?.currentPhase || null,
  };
}
