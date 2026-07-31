import { parseLocalDate } from './cyclePrediction'

const DAY_MS = 24 * 60 * 60 * 1000
const diffDays = (later, earlier) => Math.round((later - earlier) / DAY_MS)

const PHASES = ['Menstrual', 'Follicular', 'Ovulation', 'Luteal']

function getPhaseForDay(cycleDay, avgPeriodLength, avgCycleLength) {
  if (cycleDay <= avgPeriodLength) return 'Menstrual'
  const ovulationDay = Math.max(avgPeriodLength + 1, avgCycleLength - 15)
  if (cycleDay < ovulationDay - 5) return 'Follicular'
  if (cycleDay <= ovulationDay + 1) return 'Ovulation'
  return 'Luteal'
}

function getCycleDayForDate(dateKey, sortedCycles, avgCycleLength) {
  const date = parseLocalDate(dateKey)
  if (!date) return null

  for (let i = sortedCycles.length - 1; i >= 0; i--) {
    const cycleStart = sortedCycles[i].start
    const nextStart =
      i < sortedCycles.length - 1
        ? sortedCycles[i + 1].start
        : new Date(cycleStart.getTime() + avgCycleLength * DAY_MS)

    if (date >= cycleStart && date < nextStart) {
      return diffDays(date, cycleStart) + 1
    }
  }
  return null
}

/**
 * Compute symptom-phase correlations.
 * Maps each symptom entry to the cycle phase it occurred in,
 * then identifies phase-dominant symptoms.
 *
 * Returns null if insufficient data (< 2 cycles or < 10 symptom entries).
 */
export function computeSymptomPhaseCorrelation(symptoms, cycles) {
  const sortedCycles = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate), end: parseLocalDate(c.endDate) }))
    .filter((c) => c.start && c.end)
    .sort((a, b) => a.start - b.start)

  if (sortedCycles.length < 2) return null
  if (symptoms.length < 10) return null

  const intervals = []
  for (let i = 1; i < sortedCycles.length; i++) {
    const gap = diffDays(sortedCycles[i].start, sortedCycles[i - 1].start)
    if (gap >= 15 && gap <= 60) intervals.push(gap)
  }
  const avgCycleLength = intervals.length
    ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : 28

  const durations = sortedCycles
    .map((c) => diffDays(c.end, c.start) + 1)
    .filter((d) => d >= 1 && d <= 14)
  const avgPeriodLength = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 5

  const phaseMap = {}

  for (const entry of symptoms) {
    const type = (entry.type || '').toLowerCase()
    if (!type) continue

    const dateKey = entry.date
    const cycleDay = getCycleDayForDate(dateKey, sortedCycles, avgCycleLength)
    if (cycleDay === null || cycleDay < 1 || cycleDay > avgCycleLength) continue

    const phase = getPhaseForDay(cycleDay, avgPeriodLength, avgCycleLength)

    if (!phaseMap[type]) {
      phaseMap[type] = { Menstrual: 0, Follicular: 0, Ovulation: 0, Luteal: 0, total: 0 }
    }
    phaseMap[type][phase]++
    phaseMap[type].total++
  }

  const correlations = Object.entries(phaseMap)
    .filter(([, counts]) => counts.total >= 3)
    .map(([symptom, counts]) => {
      const dominantPhase = PHASES.reduce(
        (max, p) => (counts[p] > counts[max] ? p : max),
        PHASES[0],
      )
      const dominantPercent = Math.round((counts[dominantPhase] / counts.total) * 100)

      return {
        symptom,
        total: counts.total,
        dominantPhase,
        dominantPercent,
        phaseCounts: { ...counts, total: undefined },
        isDominant: dominantPercent >= 50,
      }
    })
    .sort((a, b) => b.total - a.total)

  const dominant = correlations.filter((c) => c.isDominant)

  return {
    correlations,
    dominantSymptoms: dominant.slice(0, 5),
    totalMapped: Object.values(phaseMap).reduce((sum, c) => sum + c.total, 0),
    cyclesUsed: sortedCycles.length,
  }
}

/**
 * Generate a natural-language summary for a phase-dominant symptom.
 */
export function generateSymptomPhaseSummary(correlation) {
  if (!correlation || !correlation.isDominant) return ''
  const { symptom, dominantPhase, dominantPercent } = correlation
  const name = symptom.charAt(0).toUpperCase() + symptom.slice(1)
  return `${name} occurs ${dominantPercent}% during ${dominantPhase.toLowerCase()} phase. This pattern is common and often linked to hormonal changes in this part of your cycle.`
}
