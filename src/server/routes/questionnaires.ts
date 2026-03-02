import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import MoodEntry from '../models/MoodEntry';
import ScreenTime from '../models/ScreenTime';
import SleepEntry from '../models/SleepEntry';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest } from '../utils/apiError';

const router = express.Router();

router.use(protect);

function parseDateOnly(dateStr?: string) {
  if (!dateStr) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function calculateSleepHours(startTime?: string, endTime?: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return undefined;
  const diff = end >= start ? end - start : (24 * 60 - start) + end;
  return Number((diff / 60).toFixed(2));
}

/**
 * Daily questionnaire submit
 * Body: {
 *  date(YYYY-MM-DD)?,
 *  userId?(staff),
 *  mood(1..10)?,
 *  energy(1..10)?,
 *  sleepHours(0..24)?,
 *  sleepStartTime(HH:mm)?,
 *  sleepEndTime(HH:mm)?,
 *  screenTimeHours(0..24)?,
 *  screenBreakdown?: { entertainment?, communication?, browser?, study? }
 * }
 */
router.post(
  '/daily',
  asyncHandler(async (req: any, res) => {
    const {
      date,
      userId,
      mood,
      energy,
      sleepHours,
      sleepStartTime,
      sleepEndTime,
      screenTimeHours,
      screenBreakdown
    }: {
      date?: string;
      userId?: string;
      mood?: number;
      energy?: number;
      sleepHours?: number;
      sleepStartTime?: string;
      sleepEndTime?: string;
      screenTimeHours?: number;
      screenBreakdown?: {
        entertainment?: number;
        communication?: number;
        browser?: number;
        study?: number;
      };
    } = req.body || {};

    const targetUserId = req.user.role === 'staff' && userId ? userId : req.user._id;
    const day = parseDateOnly(date);
    if (!day) throw badRequest('Некорректная дата (ожидается YYYY-MM-DD)');

    const ops: Array<Promise<any>> = [];

    if (mood != null || energy != null) {
      if (mood == null || energy == null) {
        throw badRequest('Для настроения нужно передать и mood, и energy');
      }
      ops.push(
        MoodEntry.create({
          userId: targetUserId,
          date: day,
          timeOfDay: 'morning',
          mood,
          energy,
          comment: ''
        })
      );
    }

    if ((sleepStartTime && !sleepEndTime) || (!sleepStartTime && sleepEndTime)) {
      throw badRequest('Для диапазона сна нужно передать и sleepStartTime, и sleepEndTime');
    }

    const resolvedSleepHours = sleepHours != null
      ? sleepHours
      : calculateSleepHours(sleepStartTime, sleepEndTime);

    if (resolvedSleepHours != null) {
      const sleepComment = sleepStartTime && sleepEndTime
        ? `Сон: с ${sleepStartTime} до ${sleepEndTime}`
        : '';

      ops.push(
        SleepEntry.findOneAndUpdate(
          { userId: targetUserId, date: day },
          { $set: { hours: resolvedSleepHours, comment: sleepComment } },
          { upsert: true, new: true }
        )
      );
    }

    const breakdown = {
      entertainment: screenBreakdown?.entertainment ?? 0,
      communication: screenBreakdown?.communication ?? 0,
      browser: screenBreakdown?.browser ?? 0,
      study: screenBreakdown?.study ?? 0
    };
    const breakdownTotal = breakdown.entertainment + breakdown.communication + breakdown.browser + breakdown.study;
    const hasBreakdown = Object.values(breakdown).some((value) => value > 0);
    const resolvedScreenTimeHours = screenTimeHours != null ? screenTimeHours : (hasBreakdown ? breakdownTotal : undefined);

    if (resolvedScreenTimeHours != null) {
      ops.push(
        ScreenTime.findOneAndUpdate(
          { userId: targetUserId, date: day },
          {
            $set: {
              totalTime: resolvedScreenTimeHours,
              entertainment: breakdown.entertainment,
              communication: breakdown.communication,
              browser: breakdown.browser,
              study: breakdown.study,
              calculatedTotal: breakdownTotal
            }
          },
          { upsert: true, new: true }
        )
      );
    }

    if (!ops.length) throw badRequest('Нет данных для сохранения');
    await Promise.all(ops);

    return res.json({ success: true });
  })
);

// My daily questionnaire history (combined)
router.get(
  '/daily/my',
  asyncHandler(async (req: any, res) => {
    const dateFrom = parseDateOnly(req.query.dateFrom as string | undefined);
    const dateTo = parseDateOnly(req.query.dateTo as string | undefined) || new Date();
    if (!dateFrom) throw badRequest('Некорректная dateFrom');

    const userId = req.user._id;
    const [mood, sleep, screen] = await Promise.all([
      MoodEntry.find({ userId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      SleepEntry.find({ userId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      ScreenTime.find({ userId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean()
    ]);

    return res.json({ success: true, mood, sleep, screen });
  })
);

// Staff: player daily questionnaire history
router.get(
  '/daily/player/:playerId',
  isStaff,
  asyncHandler(async (req: any, res) => {
    const playerId = req.params.playerId;
    const dateFrom = parseDateOnly(req.query.dateFrom as string | undefined);
    const dateTo = parseDateOnly(req.query.dateTo as string | undefined) || new Date();
    if (!dateFrom) throw badRequest('Некорректная dateFrom');

    const [mood, sleep, screen] = await Promise.all([
      MoodEntry.find({ userId: playerId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      SleepEntry.find({ userId: playerId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      ScreenTime.find({ userId: playerId, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean()
    ]);

    return res.json({ success: true, mood, sleep, screen });
  })
);

export default router;
