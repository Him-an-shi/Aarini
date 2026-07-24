/**
 * Anomaly detection service for health data.
 * Scans logged cycles, moods, medications, and symptoms for concerning patterns.
 * Returns in-app alerts (never push notifications).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const DISMISSED_KEY = '@aarini:dismissed_alerts'

const RULES = {
  latePeriod: { daysOverdue: 7 },
  moodStreak: { consecutiveDays: 5, moods: ['bad', 'low', 'terrible', 'awful'] },
  medicationGap: { consecutiveMissed: 3 },
  symptomSeverity: { consecutiveDays: 3, severity: 'high' },
  cycleIrregularity: { deviationDays: 10 },
}

async function getDismissed() {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY)
  return raw ? JSON.parse(raw) : []
}

async function dismissAlert(alertId) {
  const dismissed = await getDismissed()
  if (!dismissed.includes(alertId)) {
    dismissed.push(alertId)
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  }
}

function checkLatePeriod(cycles, prediction) {
  if (!prediction?.nextPeriod) return null
  const predicted = new Date(prediction.nextPeriod)
  const today = new Date()
  const daysLate = Math.floor((today - predicted) / (1000 * 60 * 60 * 24))
  if (daysLate >= RULES.latePeriod.daysOverdue) {
    return {
      id: `late_period_${predicted.toISOString().slice(0, 10)}`,
      type: 'latePeriod',
      severity: 'moderate',
      daysLate,
    }
  }
  return null
}

function checkMoodStreak(moodEntries) {
  if (!moodEntries || moodEntries.length < RULES.moodStreak.consecutiveDays) return null
  const sorted = [...moodEntries].sort((a, b) => new Date(b.date) - new Date(a.date))
  let streak = 0
  for (const entry of sorted) {
    const moodVal = (entry.mood || entry.value || '').toLowerCase()
    if (RULES.moodStreak.moods.includes(moodVal)) {
      streak++
    } else {
      break
    }
  }
  if (streak >= RULES.moodStreak.consecutiveDays) {
    return {
      id: `mood_streak_${sorted[0].date}`,
      type: 'moodStreak',
      severity: 'moderate',
      consecutiveDays: streak,
    }
  }
  return null
}

function checkMedicationGap(medications) {
  if (!medications || medications.length === 0) return null
  const alerts = []
  for (const med of medications) {
    const history = med.history || []
    let missed = 0
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date))
    for (const entry of sorted) {
      if (entry.status === 'missed' || entry.status === 'skipped') {
        missed++
      } else {
        break
      }
    }
    if (missed >= RULES.medicationGap.consecutiveMissed) {
      alerts.push({
        id: `med_gap_${med.name}_${sorted[0]?.date}`,
        type: 'medicationGap',
        severity: 'moderate',
        medicationName: med.name,
        consecutiveMissed: missed,
      })
    }
  }
  return alerts.length > 0 ? alerts[0] : null
}

function checkSymptomSeverity(symptoms) {
  if (!symptoms || symptoms.length === 0) return null
  const sorted = [...symptoms].sort((a, b) => new Date(b.date) - new Date(a.date))
  const byType = {}
  for (const s of sorted) {
    const key = s.symptom || s.type || 'unknown'
    if (!byType[key]) byType[key] = []
    byType[key].push(s)
  }
  for (const [symptomName, entries] of Object.entries(byType)) {
    let streak = 0
    for (const entry of entries) {
      const sev = (entry.severity || '').toLowerCase()
      if (sev === 'high' || sev === 'severe') {
        streak++
      } else {
        break
      }
    }
    if (streak >= RULES.symptomSeverity.consecutiveDays) {
      return {
        id: `symptom_${symptomName}_${entries[0].date}`,
        type: 'symptomSeverity',
        severity: 'high',
        symptomName,
        consecutiveDays: streak,
      }
    }
  }
  return null
}

function checkCycleIrregularity(cycles) {
  if (!cycles || cycles.length < 3) return null
  const starts = cycles
    .filter((c) => c.startDate)
    .map((c) => new Date(c.startDate))
    .sort((a, b) => a - b)
  if (starts.length < 3) return null
  const lengths = []
  for (let i = 1; i < starts.length; i++) {
    const days = Math.round((starts[i] - starts[i - 1]) / (1000 * 60 * 60 * 24))
    if (days > 0 && days < 100) lengths.push(days)
  }
  if (lengths.length < 2) return null
  const avg = lengths.slice(0, -1).reduce((a, b) => a + b, 0) / (lengths.length - 1)
  const latest = lengths[lengths.length - 1]
  const deviation = Math.abs(latest - avg)
  if (deviation >= RULES.cycleIrregularity.deviationDays) {
    return {
      id: `irregularity_${cycles[cycles.length - 1].startDate}`,
      type: 'cycleIrregularity',
      severity: 'moderate',
      deviation: Math.round(deviation),
      averageLength: Math.round(avg),
      latestLength: latest,
    }
  }
  return null
}

export async function detectAnomalies({ cycles, prediction, moodEntries, medications, symptoms }) {
  const dismissed = await getDismissed()
  const alerts = []

  const latePeriod = checkLatePeriod(cycles, prediction)
  if (latePeriod) alerts.push(latePeriod)

  const moodAlert = checkMoodStreak(moodEntries)
  if (moodAlert) alerts.push(moodAlert)

  const medAlert = checkMedicationGap(medications)
  if (medAlert) alerts.push(medAlert)

  const symptomAlert = checkSymptomSeverity(symptoms)
  if (symptomAlert) alerts.push(symptomAlert)

  const irregularity = checkCycleIrregularity(cycles)
  if (irregularity) alerts.push(irregularity)

  // Run time-series anomaly detection on cycle lengths
  const tsAnomalies = detectTimeSeriesAnomalies(cycles)
  alerts.push(...tsAnomalies)

  return alerts.filter((a) => !dismissed.includes(a.id))
}

// =============================================================================
// Time-Series Decomposition (STL-style) for Advanced Anomaly Detection
// =============================================================================

const DECOMPOSITION_CONFIG = {
  minDataPoints: 6,
  anomalyThreshold: 2.5,
  trendBandwidth: 0.3,
  seasonalPeriod: null, // auto-detect
}

/**
 * Linear interpolation to handle irregular time intervals.
 * Converts irregularly-spaced observations to uniform daily series.
 */
function interpolateToUniform(timestamps, values) {
  if (timestamps.length < 2) return { times: timestamps, vals: values }

  const startTime = timestamps[0]
  const endTime = timestamps[timestamps.length - 1]
  const totalDays = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24))

  if (totalDays <= 0) return { times: timestamps, vals: values }

  const uniformTimes = []
  const uniformVals = []

  for (let d = 0; d <= totalDays; d++) {
    const t = startTime + d * (1000 * 60 * 60 * 24)
    uniformTimes.push(t)

    // Find surrounding points for interpolation
    let leftIdx = 0
    for (let i = 0; i < timestamps.length - 1; i++) {
      if (timestamps[i] <= t && timestamps[i + 1] >= t) {
        leftIdx = i
        break
      }
      if (timestamps[i] <= t) leftIdx = i
    }

    const rightIdx = Math.min(leftIdx + 1, timestamps.length - 1)

    if (leftIdx === rightIdx || timestamps[leftIdx] === timestamps[rightIdx]) {
      uniformVals.push(values[leftIdx])
    } else {
      const ratio = (t - timestamps[leftIdx]) / (timestamps[rightIdx] - timestamps[leftIdx])
      uniformVals.push(values[leftIdx] + ratio * (values[rightIdx] - values[leftIdx]))
    }
  }

  return { times: uniformTimes, vals: uniformVals }
}

/**
 * LOESS (LOcally Estimated Scatterplot Smoothing) implementation.
 * Fits local weighted regressions to extract the trend component.
 */
function loessSmooth(values, bandwidth = 0.3) {
  const n = values.length
  if (n < 3) return [...values]

  const windowSize = Math.max(3, Math.floor(n * bandwidth))
  const halfWindow = Math.floor(windowSize / 2)
  const smoothed = new Array(n)

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - halfWindow)
    const end = Math.min(n - 1, i + halfWindow)

    let sumW = 0
    let sumWX = 0
    let sumWY = 0
    let sumWXX = 0
    let sumWXY = 0

    for (let j = start; j <= end; j++) {
      const dist = Math.abs(j - i) / (halfWindow + 1)
      // Tricube weight function
      const u = Math.min(1.0, dist)
      const w = Math.pow(1 - Math.pow(u, 3), 3)

      const x = j - i
      sumW += w
      sumWX += w * x
      sumWY += w * values[j]
      sumWXX += w * x * x
      sumWXY += w * x * values[j]
    }

    // Weighted linear regression
    const denom = sumW * sumWXX - sumWX * sumWX
    if (Math.abs(denom) < 1e-10) {
      smoothed[i] = sumWY / sumW
    } else {
      const intercept = (sumWXX * sumWY - sumWX * sumWXY) / denom
      smoothed[i] = intercept
    }
  }

  return smoothed
}

/**
 * Extract seasonal component using period-averaging.
 * Auto-detects period from cycle data if not specified.
 */
function extractSeasonal(values, trend, period) {
  const n = values.length
  const detrended = values.map((v, i) => v - trend[i])

  if (!period || period < 2) {
    period = autoDetectPeriod(detrended)
  }

  if (period < 2 || period >= n) {
    return new Array(n).fill(0)
  }

  // Average by position within period
  const seasonalAvg = new Array(period).fill(0)
  const counts = new Array(period).fill(0)

  for (let i = 0; i < n; i++) {
    const pos = i % period
    seasonalAvg[pos] += detrended[i]
    counts[pos]++
  }

  for (let i = 0; i < period; i++) {
    seasonalAvg[i] = counts[i] > 0 ? seasonalAvg[i] / counts[i] : 0
  }

  // Center the seasonal component (mean = 0)
  const seasonalMean = seasonalAvg.reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < period; i++) {
    seasonalAvg[i] -= seasonalMean
  }

  // Tile to full length
  const seasonal = new Array(n)
  for (let i = 0; i < n; i++) {
    seasonal[i] = seasonalAvg[i % period]
  }

  return seasonal
}

/**
 * Auto-detect the dominant period using autocorrelation peak finding.
 */
function autoDetectPeriod(values) {
  const n = values.length
  if (n < 6) return 0

  const mean = values.reduce((a, b) => a + b, 0) / n
  const centered = values.map((v) => v - mean)
  const variance = centered.reduce((a, v) => a + v * v, 0) / n

  if (variance < 1e-10) return 0

  // Compute autocorrelation for lags 2 to n/2
  const maxLag = Math.floor(n / 2)
  let bestLag = 0
  let bestCorr = 0

  for (let lag = 2; lag <= maxLag; lag++) {
    let corr = 0
    let count = 0
    for (let i = 0; i < n - lag; i++) {
      corr += centered[i] * centered[i + lag]
      count++
    }
    corr = count > 0 ? corr / (count * variance) : 0

    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }

  return bestCorr > 0.3 ? bestLag : 0
}

/**
 * Full STL-style decomposition: data = trend + seasonal + residual.
 */
export function decomposeTimeSeries(values, options = {}) {
  const {
    bandwidth = DECOMPOSITION_CONFIG.trendBandwidth,
    period = DECOMPOSITION_CONFIG.seasonalPeriod,
  } = options

  const n = values.length
  if (n < DECOMPOSITION_CONFIG.minDataPoints) {
    return {
      trend: [...values],
      seasonal: new Array(n).fill(0),
      residual: new Array(n).fill(0),
      period: 0,
      method: 'passthrough',
    }
  }

  // Step 1: Extract trend via LOESS
  const trend = loessSmooth(values, bandwidth)

  // Step 2: Extract seasonal from detrended series
  const detectedPeriod = period || autoDetectPeriod(values.map((v, i) => v - trend[i]))
  const seasonal = extractSeasonal(values, trend, detectedPeriod)

  // Step 3: Residual = original - trend - seasonal
  const residual = values.map((v, i) => v - trend[i] - seasonal[i])

  return {
    trend,
    seasonal,
    residual,
    period: detectedPeriod,
    method: 'stl_loess',
  }
}

/**
 * Detect anomalies from the residual component of decomposed time series.
 * Only residuals exceeding threshold * std are flagged.
 */
function detectResidualAnomalies(
  residual,
  timestamps,
  threshold = DECOMPOSITION_CONFIG.anomalyThreshold,
) {
  if (residual.length < 3) return []

  const mean = residual.reduce((a, b) => a + b, 0) / residual.length
  const variance = residual.reduce((a, v) => a + (v - mean) ** 2, 0) / (residual.length - 1)
  const std = Math.sqrt(variance)

  if (std < 1e-10) return []

  const anomalies = []
  for (let i = 0; i < residual.length; i++) {
    const zScore = Math.abs((residual[i] - mean) / std)
    if (zScore >= threshold) {
      const direction = residual[i] > mean ? 'above' : 'below'
      anomalies.push({
        index: i,
        timestamp: timestamps[i] || null,
        value: residual[i],
        zScore: Math.round(zScore * 100) / 100,
        direction,
      })
    }
  }

  return anomalies
}

/**
 * Run time-series decomposition-based anomaly detection on cycle length data.
 * Falls back to simple threshold if insufficient data.
 */
function detectTimeSeriesAnomalies(cycles) {
  if (!cycles || cycles.length < DECOMPOSITION_CONFIG.minDataPoints) {
    return []
  }

  const starts = cycles
    .filter((c) => c.startDate)
    .map((c) => new Date(c.startDate))
    .sort((a, b) => a - b)

  if (starts.length < DECOMPOSITION_CONFIG.minDataPoints) return []

  const lengths = []
  const timestamps = []
  for (let i = 1; i < starts.length; i++) {
    const days = Math.round((starts[i] - starts[i - 1]) / (1000 * 60 * 60 * 24))
    if (days > 0 && days < 100) {
      lengths.push(days)
      timestamps.push(starts[i].getTime())
    }
  }

  if (lengths.length < DECOMPOSITION_CONFIG.minDataPoints) return []

  const { residual } = decomposeTimeSeries(lengths)
  const rawAnomalies = detectResidualAnomalies(residual, timestamps)

  return rawAnomalies.map((a) => ({
    id: `ts_anomaly_${a.timestamp || a.index}`,
    type: 'timeSeriesAnomaly',
    severity: a.zScore > 3.5 ? 'high' : 'moderate',
    zScore: a.zScore,
    direction: a.direction,
    cycleIndex: a.index,
    details: `Cycle length at index ${a.index} deviates ${a.zScore} standard deviations from the trend-adjusted expected value (${a.direction} normal).`,
  }))
}

export { dismissAlert }
