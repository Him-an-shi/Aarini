const DAY_MS = 24 * 60 * 60 * 1000

export const parseLocalDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (
    result.getFullYear() !== Number(match[1]) ||
    result.getMonth() !== Number(match[2]) - 1 ||
    result.getDate() !== Number(match[3])
  )
    return null
  return result
}

export const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const addDays = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
const diffDays = (later, earlier) => Math.round((later - earlier) / DAY_MS)

export const predictCycleLocally = (entries, fallbackLength = 28, today = new Date()) => {
  const cycles = entries
    .map((entry) => ({
      ...entry,
      start: parseLocalDate(entry.startDate),
      end: parseLocalDate(entry.endDate),
    }))
    .filter((entry) => entry.start && entry.end && entry.end >= entry.start)
    .sort((a, b) => a.start - b.start)

  if (!cycles.length) return { hasHistory: false, averageCycleLength: fallbackLength }

  const intervals = cycles
    .slice(1)
    .map((entry, index) => diffDays(entry.start, cycles[index].start))
    .filter((length) => length >= 15 && length <= 60)
    .slice(-6)
  const weights = intervals.map((_, index) => index + 1)
  const averageCycleLength = intervals.length
    ? Math.round(
        intervals.reduce((sum, length, index) => sum + length * weights[index], 0) /
          weights.reduce((a, b) => a + b, 0),
      )
    : fallbackLength
  const durations = cycles
    .map((entry) => diffDays(entry.end, entry.start) + 1)
    .filter((length) => length <= 14)
  const averagePeriodLength = durations.length
    ? Math.round(durations.reduce((sum, length) => sum + length, 0) / durations.length)
    : 5

  let nextPeriod = addDays(cycles[cycles.length - 1].start, averageCycleLength)
  while (nextPeriod <= today) nextPeriod = addDays(nextPeriod, averageCycleLength)
  const cycleStart = addDays(nextPeriod, -averageCycleLength)
  const cycleDay = diffDays(today, cycleStart) + 1
  const ovulationDate = addDays(
    cycleStart,
    Math.max(averagePeriodLength + 1, averageCycleLength - 15),
  )
  const ovulationWindowStart = addDays(ovulationDate, -5)
  const ovulationWindowEnd = addDays(ovulationDate, 1)

  let currentPhase = 'Luteal'
  if (cycleDay <= averagePeriodLength) currentPhase = 'Menstrual'
  else if (today < ovulationWindowStart) currentPhase = 'Follicular'
  else if (today <= ovulationWindowEnd) currentPhase = 'Ovulation'

  return {
    hasHistory: true,
    averageCycleLength,
    averagePeriodLength,
    currentPhase,
    cycleDay,
    currentCycleStart: toDateKey(cycleStart),
    nextPeriodStart: toDateKey(nextPeriod),
    nextPeriodEnd: toDateKey(addDays(nextPeriod, averagePeriodLength - 1)),
    ovulationDate: toDateKey(ovulationDate),
    ovulationWindowStart: toDateKey(ovulationWindowStart),
    ovulationWindowEnd: toDateKey(ovulationWindowEnd),
    confidence: intervals.length >= 3 ? 'high' : intervals.length ? 'medium' : 'low',
  }
}

export const dateInRange = (key, start, end) => Boolean(start && end && key >= start && key <= end)
