import type {
  CorrelationAssistantCorrelationPair,
  CorrelationAssistantMetricSummary,
  CorrelationAssistantRequest,
  CorrelationAssistantSummaryCard,
} from '@/lib/api';

type CorrelationRow = {
  date: string;
  [key: string]: string | number | null | undefined;
};

type MetricConfigMap = Record<string, { name: string }>;

interface BuildCorrelationAssistantPayloadOptions {
  analysisMode: 'team' | 'individual';
  currentElo: number | null;
  dateFrom: string;
  dateTo: string;
  faceitMetricsStatus: 'ok' | 'partial' | 'unavailable';
  metricsConfig: MetricConfigMap;
  playerName?: string;
  rows: CorrelationRow[];
  selectedMetrics: string[];
  summaryCards: CorrelationAssistantSummaryCard[];
}

type NumericPoint = {
  index: number;
  value: number;
};

const MAX_METRIC_SUMMARIES = 10;
const MAX_CORRELATIONS = 8;
const MIN_POINTS_FOR_ANALYSIS = 4;
const MIN_POINTS_FOR_CORRELATION = 5;

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const calculatePearsonCorrelation = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length < MIN_POINTS_FOR_CORRELATION) {
    return null;
  }

  const leftMean = average(left);
  const rightMean = average(right);

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDiff = left[index] - leftMean;
    const rightDiff = right[index] - rightMean;
    numerator += leftDiff * rightDiff;
    leftVariance += leftDiff * leftDiff;
    rightVariance += rightDiff * rightDiff;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
};

const calculateLinearSlope = (points: NumericPoint[]) => {
  if (points.length < MIN_POINTS_FOR_ANALYSIS) {
    return 0;
  }

  const count = points.length;
  const meanX = average(points.map((point) => point.index));
  const meanY = average(points.map((point) => point.value));

  let numerator = 0;
  let denominator = 0;

  points.forEach((point) => {
    numerator += (point.index - meanX) * (point.value - meanY);
    denominator += (point.index - meanX) ** 2;
  });

  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
};

const getTrendDirection = (
  firstValue: number,
  lastValue: number,
  minValue: number,
  maxValue: number,
): 'upward' | 'downward' | 'stable' => {
  const span = Math.max(Math.abs(maxValue - minValue), 1);
  const delta = lastValue - firstValue;

  if (Math.abs(delta) <= span * 0.08) {
    return 'stable';
  }

  return delta > 0 ? 'upward' : 'downward';
};

const describeCorrelationStrength = (coefficient: number): 'high' | 'medium' | 'low' => {
  const absolute = Math.abs(coefficient);
  if (absolute >= 0.7) return 'high';
  if (absolute >= 0.5) return 'medium';
  return 'low';
};

const buildMetricSummary = (
  metric: string,
  label: string,
  rows: CorrelationRow[],
): CorrelationAssistantMetricSummary | null => {
  const points = rows
    .map((row, index) => {
      const rawValue = row[metric];
      return typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? { index, value: rawValue }
        : null;
    })
    .filter((point): point is NumericPoint => Boolean(point));

  if (points.length < MIN_POINTS_FOR_ANALYSIS) {
    return null;
  }

  const values = points.map((point) => point.value);
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const absoluteChange = lastValue - firstValue;
  const percentChange = firstValue !== 0 ? (absoluteChange / Math.abs(firstValue)) * 100 : null;
  const slope = calculateLinearSlope(points);
  const forecastNext7Days = Number.isFinite(slope)
    ? lastValue + slope * 7
    : null;

  return {
    metric,
    label,
    points: points.length,
    average: average(values),
    min: minValue,
    max: maxValue,
    firstValue,
    lastValue,
    absoluteChange,
    percentChange,
    trend: getTrendDirection(firstValue, lastValue, minValue, maxValue),
    forecastNext7Days,
  };
};

const buildStrongestCorrelations = (
  metricSummaries: CorrelationAssistantMetricSummary[],
  rows: CorrelationRow[],
): CorrelationAssistantCorrelationPair[] => {
  const pairs: CorrelationAssistantCorrelationPair[] = [];

  for (let leftIndex = 0; leftIndex < metricSummaries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < metricSummaries.length; rightIndex += 1) {
      const leftMetric = metricSummaries[leftIndex];
      const rightMetric = metricSummaries[rightIndex];
      const pairedValues = rows
        .map((row) => {
          const leftValue = row[leftMetric.metric];
          const rightValue = row[rightMetric.metric];
          if (
            typeof leftValue === 'number' &&
            Number.isFinite(leftValue) &&
            typeof rightValue === 'number' &&
            Number.isFinite(rightValue)
          ) {
            return { leftValue, rightValue };
          }

          return null;
        })
        .filter((value): value is { leftValue: number; rightValue: number } => Boolean(value));

      if (pairedValues.length < MIN_POINTS_FOR_CORRELATION) {
        continue;
      }

      const coefficient = calculatePearsonCorrelation(
        pairedValues.map((item) => item.leftValue),
        pairedValues.map((item) => item.rightValue),
      );

      if (coefficient === null || Math.abs(coefficient) < 0.35) {
        continue;
      }

      pairs.push({
        leftMetric: leftMetric.metric,
        leftLabel: leftMetric.label,
        rightMetric: rightMetric.metric,
        rightLabel: rightMetric.label,
        coefficient,
        sampleSize: pairedValues.length,
        strength: describeCorrelationStrength(coefficient),
        direction: coefficient >= 0 ? 'positive' : 'negative',
      });
    }
  }

  return pairs
    .sort((left, right) => Math.abs(right.coefficient) - Math.abs(left.coefficient))
    .slice(0, MAX_CORRELATIONS);
};

const prioritizeMetricSummaries = (summaries: CorrelationAssistantMetricSummary[], selectedMetrics: string[]) => {
  const selectedSet = new Set(selectedMetrics);

  return [...summaries]
    .sort((left, right) => {
      const leftSelected = selectedSet.has(left.metric) ? 1 : 0;
      const rightSelected = selectedSet.has(right.metric) ? 1 : 0;

      if (leftSelected !== rightSelected) {
        return rightSelected - leftSelected;
      }

      const leftDelta = Math.abs(left.percentChange ?? left.absoluteChange);
      const rightDelta = Math.abs(right.percentChange ?? right.absoluteChange);
      return rightDelta - leftDelta;
    })
    .slice(0, MAX_METRIC_SUMMARIES);
};

export const buildCorrelationAssistantPayload = ({
  analysisMode,
  currentElo,
  dateFrom,
  dateTo,
  faceitMetricsStatus,
  metricsConfig,
  playerName,
  rows,
  selectedMetrics,
  summaryCards,
}: BuildCorrelationAssistantPayloadOptions): CorrelationAssistantRequest => {
  const metricSummaries = prioritizeMetricSummaries(
    Object.entries(metricsConfig)
      .map(([metric, config]) => buildMetricSummary(metric, config.name, rows))
      .filter((item): item is CorrelationAssistantMetricSummary => Boolean(item)),
    selectedMetrics,
  );

  return {
    analysisMode,
    currentElo,
    dateFrom,
    dateTo,
    faceitMetricsStatus,
    playerName,
    selectedMetrics,
    summaryCards,
    totalRows: rows.length,
    metricSummaries,
    strongestCorrelations: buildStrongestCorrelations(metricSummaries, rows),
  };
};
