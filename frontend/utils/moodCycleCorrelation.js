import { parseLocalDate } from './cyclePrediction'

const DAY_MS = 24 * 60 * 60 * 1000
const diffDays = (later, earlier) => Math.round((later - earlier) / DAY_MS)

const MOOD_VALUES = { great: 5, good: 4, okay: 3, low: 2, bad: 1 }

/**
 * Determine which cycle day a given date falls on.
 * Day 1 = first day of the period that started the cycle containing this date.
 * Returns null if the date doesn't fall within any known cycle window.
 */
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
 * Determine the phase for a given cycle day.
 */
function getPhaseForDay(cycleDay, avgPeriodLength, avgCycleLength) {
  if (cycleDay <= avgPeriodLength) return 'Menstrual'
  const ovulationDay = Math.max(avgPeriodLength + 1, avgCycleLength - 15)
  const ovulationStart = ovulationDay - 5
  const ovulationEnd = ovulationDay + 1
  if (cycleDay < ovulationStart) return 'Follicular'
  if (cycleDay <= ovulationEnd) return 'Ovulation'
  return 'Luteal'
}

/**
 * Core correlation function.
 *
 * Takes mood entries (date-keyed object from MoodTrackingScreen) and
 * cycle history (array from /cycles endpoint), then maps each mood to
 * its cycle day and computes per-day averages across all cycles.
 *
 * Returns null if insufficient data (< 2 cycles or < 14 mood entries).
 */
export function computeMoodCycleCorrelation(moodEntries, cycles) {
  const sortedCycles = cycles
    .map((c) => ({ ...c, start: parseLocalDate(c.startDate), end: parseLocalDate(c.endDate) }))
    .filter((c) => c.start && c.end)
    .sort((a, b) => a.start - b.start)

  if (sortedCycles.length < 2) return null

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

  const moodDates = Object.keys(moodEntries).filter((key) => {
    const entry = moodEntries[key]
    return entry && entry.mood && MOOD_VALUES[entry.mood.toLowerCase()] !== undefined
  })

  if (moodDates.length < 14) return null

  const dayBuckets = {}

  for (const dateKey of moodDates) {
    const cycleDay = getCycleDayForDate(dateKey, sortedCycles, avgCycleLength)
    if (cycleDay === null || cycleDay < 1 || cycleDay > avgCycleLength) continue

    const moodValue = MOOD_VALUES[moodEntries[dateKey].mood.toLowerCase()]
    if (!dayBuckets[cycleDay]) {
      dayBuckets[cycleDay] = { total: 0, count: 0 }
    }
    dayBuckets[cycleDay].total += moodValue
    dayBuckets[cycleDay].count += 1
  }

  const mappedCount = Object.values(dayBuckets).reduce((sum, b) => sum + b.count, 0)
  if (mappedCount < 10) return null

  const dayAverages = []
  for (let day = 1; day <= avgCycleLength; day++) {
    const bucket = dayBuckets[day]
    dayAverages.push({
      day,
      average: bucket ? Math.round((bucket.total / bucket.count) * 10) / 10 : null,
      count: bucket ? bucket.count : 0,
      phase: getPhaseForDay(day, avgPeriodLength, avgCycleLength),
    })
  }

  const phaseBands = computePhaseBands(avgPeriodLength, avgCycleLength)
  const patterns = detectPatterns(dayAverages, avgPeriodLength, avgCycleLength)

  return {
    dayAverages,
    avgCycleLength,
    avgPeriodLength,
    phaseBands,
    patterns,
    totalMoodsMapped: mappedCount,
    cyclesUsed: sortedCycles.length,
  }
}

/**
 * Compute phase band boundaries for chart overlay.
 */
function computePhaseBands(avgPeriodLength, avgCycleLength) {
  const ovulationDay = Math.max(avgPeriodLength + 1, avgCycleLength - 15)
  return [
    { phase: 'Menstrual', start: 1, end: avgPeriodLength },
    { phase: 'Follicular', start: avgPeriodLength + 1, end: ovulationDay - 6 },
    { phase: 'Ovulation', start: ovulationDay - 5, end: ovulationDay + 1 },
    { phase: 'Luteal', start: ovulationDay + 2, end: avgCycleLength },
  ]
}

/**
 * Detect significant mood patterns (dips and peaks).
 * A pattern is "significant" if a stretch of 3+ consecutive days
 * averages notably below or above the overall mean.
 */
function detectPatterns(dayAverages, avgPeriodLength, avgCycleLength) {
  const withData = dayAverages.filter((d) => d.average !== null)
  if (withData.length < 5) return []

  const overallMean = withData.reduce((sum, d) => sum + d.average, 0) / withData.length
  const threshold = 0.6
  const patterns = []

  let streakStart = null
  let streakType = null

  for (let i = 0; i < dayAverages.length; i++) {
    const entry = dayAverages[i]
    if (entry.average === null) {
      if (streakStart !== null && i - streakStart >= 3) {
        patterns.push(
          buildPattern(
            dayAverages,
            streakStart,
            i - 1,
            streakType,
            overallMean,
            avgPeriodLength,
            avgCycleLength,
          ),
        )
      }
      streakStart = null
      streakType = null
      continue
    }

    const diff = entry.average - overallMean
    const type = diff < -threshold ? 'dip' : diff > threshold ? 'peak' : null

    if (type !== streakType) {
      if (streakStart !== null && i - streakStart >= 3) {
        patterns.push(
          buildPattern(
            dayAverages,
            streakStart,
            i - 1,
            streakType,
            overallMean,
            avgPeriodLength,
            avgCycleLength,
          ),
        )
      }
      streakStart = type ? i : null
      streakType = type
    }
  }

  if (streakStart !== null && dayAverages.length - streakStart >= 3) {
    patterns.push(
      buildPattern(
        dayAverages,
        streakStart,
        dayAverages.length - 1,
        streakType,
        overallMean,
        avgPeriodLength,
        avgCycleLength,
      ),
    )
  }

  return patterns.filter(Boolean).slice(0, 3)
}

function buildPattern(dayAverages, start, end, type, overallMean, avgPeriodLength, avgCycleLength) {
  if (!type) return null
  const days = dayAverages.slice(start, end + 1).filter((d) => d.average !== null)
  if (days.length < 3) return null

  const avg = days.reduce((sum, d) => sum + d.average, 0) / days.length
  const phase = getPhaseForDay(Math.round((start + end) / 2) + 1, avgPeriodLength, avgCycleLength)

  return {
    type,
    startDay: start + 1,
    endDay: end + 1,
    averageMood: Math.round(avg * 10) / 10,
    phase,
    deviation: Math.round((avg - overallMean) * 10) / 10,
  }
}

/**
 * Generate a brief human-readable summary for a detected pattern.
 */
export function generatePatternSummary(pattern) {
  if (!pattern) return ''
  const dayRange = `days ${pattern.startDay}-${pattern.endDay}`
  const phaseLabel = pattern.phase.toLowerCase()

  if (pattern.type === 'dip') {
    return `Your mood tends to dip on ${dayRange}, during ${phaseLabel} phase. This is common and often linked to hormonal shifts.`
  }
  return `Your mood tends to peak on ${dayRange}, during ${phaseLabel} phase. Your body responds well to this part of the cycle.`
}

export const PHASE_COLORS = {
  Menstrual: '#FFDFE5',
  Follicular: '#E6E2F8',
  Ovulation: '#FFE5D9',
  Luteal: '#E8F5E9',
}

// =============================================================================
// Advanced Correlation Analysis: Lagged, Partial, and Directional
// =============================================================================

const MIN_OVERLAP_THRESHOLD = 10
const MAX_LAG = 7
const PERMUTATION_ITERATIONS = 1000
const SIGNIFICANCE_THRESHOLD = 0.05

/**
 * Compute Pearson correlation coefficient between two arrays.
 * Handles missing values via pairwise deletion.
 */
function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 3) return { r: 0, n: 0 }

  const pairs = []
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== null && y[i] !== null && !isNaN(x[i]) && !isNaN(y[i])) {
      pairs.push([x[i], y[i]])
    }
  }

  const n = pairs.length
  if (n < MIN_OVERLAP_THRESHOLD) return { r: 0, n }

  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n

  let sumXY = 0,
    sumXX = 0,
    sumYY = 0
  for (const [xi, yi] of pairs) {
    const dx = xi - meanX
    const dy = yi - meanY
    sumXY += dx * dy
    sumXX += dx * dx
    sumYY += dy * dy
  }

  const denom = Math.sqrt(sumXX * sumYY)
  if (denom < 1e-10) return { r: 0, n }

  return { r: sumXY / denom, n }
}

/**
 * Compute lagged cross-correlation between mood and cycle phase scores.
 * Tests lags from -MAX_LAG to +MAX_LAG days.
 *
 * Positive lag: mood leads cycle (mood at time t correlates with cycle at t+lag)
 * Negative lag: cycle leads mood (cycle at time t correlates with mood at t+|lag|)
 *
 * @param {number[]} moodSeries - Daily mood scores (1-5)
 * @param {number[]} cycleSeries - Daily cycle phase scores (numeric encoding)
 * @param {number} maxLag - Maximum lag offset to test (default 7)
 * @returns {object} Lag correlations with optimal lag identification
 */
export function computeLaggedCorrelation(moodSeries, cycleSeries, maxLag = MAX_LAG) {
  if (!moodSeries || !cycleSeries || moodSeries.length < MIN_OVERLAP_THRESHOLD) {
    return { correlations: [], optimalLag: 0, optimalR: 0, direction: 'none' }
  }

  const n = Math.min(moodSeries.length, cycleSeries.length)
  const correlations = []

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const xSlice = []
    const ySlice = []

    for (let i = 0; i < n; i++) {
      const moodIdx = i
      const cycleIdx = i + lag

      if (cycleIdx >= 0 && cycleIdx < n) {
        xSlice.push(moodSeries[moodIdx])
        ySlice.push(cycleSeries[cycleIdx])
      }
    }

    const { r, n: pairCount } = pearsonCorrelation(xSlice, ySlice)
    correlations.push({ lag, r: Math.round(r * 1000) / 1000, n: pairCount })
  }

  // Find optimal lag (maximum absolute correlation)
  let optimalLag = 0
  let optimalR = 0
  for (const c of correlations) {
    if (Math.abs(c.r) > Math.abs(optimalR) && c.n >= MIN_OVERLAP_THRESHOLD) {
      optimalR = c.r
      optimalLag = c.lag
    }
  }

  const direction = optimalLag > 0 ? 'mood_leads' : optimalLag < 0 ? 'cycle_leads' : 'synchronous'

  return {
    correlations,
    optimalLag,
    optimalR,
    direction,
    interpretation: interpretLag(optimalLag, optimalR),
  }
}

function interpretLag(lag, r) {
  const strength = Math.abs(r) > 0.5 ? 'strong' : Math.abs(r) > 0.3 ? 'moderate' : 'weak'
  const sign = r > 0 ? 'positive' : 'negative'

  if (lag === 0) return `${strength} ${sign} synchronous correlation`
  if (lag > 0)
    return `${strength} ${sign} correlation: mood changes ${lag} day(s) before cycle phase shifts`
  return `${strength} ${sign} correlation: cycle phase shifts ${Math.abs(lag)} day(s) before mood changes`
}

/**
 * Compute partial correlation between target and predictor,
 * controlling for confounding variables.
 *
 * Uses residualization: regress both target and predictor on confounders,
 * then correlate the residuals.
 *
 * @param {number[]} target - Target variable (e.g., mood scores)
 * @param {number[]} predictor - Predictor variable (e.g., cycle day)
 * @param {number[][]} confounders - Array of confounding variables (e.g., [sleep, exercise])
 * @returns {object} Partial correlation with effect size
 */
export function computePartialCorrelation(target, predictor, confounders = []) {
  if (!target || !predictor || target.length < MIN_OVERLAP_THRESHOLD) {
    return { r: 0, n: 0, effectSize: 'none', controlled: [] }
  }

  if (confounders.length === 0) {
    const { r, n } = pearsonCorrelation(target, predictor)
    return { r, n, effectSize: classifyEffect(r), controlled: [] }
  }

  // Residualize target on confounders
  const targetResiduals = computeResiduals(target, confounders)
  // Residualize predictor on confounders
  const predictorResiduals = computeResiduals(predictor, confounders)

  const { r, n } = pearsonCorrelation(targetResiduals, predictorResiduals)

  return {
    r: Math.round(r * 1000) / 1000,
    n,
    effectSize: classifyEffect(r),
    controlled: confounders.map((_, i) => `confounder_${i}`),
  }
}

/**
 * Compute residuals after linear regression on multiple predictors.
 * Simple OLS via normal equations for each confounder independently.
 */
function computeResiduals(target, predictors) {
  const n = target.length
  const residuals = [...target]

  for (const predictor of predictors) {
    // Simple linear regression: y = a + b*x
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0
    let count = 0

    for (let i = 0; i < n; i++) {
      if (residuals[i] !== null && predictor[i] !== null) {
        sumX += predictor[i]
        sumY += residuals[i]
        sumXY += predictor[i] * residuals[i]
        sumXX += predictor[i] * predictor[i]
        count++
      }
    }

    if (count < 3) continue

    const meanX = sumX / count
    const meanY = sumY / count
    const b = (sumXY - count * meanX * meanY) / (sumXX - count * meanX * meanX || 1)
    const a = meanY - b * meanX

    // Subtract predicted values to get residuals
    for (let i = 0; i < n; i++) {
      if (residuals[i] !== null && predictor[i] !== null) {
        residuals[i] = residuals[i] - (a + b * predictor[i])
      }
    }
  }

  return residuals
}

function classifyEffect(r) {
  const absR = Math.abs(r)
  if (absR >= 0.5) return 'strong'
  if (absR >= 0.3) return 'moderate'
  if (absR >= 0.1) return 'weak'
  return 'negligible'
}

/**
 * Permutation-based significance test for correlation.
 * Shuffles one series N times and computes the p-value as the proportion
 * of permuted correlations exceeding the observed correlation.
 *
 * @param {number[]} x - First series
 * @param {number[]} y - Second series
 * @param {number} iterations - Number of permutations (default 1000)
 * @returns {object} p-value and significance flag
 */
export function permutationTest(x, y, iterations = PERMUTATION_ITERATIONS) {
  const { r: observedR, n } = pearsonCorrelation(x, y)
  if (n < MIN_OVERLAP_THRESHOLD) return { pValue: 1.0, significant: false, observedR }

  // Filter to complete pairs
  const pairs = []
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== null && y[i] !== null && i < y.length) {
      pairs.push([x[i], y[i]])
    }
  }

  const xClean = pairs.map((p) => p[0])
  const yClean = pairs.map((p) => p[1])

  let exceedCount = 0
  const seededRandom = createSeededRandom(42)

  for (let iter = 0; iter < iterations; iter++) {
    // Fisher-Yates shuffle of y
    const shuffled = [...yClean]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const { r: permR } = pearsonCorrelation(xClean, shuffled)
    if (Math.abs(permR) >= Math.abs(observedR)) {
      exceedCount++
    }
  }

  const pValue = exceedCount / iterations
  return {
    pValue: Math.round(pValue * 1000) / 1000,
    significant: pValue < SIGNIFICANCE_THRESHOLD,
    observedR: Math.round(observedR * 1000) / 1000,
    iterations,
  }
}

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Ensures reproducible permutation tests.
 */
function createSeededRandom(seed) {
  let state = seed
  return function () {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Granger-causality-inspired directional analysis.
 * Tests whether past values of X improve prediction of Y beyond Y's own past.
 *
 * Computes prediction improvement: correlation of Y with lagged X vs Y with lagged Y.
 * The variable that provides more predictive improvement "Granger-causes" the other.
 *
 * @param {number[]} moodSeries - Mood scores
 * @param {number[]} cycleSeries - Cycle phase scores
 * @param {number} lag - Lag to test (default 1)
 * @returns {object} Directional analysis result
 */
export function computeDirectionalAnalysis(moodSeries, cycleSeries, lag = 2) {
  const n = Math.min(moodSeries.length, cycleSeries.length)
  if (n < MIN_OVERLAP_THRESHOLD + lag) {
    return { direction: 'insufficient_data', moodLeadsScore: 0, cycleLeadsScore: 0 }
  }

  // Test: does past mood predict current cycle better than past cycle alone?
  const pastMood = moodSeries.slice(0, n - lag)
  const currentCycle = cycleSeries.slice(lag, n)
  const { r: moodLeadsR } = pearsonCorrelation(pastMood, currentCycle)

  // Test: does past cycle predict current mood better than past mood alone?
  const pastCycle = cycleSeries.slice(0, n - lag)
  const currentMood = moodSeries.slice(lag, n)
  const { r: cycleLeadsR } = pearsonCorrelation(pastCycle, currentMood)

  // Auto-regression baselines
  const pastMoodForMood = moodSeries.slice(0, n - lag)
  const currentMoodForAR = moodSeries.slice(lag, n)
  const { r: moodARR } = pearsonCorrelation(pastMoodForMood, currentMoodForAR)

  const pastCycleForCycle = cycleSeries.slice(0, n - lag)
  const currentCycleForAR = cycleSeries.slice(lag, n)
  const { r: cycleARR } = pearsonCorrelation(pastCycleForCycle, currentCycleForAR)

  // Improvement over auto-regression
  const moodLeadsImprovement = Math.abs(moodLeadsR) - Math.abs(cycleARR)
  const cycleLeadsImprovement = Math.abs(cycleLeadsR) - Math.abs(moodARR)

  let direction
  if (moodLeadsImprovement > cycleLeadsImprovement + 0.05) {
    direction = 'mood_causes_cycle'
  } else if (cycleLeadsImprovement > moodLeadsImprovement + 0.05) {
    direction = 'cycle_causes_mood'
  } else {
    direction = 'bidirectional'
  }

  return {
    direction,
    moodLeadsScore: Math.round(moodLeadsImprovement * 1000) / 1000,
    cycleLeadsScore: Math.round(cycleLeadsImprovement * 1000) / 1000,
    lag,
    interpretation:
      direction === 'mood_causes_cycle'
        ? `Mood changes appear to predict cycle phase shifts (${lag}-day lag)`
        : direction === 'cycle_causes_mood'
          ? `Cycle phase shifts appear to predict mood changes (${lag}-day lag)`
          : 'Mood and cycle appear to influence each other bidirectionally',
  }
}

/**
 * Comprehensive mood-cycle correlation analysis combining all methods.
 * This is the main entry point for the advanced analysis.
 */
export function computeAdvancedCorrelation(moodSeries, cycleSeries, confounders = []) {
  const lagged = computeLaggedCorrelation(moodSeries, cycleSeries)
  const significance = permutationTest(moodSeries, cycleSeries)
  const partial = computePartialCorrelation(moodSeries, cycleSeries, confounders)
  const directional = computeDirectionalAnalysis(moodSeries, cycleSeries)

  return {
    lagged,
    significance,
    partial,
    directional,
    summary: {
      hasSignificantCorrelation: significance.significant,
      strongestCorrelation: lagged.optimalR,
      optimalLag: lagged.optimalLag,
      direction: directional.direction,
      effectSize: partial.effectSize,
    },
  }
}
