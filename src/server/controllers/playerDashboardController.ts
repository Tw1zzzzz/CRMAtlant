import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import PlayerCard from '../models/PlayerCard';
import MoodEntry from '../models/MoodEntry';
import ScreenTime from '../models/ScreenTime';
import GameStats from '../models/GameStats';
import SleepEntry from '../models/SleepEntry';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest, notFound } from '../utils/apiError';
import {
  clamp,
  confidenceScore,
  disciplineScore,
  performanceScore,
  readinessScore,
  successScore,
  toDayKey
} from '../domain/scores';
import { buildBrainPerformanceSummary } from '../services/brainTestsService';
import { findAccessiblePlayerById } from '../utils/teamAccess';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgoUTC(n: number) {
  const now = new Date();
  const d = startOfDayUTC(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function dayDeltaFromToday(date: Date | null) {
  if (!date) return null;
  const today = startOfDayUTC(new Date());
  const d = startOfDayUTC(date);
  const diffMs = today.getTime() - d.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export const getPlayerDashboardByUserId = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest('Некорректный формат userId');
  }

  const user = await findAccessiblePlayerById(
    (req as any).user,
    userId,
    'name email avatar role playerType teamId'
  );
  if (!user) throw notFound('Пользователь не найден');

  const playerCard = await PlayerCard.findOne({ userId: user._id });
  const nickname = playerCard?.contacts?.nickname || null;

  const now = new Date();
  const start30 = daysAgoUTC(29); // inclusive window for 30 days
  const start7 = daysAgoUTC(6);

  const [moodEntries, screenTimes, gameStats, brainSummary] = await Promise.all([
    MoodEntry.find({ userId: user._id, date: { $gte: start30, $lte: now } }).sort({ date: 1 }).lean(),
    ScreenTime.find({ userId: user._id, date: { $gte: start30, $lte: now } }).sort({ date: 1 }).lean(),
    GameStats.find({ userId: user._id, date: { $gte: start30, $lte: now } }).sort({ date: 1 }).lean(),
    buildBrainPerformanceSummary(user._id.toString(), 30)
  ]);

  const sleepEntries = await SleepEntry.find({ userId: user._id, date: { $gte: start30, $lte: now } })
    .sort({ date: 1 })
    .lean();

  // Group mood by day and average mood/energy
  const moodByDay = new Map<string, { mood: number[]; energy: number[] }>();
  for (const e of moodEntries) {
    const key = toDayKey(new Date(e.date));
    const cur = moodByDay.get(key) || { mood: [], energy: [] };
    cur.mood.push(Number(e.mood));
    cur.energy.push(Number(e.energy));
    moodByDay.set(key, cur);
  }

  // ScreenTime by day (use totalTime)
  const screenByDay = new Map<string, number>();
  for (const s of screenTimes) {
    const key = toDayKey(new Date(s.date));
    screenByDay.set(key, Number(s.totalTime));
  }

  // Sleep by day (hours)
  const sleepByDay = new Map<string, number>();
  for (const s of sleepEntries) {
    const key = toDayKey(new Date(s.date));
    sleepByDay.set(key, Number(s.hours));
  }

  // GameStats by day (keep last record per day)
  const gameByDay = new Map<string, any>();
  for (const g of gameStats) {
    const key = toDayKey(new Date(g.date));
    gameByDay.set(key, g);
  }

  function buildTimeline(days: 7 | 30) {
    const start = days === 7 ? start7 : start30;
    const totalDays = days;
    const points: Array<any> = [];

    let questionnaireFilledDays = 0;
    let lastExcelDate: Date | null = null;
    let lastSurveyDate: Date | null = null;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = toDayKey(d);

      const moodAgg = moodByDay.get(key);
      const moodAvg = moodAgg ? avg(moodAgg.mood) : null;
      const energyAvg = moodAgg ? avg(moodAgg.energy) : null;
      const screenHours = screenByDay.get(key) ?? null;
      const sleepHours = sleepByDay.get(key) ?? null;

      const readiness = readinessScore({
        mood: moodAvg,
        energy: energyAvg,
        sleepHours,
        screenHours
      });

      const gs = gameByDay.get(key) || null;
      const performance = gs
        ? performanceScore({
            winRate: gs.winRate,
            roundWinRate: gs.roundWinRate,
            ctRoundWinRate: gs.ctSide?.roundWinRate,
            tRoundWinRate: gs.tSide?.roundWinRate,
            pistolWinRate: gs.pistolWinRate
          })
        : null;

      const hasSurvey = readiness != null;
      if (hasSurvey) {
        questionnaireFilledDays += 1;
        lastSurveyDate = d;
      }
      if (gs) lastExcelDate = d;

      const discipline = disciplineScore({
        questionnaireFilledDays: hasSurvey ? 1 : 0,
        totalDays: 1,
        excelLastUpdatedDayDelta: gs ? 0 : null
      });

      const success = successScore({ readiness, performance, discipline });

      // completeness for a single day: survey+excel presence
      const completeness = ((hasSurvey ? 1 : 0) + (gs ? 1 : 0)) / 2 * 100;
      const freshness = clamp(((gs ? 1 : 0) + (hasSurvey ? 1 : 0)) / 2 * 100, 0, 100);
      const confidence = confidenceScore({ completeness, freshness });

      points.push({
        date: key,
        readiness,
        performance,
        discipline,
        success,
        confidence
      });
    }

    const last = points[points.length - 1] || null;

    const completenessWindow = (questionnaireFilledDays / totalDays) * 100;
    const excelDelta = dayDeltaFromToday(lastExcelDate);
    const surveyDelta = dayDeltaFromToday(lastSurveyDate);
    const freshnessWindow = clamp(
      100 -
        10 * Math.max(excelDelta ?? 30, 0) -
        10 * Math.max(surveyDelta ?? 30, 0),
      0,
      100
    );

    const confidenceWindow = confidenceScore({
      completeness: completenessWindow,
      freshness: freshnessWindow
    });

    const disciplineWindow = disciplineScore({
      questionnaireFilledDays,
      totalDays,
      excelLastUpdatedDayDelta: excelDelta
    });

    const readinessWindow = avg(points.map(p => p.readiness).filter((v: any) => typeof v === 'number'));
    const performanceWindow = avg(points.map(p => p.performance).filter((v: any) => typeof v === 'number'));
    const successWindow = successScore({
      readiness: readinessWindow,
      performance: performanceWindow,
      discipline: disciplineWindow
    });

    return {
      summary: {
        readiness: readinessWindow != null ? Math.round(readinessWindow * 100) / 100 : null,
        performance: performanceWindow != null ? Math.round(performanceWindow * 100) / 100 : null,
        discipline: disciplineWindow,
        success: successWindow,
        confidence: confidenceWindow
      },
      timeline: points
    };
  }

  const week = buildTimeline(7);
  const month = buildTimeline(30);

  const latestDay = week.timeline[week.timeline.length - 1] || null;
  const moodAggLatest = latestDay ? moodByDay.get(latestDay.date) : null;
  const drivers = [
    { label: 'Настроение', value: moodAggLatest ? avg(moodAggLatest.mood) : null },
    { label: 'Энергия', value: moodAggLatest ? avg(moodAggLatest.energy) : null },
    { label: 'Сон (ч)', value: latestDay ? (sleepByDay.get(latestDay.date) ?? null) : null },
    { label: 'Экранное время (ч)', value: latestDay ? (screenByDay.get(latestDay.date) ?? null) : null },
    { label: 'Win-rate %', value: latestDay && gameByDay.get(latestDay.date) ? gameByDay.get(latestDay.date).winRate : null }
  ];

  return res.json({
    success: true,
    data: {
      player: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname
      },
      scores: {
        readiness: week.summary.readiness,
        performance: week.summary.performance,
        discipline: week.summary.discipline,
        success: week.summary.success,
        confidence: week.summary.confidence,
        brainPerformance: brainSummary.brainPerformanceIndex
      },
      windows: {
        days7: {
          readiness: week.summary.readiness,
          performance: week.summary.performance,
          discipline: week.summary.discipline,
          success: week.summary.success
        },
        days30: {
          readiness: month.summary.readiness,
          performance: month.summary.performance,
          discipline: month.summary.discipline,
          success: month.summary.success
        }
      },
      brain: {
        brainPerformanceIndex: brainSummary.brainPerformanceIndex,
        confidence: brainSummary.confidence,
        calibrationStatus: brainSummary.calibrationStatus
      },
      drivers,
      timeline: {
        days7: week.timeline.map(p => ({
          date: p.date,
          readiness: p.readiness,
          performance: p.performance,
          discipline: p.discipline,
          success: p.success
        })),
        days30: month.timeline.map(p => ({
          date: p.date,
          readiness: p.readiness,
          performance: p.performance,
          discipline: p.discipline,
          success: p.success
        }))
      }
    }
  });
});

export const getPlayerDashboardByNickname = asyncHandler(async (req: Request, res: Response) => {
  const nickname = (req.params.nickname || '').trim();
  if (!nickname) throw badRequest('nickname обязателен');

  const card = await PlayerCard.findOne({ 'contacts.nickname': nickname }).select('userId');
  if (!card) throw notFound('Игрок с таким ником не найден');

  // Reuse by userId
  req.params.userId = card.userId.toString();
  return getPlayerDashboardByUserId(req, res);
});

import { Response } from 'express';
import { AuthRequest } from '../types';
import MoodEntry from '../models/MoodEntry';
import ScreenTime from '../models/ScreenTime';
import GameStats from '../models/GameStats';
import User from '../models/User';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getDateKey = (date: Date) => new Date(date).toISOString().slice(0, 10);

const getRecentDates = (days: number) => {
  const today = new Date();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(getDateKey(d));
  }
  return dates;
};

const average = (values: number[]) => {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
};

const flattenNumbers = (arrays: number[][]) => arrays.reduce((acc, arr) => acc.concat(arr), [] as number[]);

export const getPlayerDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId || req.user?._id?.toString();
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID пользователя не указан' });
    }

    const user = await User.findById(userId, 'name avatar');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Пользователь не найден' });
    }

    const endDate = new Date();
    const start30 = new Date(endDate);
    start30.setDate(endDate.getDate() - 29);

    const [moodEntries, screenEntries, gameEntries] = await Promise.all([
      MoodEntry.find({ userId, date: { $gte: start30, $lte: endDate } }).lean(),
      ScreenTime.find({ userId, date: { $gte: start30, $lte: endDate } }).lean(),
      GameStats.find({ userId, date: { $gte: start30, $lte: endDate } }).lean()
    ]);

    const moodMap = new Map<string, number[]>();
    const energyMap = new Map<string, number[]>();
    moodEntries.forEach((entry: any) => {
      const key = getDateKey(entry.date);
      if (!moodMap.has(key)) moodMap.set(key, []);
      if (!energyMap.has(key)) energyMap.set(key, []);
      moodMap.get(key)!.push(entry.mood || 0);
      energyMap.get(key)!.push(entry.energy || 0);
    });

    const screenMap = new Map<string, { totalTime: number }>();
    screenEntries.forEach((entry: any) => {
      screenMap.set(getDateKey(entry.date), { totalTime: entry.totalTime || 0 });
    });

    const gameMap = new Map<string, { winRates: number[]; kdRatios: number[] }>();
    gameEntries.forEach((entry: any) => {
      const key = getDateKey(entry.date);
      if (!gameMap.has(key)) gameMap.set(key, { winRates: [], kdRatios: [] });
      gameMap.get(key)!.winRates.push(entry.winRate || 0);
      gameMap.get(key)!.kdRatios.push(entry.kdRatio || 0);
    });

    const buildTimeline = (days: number) => {
      const dates = getRecentDates(days);
      return dates.map((dateKey) => {
        const moodAvg = average(moodMap.get(dateKey) || []);
        const energyAvg = average(energyMap.get(dateKey) || []);
        const moodEnergy = moodAvg !== null && energyAvg !== null ? (moodAvg + energyAvg) / 2 : null;
        const screen = screenMap.get(dateKey);
        const screenPenalty = screen ? Math.max(0, screen.totalTime - 8) * 5 : 0;
        const readiness = moodEnergy !== null ? clamp(Math.round(moodEnergy * 10 - screenPenalty), 0, 100) : null;

        const game = gameMap.get(dateKey);
        const winRate = average(game?.winRates || []);
        const kdRatio = average(game?.kdRatios || []);
        const kdScore = kdRatio !== null ? clamp(Math.round(kdRatio * 50), 0, 100) : null;
        const performance = winRate !== null && kdScore !== null
          ? clamp(Math.round(winRate * 0.7 + kdScore * 0.3), 0, 100)
          : null;

        const success = readiness !== null && performance !== null
          ? clamp(Math.round(performance * 0.6 + readiness * 0.4), 0, 100)
          : null;

        return {
          date: dateKey,
          readiness,
          performance,
          success
        };
      });
    };

    const timeline7 = buildTimeline(7);
    const timeline30 = buildTimeline(30);

    const avgScore = (timeline: any[], key: 'readiness' | 'performance' | 'success') => {
      const values = timeline.map((t) => t[key]).filter((v) => typeof v === 'number');
      if (!values.length) return null;
      return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
    };

    const readiness7 = avgScore(timeline7, 'readiness');
    const performance7 = avgScore(timeline7, 'performance');
    const success7 = avgScore(timeline7, 'success');

    const readiness30 = avgScore(timeline30, 'readiness');
    const performance30 = avgScore(timeline30, 'performance');
    const success30 = avgScore(timeline30, 'success');

    const moodDays = timeline7.filter((t) => t.readiness !== null).length;
    const gameDays = timeline7.filter((t) => t.performance !== null).length;
    const screenDays = timeline7.filter((t) => screenMap.has(t.date)).length;
    const confidence = clamp(Math.round(((moodDays + gameDays + screenDays) / (7 * 3)) * 100), 0, 100);

    const moodValues7 = flattenNumbers(timeline7.map((t) => moodMap.get(t.date) || []));
    const energyValues7 = flattenNumbers(timeline7.map((t) => energyMap.get(t.date) || []));
    const winRateValues7 = flattenNumbers(timeline7.map((t) => gameMap.get(t.date)?.winRates || []));
    const kdValues7 = flattenNumbers(timeline7.map((t) => gameMap.get(t.date)?.kdRatios || []));
    const screenValues7 = timeline7
      .map((t) => screenMap.get(t.date)?.totalTime)
      .filter((value): value is number => typeof value === 'number');

    const drivers = [
      { label: 'Среднее настроение (7д)', value: average(moodValues7) },
      { label: 'Средняя энергия (7д)', value: average(energyValues7) },
      { label: 'WinRate (7д)', value: average(winRateValues7) },
      { label: 'K/D (7д)', value: average(kdValues7) },
      { label: 'Экранное время (7д)', value: average(screenValues7) }
    ];

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        avatar: user.avatar
      },
      scores: {
        readiness: readiness7,
        performance: performance7,
        success: success7,
        confidence
      },
      windows: {
        days7: { readiness: readiness7, performance: performance7, success: success7 },
        days30: { readiness: readiness30, performance: performance30, success: success30 }
      },
      drivers,
      timeline: {
        days7: timeline7,
        days30: timeline30
      },
      formula: {
        success: '0.6*Performance + 0.4*Readiness',
        readiness: 'Avg(Mood, Energy)*10 - Penalty(ScreenTime>8h)'
      }
    });
  } catch (error) {
    console.error('Ошибка при получении дашборда игрока:', error);
    return res.status(500).json({ success: false, message: 'Ошибка сервера при получении дашборда игрока' });
  }
};
