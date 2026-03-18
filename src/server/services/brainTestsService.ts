import BrainTestAttempt from '../models/BrainTestAttempt';

export const BRAIN_TEST_KEYS = [
  'visual_search',
  'go_no_go',
  'n_back_2',
  'stroop_switch',
  'spatial_span'
] as const;

export type BrainTestKey = typeof BRAIN_TEST_KEYS[number];

export const BRAIN_DOMAINS = {
  visual_search: 'attention',
  go_no_go: 'reaction_inhibition',
  n_back_2: 'working_memory',
  stroop_switch: 'flexibility',
  spatial_span: 'visuospatial'
} as const;

const TEST_ORDER: BrainTestKey[] = [
  'visual_search',
  'go_no_go',
  'n_back_2',
  'stroop_switch',
  'spatial_span'
];

type CatalogEntry = {
  testKey: BrainTestKey;
  domain: string;
  title: string;
  shortDescription: string;
  instruction: string;
  durationSec: number;
  config: Record<string, number | string>;
};

export const BRAIN_TEST_CATALOG: CatalogEntry[] = [
  {
    testKey: 'visual_search',
    domain: BRAIN_DOMAINS.visual_search,
    title: 'Visual Search',
    shortDescription: 'Селективное внимание и скорость сканирования',
    instruction: 'Стрелками перемещайте курсор по сетке, найдите целевой символ и подтвердите Enter.',
    durationSec: 60,
    config: {
      gridSize: 6,
      maxTrials: 30,
      targetRt: 550,
      worstRt: 1400,
      maxCv: 0.35
    }
  },
  {
    testKey: 'go_no_go',
    domain: BRAIN_DOMAINS.go_no_go,
    title: 'Go / No-Go',
    shortDescription: 'Реакция и тормозной контроль',
    instruction: 'Нажимайте пробел только на синие стимулы. Красные пропускайте.',
    durationSec: 90,
    config: {
      totalStimuli: 80,
      noGoRatio: 0.25,
      targetRt: 320,
      worstRt: 900,
      maxCv: 0.35
    }
  },
  {
    testKey: 'n_back_2',
    domain: BRAIN_DOMAINS.n_back_2,
    title: '2-Back',
    shortDescription: 'Рабочая память и обновление контекста',
    instruction: 'Нажимайте J, когда текущий символ совпадает с тем, что был два шага назад.',
    durationSec: 90,
    config: {
      totalStimuli: 60,
      targetRatio: 0.3,
      targetRt: 450,
      worstRt: 1200,
      maxCv: 0.4
    }
  },
  {
    testKey: 'stroop_switch',
    domain: BRAIN_DOMAINS.stroop_switch,
    title: 'Stroop Switch',
    shortDescription: 'Переключение и устойчивость к помехам',
    instruction: 'Следуйте текущему правилу: цвет или слово. Отвечайте клавишами A / S / K / L.',
    durationSec: 90,
    config: {
      totalTrials: 72,
      interferenceDenominator: 400,
      switchCostDenominator: 350
    }
  },
  {
    testKey: 'spatial_span',
    domain: BRAIN_DOMAINS.spatial_span,
    title: 'Spatial Span',
    shortDescription: 'Пространственная память и удержание последовательностей',
    instruction: 'Запомните последовательность вспышек и воспроизведите её цифрами 1-9.',
    durationSec: 90,
    config: {
      minSpan: 3,
      maxSpan: 8,
      maxAttempts: 14
    }
  }
];

const TEST_WEIGHT_MAP: Record<BrainTestKey, number> = {
  visual_search: 0.25,
  go_no_go: 0.25,
  n_back_2: 0.2,
  stroop_switch: 0.15,
  spatial_span: 0.15
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function coefficientOfVariation(values: number[]) {
  if (!values.length) return 0;
  const mean = average(values);
  if (mean == null || mean <= 0) return 0;
  const variance = average(values.map((value) => (value - mean) ** 2)) || 0;
  return Math.sqrt(variance) / mean;
}

function scoreFromRt(rt: number | null, targetRt: number, worstRt: number) {
  if (rt == null) return 0;
  if (rt <= targetRt) return 100;
  if (rt >= worstRt) return 0;
  return clamp(((worstRt - rt) / (worstRt - targetRt)) * 100);
}

function scoreFromCv(rtCv: number | null, maxCv: number) {
  if (rtCv == null) return 0;
  return clamp(100 - (rtCv / maxCv) * 100);
}

export function isBrainTestKey(value: string): value is BrainTestKey {
  return (BRAIN_TEST_KEYS as readonly string[]).includes(value);
}

export function getCatalogEntry(testKey: BrainTestKey) {
  return BRAIN_TEST_CATALOG.find((entry) => entry.testKey === testKey) || null;
}

export function getCatalog() {
  return {
    title: 'Brain Lab',
    batteryDurationSec: 480,
    order: TEST_ORDER,
    tests: BRAIN_TEST_CATALOG
  };
}

export function buildAttemptSeed(testKey: BrainTestKey) {
  return `${testKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function computeAttemptOutcome(testKey: BrainTestKey, rawMetricsInput: Record<string, unknown>) {
  const invalidReasons: string[] = [];
  const rawMetrics: Record<string, number | null> = {};
  let rawCompositeScore = 0;

  const visibilityHiddenMs = toNumber(rawMetricsInput.visibilityHiddenMs) || 0;
  const durationMs = toNumber(rawMetricsInput.durationMs) || 0;
  const fastResponseRatio = toNumber(rawMetricsInput.fastResponseRatio) || 0;

  if (durationMs > 0 && visibilityHiddenMs / durationMs > 0.15) {
    invalidReasons.push('tab_hidden_over_15_percent');
  }

  if (fastResponseRatio > 0.2) {
    invalidReasons.push('too_many_fast_responses');
  }

  switch (testKey) {
    case 'visual_search': {
      const accuracyPct = toNumber(rawMetricsInput.accuracyPct) || 0;
      const medianRtMs = toNumber(rawMetricsInput.medianRtMs);
      const rtCv = toNumber(rawMetricsInput.rtCv) || 0;
      const misses = toNumber(rawMetricsInput.misses) || 0;

      rawMetrics.accuracyPct = accuracyPct;
      rawMetrics.medianRtMs = medianRtMs;
      rawMetrics.rtCv = rtCv;
      rawMetrics.misses = misses;

      const speedScore = scoreFromRt(medianRtMs, 550, 1400);
      const stabilityScore = scoreFromCv(rtCv, 0.35);
      rawCompositeScore = 0.5 * accuracyPct + 0.3 * speedScore + 0.2 * stabilityScore;

      if (accuracyPct < 55) invalidReasons.push('accuracy_below_threshold');
      return {
        rawMetrics,
        derivedMetrics: {
          speedScore: round(speedScore),
          stabilityScore: round(stabilityScore),
          fastResponseRatio: round(fastResponseRatio, 4),
          visibilityHiddenMs: round(visibilityHiddenMs),
          statusLabel: 'attention_scan'
        },
        rawCompositeScore: round(rawCompositeScore),
        validityStatus: invalidReasons.length ? 'invalid' : 'valid',
        invalidReasons
      };
    }
    case 'go_no_go': {
      const goAccuracyPct = toNumber(rawMetricsInput.goAccuracyPct) || 0;
      const noGoAccuracyPct = toNumber(rawMetricsInput.noGoAccuracyPct) || 0;
      const medianRtMs = toNumber(rawMetricsInput.medianRtMs);
      const rtCv = toNumber(rawMetricsInput.rtCv) || 0;
      const commissionErrors = toNumber(rawMetricsInput.commissionErrors) || 0;
      const omissionErrors = toNumber(rawMetricsInput.omissionErrors) || 0;

      rawMetrics.goAccuracyPct = goAccuracyPct;
      rawMetrics.noGoAccuracyPct = noGoAccuracyPct;
      rawMetrics.medianRtMs = medianRtMs;
      rawMetrics.rtCv = rtCv;
      rawMetrics.commissionErrors = commissionErrors;
      rawMetrics.omissionErrors = omissionErrors;

      const speedScore = scoreFromRt(medianRtMs, 320, 900);
      const stabilityScore = scoreFromCv(rtCv, 0.35);
      rawCompositeScore = 0.35 * goAccuracyPct + 0.35 * noGoAccuracyPct + 0.2 * speedScore + 0.1 * stabilityScore;

      if (goAccuracyPct < 60 || noGoAccuracyPct < 50) invalidReasons.push('accuracy_below_threshold');
      return {
        rawMetrics,
        derivedMetrics: {
          speedScore: round(speedScore),
          stabilityScore: round(stabilityScore),
          fastResponseRatio: round(fastResponseRatio, 4),
          visibilityHiddenMs: round(visibilityHiddenMs),
          inhibitoryControlScore: round((goAccuracyPct + noGoAccuracyPct) / 2)
        },
        rawCompositeScore: round(rawCompositeScore),
        validityStatus: invalidReasons.length ? 'invalid' : 'valid',
        invalidReasons
      };
    }
    case 'n_back_2': {
      const targetAccuracyPct = toNumber(rawMetricsInput.targetAccuracyPct) || 0;
      const nonTargetAccuracyPct = toNumber(rawMetricsInput.nonTargetAccuracyPct) || 0;
      const medianRtMs = toNumber(rawMetricsInput.medianRtMs);
      const rtCv = toNumber(rawMetricsInput.rtCv) || 0;

      rawMetrics.targetAccuracyPct = targetAccuracyPct;
      rawMetrics.nonTargetAccuracyPct = nonTargetAccuracyPct;
      rawMetrics.medianRtMs = medianRtMs;
      rawMetrics.rtCv = rtCv;

      const speedScore = scoreFromRt(medianRtMs, 450, 1200);
      const stabilityScore = scoreFromCv(rtCv, 0.4);
      rawCompositeScore = 0.45 * targetAccuracyPct + 0.25 * nonTargetAccuracyPct + 0.2 * speedScore + 0.1 * stabilityScore;

      if (targetAccuracyPct < 45) invalidReasons.push('accuracy_below_threshold');
      return {
        rawMetrics,
        derivedMetrics: {
          speedScore: round(speedScore),
          stabilityScore: round(stabilityScore),
          fastResponseRatio: round(fastResponseRatio, 4),
          visibilityHiddenMs: round(visibilityHiddenMs),
          updatingScore: round((targetAccuracyPct + nonTargetAccuracyPct) / 2)
        },
        rawCompositeScore: round(rawCompositeScore),
        validityStatus: invalidReasons.length ? 'invalid' : 'valid',
        invalidReasons
      };
    }
    case 'stroop_switch': {
      const congruentAccuracyPct = toNumber(rawMetricsInput.congruentAccuracyPct) || 0;
      const conflictAccuracyPct = toNumber(rawMetricsInput.conflictAccuracyPct) || 0;
      const congruentMedianRtMs = toNumber(rawMetricsInput.congruentMedianRtMs);
      const conflictMedianRtMs = toNumber(rawMetricsInput.conflictMedianRtMs);
      const switchCostMs = toNumber(rawMetricsInput.switchCostMs) || 0;

      rawMetrics.congruentAccuracyPct = congruentAccuracyPct;
      rawMetrics.conflictAccuracyPct = conflictAccuracyPct;
      rawMetrics.congruentMedianRtMs = congruentMedianRtMs;
      rawMetrics.conflictMedianRtMs = conflictMedianRtMs;
      rawMetrics.switchCostMs = switchCostMs;

      const interferenceScore = clamp(100 - ((((conflictMedianRtMs || 0) - (congruentMedianRtMs || 0)) / 400) * 100));
      const switchCostScore = clamp(100 - (switchCostMs / 350) * 100);
      rawCompositeScore = 0.35 * conflictAccuracyPct + 0.2 * congruentAccuracyPct + 0.25 * interferenceScore + 0.2 * switchCostScore;

      if (conflictAccuracyPct < 50) invalidReasons.push('accuracy_below_threshold');
      return {
        rawMetrics,
        derivedMetrics: {
          interferenceScore: round(interferenceScore),
          switchCostScore: round(switchCostScore),
          fastResponseRatio: round(fastResponseRatio, 4),
          visibilityHiddenMs: round(visibilityHiddenMs)
        },
        rawCompositeScore: round(rawCompositeScore),
        validityStatus: invalidReasons.length ? 'invalid' : 'valid',
        invalidReasons
      };
    }
    case 'spatial_span': {
      const maxSpan = toNumber(rawMetricsInput.maxSpan) || 0;
      const sequenceAccuracyPct = toNumber(rawMetricsInput.sequenceAccuracyPct) || 0;
      const totalCorrect = toNumber(rawMetricsInput.totalCorrect) || 0;

      rawMetrics.maxSpan = maxSpan;
      rawMetrics.sequenceAccuracyPct = sequenceAccuracyPct;
      rawMetrics.totalCorrect = totalCorrect;

      const spanScore = clamp(((maxSpan - 3) / 5) * 100);
      rawCompositeScore = 0.6 * spanScore + 0.4 * sequenceAccuracyPct;

      if (maxSpan < 3 && sequenceAccuracyPct < 40) invalidReasons.push('accuracy_below_threshold');
      return {
        rawMetrics,
        derivedMetrics: {
          spanScore: round(spanScore),
          fastResponseRatio: 0,
          visibilityHiddenMs: round(visibilityHiddenMs)
        },
        rawCompositeScore: round(rawCompositeScore),
        validityStatus: invalidReasons.length ? 'invalid' : 'valid',
        invalidReasons
      };
    }
  }
}

export async function computeFormScore(params: {
  userId: string;
  testKey: BrainTestKey;
  completedAt: Date;
  currentAttemptId?: string;
  rawCompositeScore: number;
}) {
  const from = new Date(params.completedAt);
  from.setDate(from.getDate() - 30);

  const filter: Record<string, unknown> = {
    userId: params.userId,
    testKey: params.testKey,
    status: 'completed',
    validityStatus: 'valid',
    completedAt: { $gte: from, $lte: params.completedAt }
  };

  const attempts = await BrainTestAttempt.find(filter)
    .select('_id rawCompositeScore')
    .sort({ completedAt: -1 })
    .lean();

  const baselineValues = attempts
    .filter((attempt: any) => String(attempt._id) !== params.currentAttemptId)
    .map((attempt: any) => toNumber(attempt.rawCompositeScore))
    .filter((value): value is number => value != null);

  if (!baselineValues.length) {
    return {
      formScore: null,
      baselineMedian: null,
      variability: null,
      baselineCount: 0
    };
  }

  const baselineMedian = median(baselineValues);
  const q1 = quantile(baselineValues, 0.25);
  const q3 = quantile(baselineValues, 0.75);
  const variability = Math.max((q3 || 0) - (q1 || 0), 8);

  if (baselineMedian == null) {
    return {
      formScore: null,
      baselineMedian: null,
      variability: null,
      baselineCount: baselineValues.length
    };
  }

  const formScore = clamp(50 + (12 * (params.rawCompositeScore - baselineMedian)) / variability);
  return {
    formScore: round(formScore),
    baselineMedian: round(baselineMedian),
    variability: round(variability),
    baselineCount: baselineValues.length
  };
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDayKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function getLastNDays(days: number) {
  const dates: string[] = [];
  const now = startOfUtcDay(new Date());
  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setUTCDate(now.getUTCDate() - index);
    dates.push(toDayKey(current));
  }
  return dates;
}

function getHistoryStatus(attempt: any) {
  if (attempt.validityStatus === 'invalid') return 'invalid';
  if (typeof attempt.formScore !== 'number') return 'calibrating';
  return 'valid';
}

export function computeBatteryIndex(attempts: any[]) {
  let weightTotal = 0;
  let scoreTotal = 0;

  for (const attempt of attempts) {
    if (typeof attempt.formScore !== 'number') continue;
    const weight = TEST_WEIGHT_MAP[attempt.testKey as BrainTestKey] || 0;
    weightTotal += weight;
    scoreTotal += attempt.formScore * weight;
  }

  if (!weightTotal) return null;
  return round(scoreTotal / weightTotal);
}

export async function buildBrainPerformanceSummary(userId: string, windowDays = 30) {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - Math.max(windowDays, 30) + 1);

  const attempts = await BrainTestAttempt.find({
    userId,
    status: 'completed',
    completedAt: { $gte: fromDate, $lte: now }
  })
    .sort({ completedAt: -1 })
    .lean();

  const latestByTest = new Map<string, any>();
  const latestValidByTest = new Map<string, any>();
  const validCountsByTest = new Map<string, number>();
  const rawCountsByTest = new Map<string, number>();
  const validSessions = new Map<string, Set<string>>();
  const sessionAttempts = new Map<string, any[]>();

  for (const attempt of attempts) {
    if (!latestByTest.has(attempt.testKey)) latestByTest.set(attempt.testKey, attempt);
    rawCountsByTest.set(attempt.testKey, (rawCountsByTest.get(attempt.testKey) || 0) + 1);

    if (attempt.validityStatus === 'valid') {
      if (!latestValidByTest.has(attempt.testKey)) latestValidByTest.set(attempt.testKey, attempt);
      validCountsByTest.set(attempt.testKey, (validCountsByTest.get(attempt.testKey) || 0) + 1);

      if (attempt.batterySessionId) {
        const set = validSessions.get(attempt.batterySessionId) || new Set<string>();
        set.add(attempt.testKey);
        validSessions.set(attempt.batterySessionId, set);

        const sessionList = sessionAttempts.get(attempt.batterySessionId) || [];
        sessionList.push(attempt);
        sessionAttempts.set(attempt.batterySessionId, sessionList);
      }
    }
  }

  const validBatteryIds = Array.from(validSessions.entries())
    .filter(([, testSet]) => TEST_ORDER.every((key) => testSet.has(key)))
    .map(([sessionId]) => sessionId);
  const validBatteryCount = validBatteryIds.length;

  const tests = TEST_ORDER.map((testKey) => {
    const latestAttempt = latestByTest.get(testKey) || null;
    const latestValidAttempt = latestValidByTest.get(testKey) || null;
    const latestRawScore = latestAttempt?.rawCompositeScore ?? null;
    const latestFormScore = latestValidAttempt?.formScore ?? null;

    return {
      testKey,
      domain: BRAIN_DOMAINS[testKey],
      title: getCatalogEntry(testKey)?.title || testKey,
      latestRawScore: latestRawScore != null ? round(Number(latestRawScore)) : null,
      latestFormScore: latestFormScore != null ? round(Number(latestFormScore)) : null,
      latestCompletedAt: latestAttempt?.completedAt || null,
      latestValidityStatus: latestAttempt?.validityStatus || null,
      historyStatus: latestAttempt ? getHistoryStatus(latestAttempt) : 'calibrating',
      attempts30d: rawCountsByTest.get(testKey) || 0,
      validAttempts30d: validCountsByTest.get(testKey) || 0
    };
  });

  const domains = {
    attention: latestValidByTest.get('visual_search')?.formScore ?? null,
    reactionInhibition: latestValidByTest.get('go_no_go')?.formScore ?? null,
    workingMemory: latestValidByTest.get('n_back_2')?.formScore ?? null,
    flexibility: latestValidByTest.get('stroop_switch')?.formScore ?? null,
    visuospatial: latestValidByTest.get('spatial_span')?.formScore ?? null
  };

  const latestValidAttempts = TEST_ORDER
    .map((testKey) => latestValidByTest.get(testKey))
    .filter(Boolean);

  const brainPerformanceIndex = validBatteryCount < 3
    ? null
    : computeBatteryIndex(latestValidAttempts);

  const confidence = validBatteryCount < 3
    ? 'low'
    : TEST_ORDER.some((testKey) => (validCountsByTest.get(testKey) || 0) < 5)
      ? 'medium'
      : 'high';

  const batterySeries = new Map<string, any[]>();
  for (const sessionId of validBatteryIds) {
    batterySeries.set(sessionId, sessionAttempts.get(sessionId) || []);
  }

  const batteryPoints = Array.from(batterySeries.entries())
    .map(([sessionId, session]) => {
      const completedAtValues = session
        .map((attempt) => (attempt.completedAt ? new Date(attempt.completedAt) : null))
        .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));
      const completedAt = completedAtValues.length
        ? new Date(Math.max(...completedAtValues.map((value) => value.getTime())))
        : null;
      return {
        sessionId,
        date: completedAt ? toDayKey(completedAt) : null,
        index: computeBatteryIndex(session),
        rawAverage: round(average(
          session
            .map((attempt) => toNumber(attempt.rawCompositeScore))
            .filter((value): value is number => value != null)
        ))
      };
    })
    .filter((point) => point.date);

  const buildTrend = (days: number) => {
    const pointsByDate = new Map<string, { indexValues: number[]; rawValues: number[] }>();
    batteryPoints.forEach((point) => {
      if (!point.date) return;
      const bucket = pointsByDate.get(point.date) || { indexValues: [], rawValues: [] };
      if (typeof point.index === 'number') bucket.indexValues.push(point.index);
      if (typeof point.rawAverage === 'number') bucket.rawValues.push(point.rawAverage);
      pointsByDate.set(point.date, bucket);
    });

    return getLastNDays(days).map((date) => {
      const bucket = pointsByDate.get(date);
      const index = bucket ? average(bucket.indexValues) : null;
      const rawAverage = bucket ? average(bucket.rawValues) : null;
      return {
        date,
        brainPerformanceIndex: round(index),
        rawAverageScore: round(rawAverage)
      };
    });
  };

  const readinessOverlaySource = latestValidAttempts
    .map((attempt) => attempt.rawMetrics || {})
    .filter(Boolean);

  return {
    brainPerformanceIndex,
    confidence,
    calibrationStatus: validBatteryCount < 3 ? 'calibrating' : 'ready',
    validBatteryCount,
    matureBaseline: validBatteryCount >= 8,
    domains: {
      attention: round(toNumber(domains.attention)),
      reactionInhibition: round(toNumber(domains.reactionInhibition)),
      workingMemory: round(toNumber(domains.workingMemory)),
      flexibility: round(toNumber(domains.flexibility)),
      visuospatial: round(toNumber(domains.visuospatial))
    },
    tests,
    trend7d: buildTrend(7),
    trend30d: buildTrend(30),
    readinessOverlay: {
      fatigue: round(average(readinessOverlaySource.map((item: any) => toNumber(item.fatigue)).filter((value): value is number => value != null))),
      focus: round(average(readinessOverlaySource.map((item: any) => toNumber(item.focus)).filter((value): value is number => value != null))),
      stress: round(average(readinessOverlaySource.map((item: any) => toNumber(item.stress)).filter((value): value is number => value != null)))
    }
  };
}

export async function buildBrainTestsHistory(userId: string, testKey?: BrainTestKey | null) {
  const filter: Record<string, unknown> = {
    userId,
    status: 'completed'
  };

  if (testKey) {
    filter.testKey = testKey;
  }

  const attempts = await BrainTestAttempt.find(filter)
    .sort({ completedAt: -1 })
    .limit(testKey ? 24 : 60)
    .lean();

  return attempts.map((attempt: any) => ({
    id: String(attempt._id),
    batterySessionId: attempt.batterySessionId || null,
    testKey: attempt.testKey,
    domain: attempt.domain,
    completedAt: attempt.completedAt || attempt.updatedAt || null,
    durationMs: attempt.durationMs || null,
    rawCompositeScore: round(toNumber(attempt.rawCompositeScore)),
    formScore: round(toNumber(attempt.formScore)),
    validityStatus: attempt.validityStatus,
    historyStatus: getHistoryStatus(attempt),
    invalidReasons: Array.isArray(attempt.invalidReasons) ? attempt.invalidReasons : []
  }));
}

export function computeClientDerivedMetrics(rtValues: number[]) {
  const positiveValues = rtValues.filter((value) => Number.isFinite(value) && value > 0);
  return {
    medianRtMs: round(median(positiveValues)),
    rtCv: round(coefficientOfVariation(positiveValues), 4),
    fastResponseRatio: positiveValues.length
      ? round(positiveValues.filter((value) => value < 120).length / positiveValues.length, 4)
      : 0
  };
}
