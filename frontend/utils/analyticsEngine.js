import { parseLocalDate, predictCycleLocally, toDateKey } from './cyclePrediction';

const DAY_MS = 24 * 60 * 60 * 1000;
const diffDays = (later, earlier) => Math.round((later - earlier) / DAY_MS);

export function computeCycleLengths(cycles) {
  const sorted = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate) }))
    .filter((c) => c.start)
    .sort((a, b) => a.start - b.start);

  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(sorted[i].start, sorted[i - 1].start);
    if (gap >= 15 && gap <= 60) lengths.push({ length: gap, date: sorted[i].startDate });
  }
  return lengths;
}

export function computePredictionAccuracy(cycles, fallbackLength = 28) {
  const sorted = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate), end: parseLocalDate(c.endDate) }))
    .filter((c) => c.start && c.end)
    .sort((a, b) => a.start - b.start);

  if (sorted.length < 3) return { entries: [], accuracy: null };

  const entries = [];
  for (let i = 2; i < sorted.length; i++) {
    const historySoFar = sorted.slice(0, i);
    const dayBeforeActual = new Date(sorted[i].start.getTime() - DAY_MS);
    const prediction = predictCycleLocally(historySoFar, fallbackLength, dayBeforeActual);
    if (!prediction.hasHistory) continue;

    const predictedStart = parseLocalDate(prediction.nextPeriodStart);
    const actualStart = sorted[i].start;
    if (!predictedStart) continue;

    const delta = diffDays(actualStart, predictedStart);
    entries.push({
      cycleIndex: i,
      predicted: toDateKey(predictedStart),
      actual: toDateKey(actualStart),
      deltaDays: delta,
      accurate: Math.abs(delta) <= 2,
    });
  }

  const accurateCount = entries.filter((e) => e.accurate).length;
  const accuracy = entries.length > 0 ? Math.round((accurateCount / entries.length) * 100) : null;

  return { entries, accuracy };
}

export function computeSymptomFrequency(symptoms) {
  const counts = {};
  symptoms.forEach((entry) => {
    const type = entry.type || entry.symptom;
    if (type) {
      const key = String(type).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    const list = Array.isArray(entry.symptoms) ? entry.symptoms : [];
    list.forEach((sym) => {
      const key = String(sym).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function getPhaseAwareTips(currentPhase) {
  const tips = {
    Menstrual: [
      'Iron-rich foods (spinach, lentils) help replenish lost stores during your period.',
      'Gentle movement like yoga or walking can ease cramps more than total rest.',
      'Warm compresses on the lower abdomen relax uterine muscles naturally.',
    ],
    Follicular: [
      'Energy is rising as estrogen climbs. Great time for challenging workouts.',
      'Your skin tends to be clearest now. Good time for exfoliation routines.',
      'Focus and creativity peak in this phase. Plan demanding tasks here.',
    ],
    Ovulation: [
      'You may notice increased energy and sociability around ovulation.',
      'Cervical mucus changes are normal and a sign of healthy hormone function.',
      'This is your most fertile window. Predictions are not contraception.',
    ],
    Luteal: [
      'Progesterone rises and can increase appetite. Choose complex carbs for stable energy.',
      'Sleep quality may decrease. Keep a consistent bedtime and limit screens.',
      'Mood dips are common in late luteal phase. Be gentle with yourself.',
    ],
  };

  return tips[currentPhase] || tips.Luteal;
}

export function computeCycleVariance(lengths) {
  if (lengths.length < 2) return null;
  const values = lengths.map((l) => l.length);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

export function computeCycleStability(lengths) {
  if (lengths.length < 2) return { stability: null, label: 'Needs more data' };
  const values = lengths.map((l) => l.length);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length);
  const cv = (stdDev / avg) * 100;
  if (cv < 8) return { stability: 'very_regular', label: 'Very Regular', cv: Math.round(cv * 10) / 10 };
  if (cv < 15) return { stability: 'regular', label: 'Regular', cv: Math.round(cv * 10) / 10 };
  if (cv < 25) return { stability: 'moderate', label: 'Moderately Variable', cv: Math.round(cv * 10) / 10 };
  return { stability: 'variable', label: 'Highly Variable', cv: Math.round(cv * 10) / 10 };
}

export function computeSeasonalCycleInsights(cycles) {
  const sorted = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate) }))
    .filter((c) => c.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length < 4) return null;
  const byQuarter = { Q1: [], Q2: [], Q3: [], Q4: [] };
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(sorted[i].start, sorted[i - 1].start);
    if (gap < 15 || gap > 60) continue;
    const month = sorted[i].start.getMonth();
    const quarter = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';
    byQuarter[quarter].push(gap);
  }
  const result = {};
  Object.entries(byQuarter).forEach(([q, vals]) => {
    if (vals.length >= 2) {
      result[q] = { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), count: vals.length };
    }
  });
  return Object.keys(result).length > 0 ? result : null;
}
