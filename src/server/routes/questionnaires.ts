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
  if (!dateStr) return new Date();
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Daily questionnaire submit
 * Body: { date(YYYY-MM-DD)?, userId?(staff), mood(1..10)?, energy(1..10)?, sleepHours(0..24)?, screenTimeHours(0..24)? }
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
      screenTimeHours
    }: {
      date?: string;
      userId?: string;
      mood?: number;
      energy?: number;
      sleepHours?: number;
      screenTimeHours?: number;
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

    if (sleepHours != null) {
      ops.push(
        SleepEntry.findOneAndUpdate(
          { userId: targetUserId, date: day },
          { $set: { hours: sleepHours } },
          { upsert: true, new: true }
        )
      );
    }

    if (screenTimeHours != null) {
      // Minimal upsert: keep breakdowns at 0; user can later fill detailed categories in screen-time feature.
      ops.push(
        ScreenTime.findOneAndUpdate(
          { userId: targetUserId, date: day },
          {
            $set: {
              totalTime: screenTimeHours,
              entertainment: 0,
              communication: 0,
              browser: 0,
              study: 0,
              calculatedTotal: 0
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

