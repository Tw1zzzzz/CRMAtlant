export type DayKey = string; // YYYY-MM-DD

export type ScoreWindow = 'week' | 'month';

export type ScoreSummary = {
  readiness: number | null;
  performance: number | null;
  discipline: number | null;
  success: number | null;
  confidence: number;
};

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function toDayKey(d: Date): DayKey {
  return d.toISOString().slice(0, 10);
}

export function screenTimeScore(hours: number | null | undefined): number | null {
  if (hours == null || Number.isNaN(hours)) return null;
  if (hours <= 2) return 100;
  if (hours <= 3) return 85;
  if (hours <= 4) return 70;
  if (hours <= 5) return 55;
  return 40;
}

export function sleepScore(hours: number | null | undefined): number | null {
  if (hours == null || Number.isNaN(hours)) return null;
  const h = clamp(hours, 0, 24);
  // anchors: 8->100, 6->70, 5->55, 4->40, 9->90, 10->80
  if (h <= 4) return 40 * (h / 4);
  if (h <= 5) return 40 + (h - 4) * 15;
  if (h <= 6) return 55 + (h - 5) * 15;
  if (h <= 8) return 70 + ((h - 6) / 2) * 30;
  if (h <= 9) return 100 - (h - 8) * 10;
  if (h <= 10) return 90 - (h - 9) * 10;
  return 80 - (h - 10) * 5;
}

export function readinessScore(params: {
  mood?: number | null; // 1..10
  energy?: number | null; // 1..10
  sleepHours?: number | null; // not yet implemented
  screenHours?: number | null; // 0..24
}): number | null {
  const moodScore = params.mood != null ? clamp(params.mood, 1, 10) * 10 : null;
  const energyScore = params.energy != null ? clamp(params.energy, 1, 10) * 10 : null;
  const sleep = sleepScore(params.sleepHours);
  const screenScore = screenTimeScore(params.screenHours);

  // v1 weights
  const parts: Array<{ w: number; v: number | null }> = [
    { w: 0.35, v: moodScore },
    { w: 0.35, v: energyScore },
    { w: 0.20, v: sleep },
    { w: 0.10, v: screenScore }
  ];

  const available = parts.filter(p => p.v != null);
  if (!available.length) return null;
  const wSum = available.reduce((s, p) => s + p.w, 0);
  const v = available.reduce((s, p) => s + (p.v as number) * p.w, 0) / wSum;
  return Math.round(v * 100) / 100;
}

function piecewiseWinRateScore(winRate: number): number {
  const x = clamp(winRate, 0, 100);
  // anchors: 40->40, 50->60, 60->80, 70->95
  if (x <= 40) return (x / 40) * 40;
  if (x <= 50) return 40 + ((x - 40) / 10) * 20;
  if (x <= 60) return 60 + ((x - 50) / 10) * 20;
  if (x <= 70) return 80 + ((x - 60) / 10) * 15;
  return 95 + ((x - 70) / 30) * 5; // up to 100
}

export function performanceScore(params: {
  winRate?: number | null;
  roundWinRate?: number | null;
  ctRoundWinRate?: number | null;
  tRoundWinRate?: number | null;
  pistolWinRate?: number | null;
}): number | null {
  const win = params.winRate ?? null;
  const round = params.roundWinRate ?? null;
  const ct = params.ctRoundWinRate ?? null;
  const t = params.tRoundWinRate ?? null;
  const pistol = params.pistolWinRate ?? null;

  const winScore = win != null ? piecewiseWinRateScore(win) : null;
  const roundScore = round != null ? piecewiseWinRateScore(round) : null;
  const pistolScore = pistol != null ? clamp(pistol, 0, 100) : null;
  const sideBalanceScore =
    ct != null && t != null ? clamp(100 - 2 * Math.abs(ct - t), 0, 100) : null;

  const parts: Array<{ w: number; v: number | null }> = [
    { w: 0.35, v: winScore },
    { w: 0.25, v: roundScore },
    { w: 0.20, v: sideBalanceScore },
    { w: 0.20, v: pistolScore }
  ];
  const available = parts.filter(p => p.v != null);
  if (!available.length) return null;
  const wSum = available.reduce((s, p) => s + p.w, 0);
  const v = available.reduce((s, p) => s + (p.v as number) * p.w, 0) / wSum;
  return Math.round(v * 100) / 100;
}

export function disciplineScore(params: {
  questionnaireFilledDays: number;
  totalDays: number;
  excelLastUpdatedDayDelta: number | null; // 0=today,1=yesterday
}): number {
  const completion = params.totalDays > 0 ? (params.questionnaireFilledDays / params.totalDays) * 100 : 0;

  let freshness = 0;
  const d = params.excelLastUpdatedDayDelta;
  if (d == null) freshness = 0;
  else if (d <= 0) freshness = 100;
  else if (d === 1) freshness = 75;
  else if (d === 2) freshness = 55;
  else freshness = 30;

  const v = 0.6 * completion + 0.4 * freshness;
  return Math.round(clamp(v, 0, 100) * 100) / 100;
}

export function successScore(params: {
  readiness: number | null;
  performance: number | null;
  discipline: number | null;
}): number | null {
  const parts: Array<{ w: number; v: number | null }> = [
    { w: 0.35, v: params.readiness },
    { w: 0.40, v: params.performance },
    { w: 0.25, v: params.discipline }
  ];
  const available = parts.filter(p => p.v != null);
  if (!available.length) return null;
  const wSum = available.reduce((s, p) => s + p.w, 0);
  const v = available.reduce((s, p) => s + (p.v as number) * p.w, 0) / wSum;
  return Math.round(v * 100) / 100;
}

export function confidenceScore(params: {
  completeness: number; // 0..100
  freshness: number; // 0..100
}): number {
  return Math.round(clamp(0.5 * params.completeness + 0.5 * params.freshness, 0, 100) * 100) / 100;
}

