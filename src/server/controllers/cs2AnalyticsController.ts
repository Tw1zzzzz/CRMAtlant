import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import PlayerCard from '../models/PlayerCard';
import GameStats from '../models/GameStats';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest, notFound } from '../utils/apiError';
import { performanceScore } from '../domain/scores';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysAgoUTC(n: number) {
  const d = startOfDayUTC(new Date());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}

function std(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const v = nums.reduce((s, n) => s + (n - m) * (n - m), 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function pickNum(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function summarize(gs: any[]) {
  const winRates = gs.map(g => pickNum(g.winRate)).filter((v): v is number => v != null);
  const roundRates = gs.map(g => pickNum(g.roundWinRate)).filter((v): v is number => v != null);
  const pistolRates = gs.map(g => pickNum(g.pistolWinRate)).filter((v): v is number => v != null);
  const ctRoundRates = gs.map(g => pickNum(g.ctSide?.roundWinRate)).filter((v): v is number => v != null);
  const tRoundRates = gs.map(g => pickNum(g.tSide?.roundWinRate)).filter((v): v is number => v != null);

  const perfScores = gs
    .map(g =>
      performanceScore({
        winRate: pickNum(g.winRate),
        roundWinRate: pickNum(g.roundWinRate),
        ctRoundWinRate: pickNum(g.ctSide?.roundWinRate),
        tRoundWinRate: pickNum(g.tSide?.roundWinRate),
        pistolWinRate: pickNum(g.pistolWinRate)
      })
    )
    .filter((v): v is number => typeof v === 'number');

  return {
    winRateAvg: avg(winRates),
    roundWinRateAvg: avg(roundRates),
    pistolWinRateAvg: avg(pistolRates),
    ctRoundWinRateAvg: avg(ctRoundRates),
    tRoundWinRateAvg: avg(tRoundRates),
    performanceScoreAvg: avg(perfScores),
    stability: {
      winRateStd: std(winRates),
      roundWinRateStd: std(roundRates)
    }
  };
}

export const getPlayerCs2Overview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) throw badRequest('Некорректный userId');

  const user = await User.findById(userId).select('name email role avatar');
  if (!user) throw notFound('Пользователь не найден');

  const card = await PlayerCard.findOne({ userId: user._id }).select('contacts.nickname');
  const nickname = card?.contacts?.nickname || null;

  const start30 = daysAgoUTC(29);
  const start7 = daysAgoUTC(6);
  const now = new Date();

  const gs30 = await GameStats.find({ userId: user._id, date: { $gte: start30, $lte: now } })
    .sort({ date: 1 })
    .lean();
  const gs7 = gs30.filter(g => new Date(g.date) >= start7);

  const s7 = summarize(gs7);
  const s30 = summarize(gs30);

  const deltaPerf =
    s7.performanceScoreAvg != null && s30.performanceScoreAvg != null ? s7.performanceScoreAvg - s30.performanceScoreAvg : null;

  const ctVsT =
    s7.ctRoundWinRateAvg != null && s7.tRoundWinRateAvg != null
      ? Math.abs(s7.ctRoundWinRateAvg - s7.tRoundWinRateAvg)
      : null;

  const weakerSide =
    s7.ctRoundWinRateAvg != null && s7.tRoundWinRateAvg != null
      ? (s7.ctRoundWinRateAvg < s7.tRoundWinRateAvg ? 'CT' : 'T')
      : null;

  const daysWithData7 = gs7.length;
  const daysWithData30 = gs30.length;

  const questions = [
    {
      id: 'form_trend',
      title: 'Тренд формы (7d vs 30d)',
      answer:
        deltaPerf == null
          ? 'Недостаточно данных'
          : deltaPerf >= 2
            ? `Форма растет (+${deltaPerf.toFixed(2)} к PerformanceScore)`
            : deltaPerf <= -2
              ? `Форма падает (${deltaPerf.toFixed(2)} к PerformanceScore)`
              : `Стабильно (${deltaPerf.toFixed(2)} к PerformanceScore)`
    },
    {
      id: 'compare_winrate',
      title: 'Сравнение WinRate (7d vs 30d)',
      answer:
        s7.winRateAvg == null || s30.winRateAvg == null
          ? 'Недостаточно данных'
          : `7d: ${s7.winRateAvg.toFixed(2)}% • 30d: ${s30.winRateAvg.toFixed(2)}%`
    },
    {
      id: 'stability',
      title: 'Стабильность (win/round)',
      answer: `WinRate σ=${(s7.stability.winRateStd || 0).toFixed(2)}; RoundWinRate σ=${(s7.stability.roundWinRateStd || 0).toFixed(2)}`
    },
    {
      id: 'ct_vs_t',
      title: 'CT vs T баланс (по round win rate)',
      answer: ctVsT == null ? 'Недостаточно данных' : `Разница ~${ctVsT.toFixed(2)} п.п.`
    },
    {
      id: 'weaker_side',
      title: 'Слабая сторона',
      answer: weakerSide == null ? 'Недостаточно данных' : `Слабее: ${weakerSide} (по round win rate, 7d)`
    },
    {
      id: 'pistols',
      title: 'Пистолетки',
      answer: s7.pistolWinRateAvg == null ? 'Недостаточно данных' : `Pistol WR ~${s7.pistolWinRateAvg.toFixed(2)}% (7d)`
    },
    {
      id: 'data_volume',
      title: 'Объем данных',
      answer: `Дней с данными: 7d=${daysWithData7}, 30d=${daysWithData30}`
    }
  ];

  return res.json({
    success: true,
    player: {
      userId: user._id.toString(),
      name: user.name,
      nickname
    },
    windows: {
      days7: s7,
      days30: s30
    },
    questions,
    timeline: gs30.map(g => ({
      date: new Date(g.date).toISOString().slice(0, 10),
      winRate: pickNum(g.winRate),
      roundWinRate: pickNum(g.roundWinRate),
      pistolWinRate: pickNum(g.pistolWinRate),
      ctRoundWinRate: pickNum(g.ctSide?.roundWinRate),
      tRoundWinRate: pickNum(g.tSide?.roundWinRate),
      performanceScore: performanceScore({
        winRate: pickNum(g.winRate),
        roundWinRate: pickNum(g.roundWinRate),
        ctRoundWinRate: pickNum(g.ctSide?.roundWinRate),
        tRoundWinRate: pickNum(g.tSide?.roundWinRate),
        pistolWinRate: pickNum(g.pistolWinRate)
      })
    }))
  });
});

