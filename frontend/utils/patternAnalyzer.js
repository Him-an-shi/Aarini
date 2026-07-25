import { parseLocalDate } from './cyclePrediction';
import { mean, standardDeviation, detectTrend, computeCorrelation } from './statisticalUtils';

const DAY_MS = 24 * 60 * 60 * 1000;
const diffDays = (later, earlier) => Math.round((later - earlier) / DAY_MS);

export function analyzeCycleRegularity(cycles) {
  const sorted = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate) }))
    .filter((c) => c.start)
    .sort((a, b) => a.start - b.start);

  if (sorted.length < 2) {
    return { score: null, label: 'Insufficient data', details: 'Log at least 2 cycles for regularity analysis.' };
  }

  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(sorted[i].start, sorted[i - 1].start);
    if (gap >= 15 && gap <= 60) intervals.push(gap);
  }

  if (intervals.length < 2) {
    return { score: null, label: 'Needs more data', details: 'More consistent cycle logging needed.' };
  }

  const avg = mean(intervals);
  const stdDev = standardDeviation(intervals);
  const cv = (stdDev / avg) * 100;
  const trend = detectTrend(intervals);

  let score, label, details;
  if (cv < 8) {
    score = 5;
    label = 'Very Regular';
    details = `Your cycle length is very consistent (CV: ${cv.toFixed(1)}%). Excellent hormonal health indicator.`;
  } else if (cv < 15) {
    score = 4;
    label = 'Regular';
    details = `Your cycle shows normal variation (CV: ${cv.toFixed(1)}%). Typical for most women.`;
  } else if (cv < 25) {
    score = 3;
    label = 'Moderately Variable';
    details = `Your cycle varies more than average (CV: ${cv.toFixed(1)}%). Consider tracking stress, diet, and sleep.`;
  } else {
    score = 2;
    label = 'Highly Variable';
    details = `Significant cycle variation detected (CV: ${cv.toFixed(1)}%). May warrant a conversation with your healthcare provider.`;
  }

  return { score, label, details, avgLength: Math.round(avg), stdDev: Math.round(stdDev * 10) / 10, cv: Math.round(cv * 10) / 10, trend, intervals };
}

export function analyzeSymptomPatterns(symptoms) {
  const byDate = {};
  symptoms.forEach((s) => {
    const date = s.date || s.loggedAt;
    if (!date) return;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(s);
  });

  const sortedDates = Object.keys(byDate).sort();
  if (sortedDates.length < 3) return null;

  const severityMap = { mild: 1, moderate: 2, severe: 3 };
  const severityTrend = sortedDates.map((date) => {
    const daySymptoms = byDate[date];
    const avgSeverity = mean(daySymptoms.map((s) => severityMap[s.severity?.toLowerCase()] || 0).filter(Boolean));
    return { date, avgSeverity, count: daySymptoms.length };
  });

  const mostFrequent = {};
  symptoms.forEach((s) => {
    const type = s.type || s.symptom;
    if (type) mostFrequent[type.toLowerCase()] = (mostFrequent[type.toLowerCase()] || 0) + 1;
  });

  const topSymptoms = Object.entries(mostFrequent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalLogged: symptoms.length,
    uniqueDates: sortedDates.length,
    severityTrend,
    topSymptoms,
    mostActiveDate: sortedDates.reduce((a, b) => byDate[a].length > byDate[b].length ? a : b),
  };
}

export function calculateCycleQualityScore(cycles, symptoms, moods) {
  const regularity = analyzeCycleRegularity(cycles);
  if (!regularity.score) return null;

  const moodValues = Object.values(moods || {})
    .map((e) => ({ great: 5, good: 4, okay: 3, low: 2, bad: 1 }[e.mood?.toLowerCase()]))
    .filter(Boolean);

  const symptomCount = symptoms?.length || 0;
  const moodCount = moodValues.length;

  const dataCompleteness = Math.min((moodCount + symptomCount) / 60, 1);
  const regularityWeight = 0.5;
  const completenessWeight = 0.3;
  const trackingConsistency = Math.min((cycles.length / 6), 1) * 0.2;

  const rawScore = (regularity.score / 5) * regularityWeight + dataCompleteness * completenessWeight + trackingConsistency;
  const finalScore = Math.min(Math.round(rawScore * 100), 100);

  let interpretation;
  if (finalScore >= 80) interpretation = 'Excellent tracking habits with regular patterns.';
  else if (finalScore >= 60) interpretation = 'Good awareness. Continue consistent logging for better insights.';
  else if (finalScore >= 40) interpretation = 'Building awareness. Try logging symptoms and mood daily.';
  else interpretation = 'Getting started! Regular logging will unlock personalized insights.';

  return {
    score: finalScore,
    regularity: regularity.label,
    dataCompleteness: Math.round(dataCompleteness * 100),
    interpretation,
    cycleCount: cycles.length,
    moodCount,
    symptomCount,
  };
}

export function analyzeMoodTrendByPhase(moodEntries, cycles) {
  const sortedCycles = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate), end: parseLocalDate(c.endDate) }))
    .filter((c) => c.start)
    .sort((a, b) => a.start - b.start);

  if (sortedCycles.length < 2) return null;

  const intervals = [];
  for (let i = 1; i < sortedCycles.length; i++) {
    intervals.push(diffDays(sortedCycles[i].start, sortedCycles[i - 1].start));
  }
  const avgCycle = Math.round(mean(intervals.filter((g) => g >= 15 && g <= 60)) || 28);
  const durations = sortedCycles.map((c) => diffDays(c.end, c.start) + 1).filter((d) => d >= 1 && d <= 14);
  const avgPeriod = durations.length ? Math.round(mean(durations)) : 5;

  const phaseMoods = { Menstrual: [], Follicular: [], Ovulation: [], Luteal: [] };
  const moodScale = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };

  Object.entries(moodEntries || {}).forEach(([dateKey, entry]) => {
    if (!entry?.mood) return;
    const moodVal = moodScale[entry.mood.toLowerCase()];
    if (!moodVal) return;

    const date = parseLocalDate(dateKey);
    if (!date) return;

    for (let i = sortedCycles.length - 1; i >= 0; i--) {
      const cycleStart = sortedCycles[i].start;
      const nextStart = i < sortedCycles.length - 1 ? sortedCycles[i + 1].start : new Date(cycleStart.getTime() + avgCycle * DAY_MS);
      if (date >= cycleStart && date < nextStart) {
        const cycleDay = diffDays(date, cycleStart) + 1;
        let phase;
        if (cycleDay <= avgPeriod) phase = 'Menstrual';
        else if (cycleDay <= Math.max(avgPeriod + 1, avgCycle - 15) - 6) phase = 'Follicular';
        else if (cycleDay <= Math.max(avgPeriod + 1, avgCycle - 15) + 1) phase = 'Ovulation';
        else phase = 'Luteal';
        if (phaseMoods[phase]) phaseMoods[phase].push(moodVal);
        break;
      }
    }
  });

  const result = {};
  let hasData = false;
  Object.entries(phaseMoods).forEach(([phase, values]) => {
    if (values.length >= 3) {
      hasData = true;
      result[phase] = {
        avg: Math.round(mean(values) * 10) / 10,
        count: values.length,
        stdDev: Math.round(standardDeviation(values) * 10) / 10,
      };
    }
  });

  return hasData ? result : null;
}
