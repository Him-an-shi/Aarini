const DAY_MS = 24 * 60 * 60 * 1000;

export function diffDays(later, earlier) {
  return Math.round((later - earlier) / DAY_MS);
}

export function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const sqDiff = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(sqDiff.reduce((a, b) => a + b, 0) / (values.length - 1));
}

export function movingAverage(values, windowSize = 3) {
  if (values.length < windowSize) return values;
  const result = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const slice = values.slice(i - windowSize + 1, i + 1);
    result.push(mean(slice));
  }
  return result;
}

export function detectTrend(values) {
  if (values.length < 3) return 'insufficient_data';
  const first = mean(values.slice(0, 2));
  const last = mean(values.slice(-2));
  const diff = last - first;
  if (Math.abs(diff) < 0.5) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

export function computeCorrelation(xValues, yValues) {
  if (xValues.length < 3 || yValues.length < 3) return null;
  const n = Math.min(xValues.length, yValues.length);
  const xMean = mean(xValues.slice(0, n));
  const yMean = mean(yValues.slice(0, n));
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    denomX += xDiff * xDiff;
    denomY += yDiff * yDiff;
  }
  if (denomX === 0 || denomY === 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

export function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
