import express from 'express';
import { protect, isStaff, hasPerformanceCoachCrmSubscription } from '../middleware/auth';
import MoodEntry from '../models/MoodEntry';
import ScreenTime from '../models/ScreenTime';
import SleepEntry from '../models/SleepEntry';
import User from '../models/User';
import { asyncHandler } from '../middleware/asyncHandler';
import { badRequest } from '../utils/apiError';
import { findAccessiblePlayerById, isTeamStaffUser } from '../utils/teamAccess';
import { resolveEffectiveSubscriptionAccess } from '../utils/subscriptionAccess';
import {
  BASELINE_CS2_ROLES,
  BASELINE_ROUND_STRENGTHS,
  BASELINE_SIDE_PREFERENCES,
  buildBaselinePersonalitySummary,
  maskBaselineAssessmentSummary,
  validateBaselineAnswers
} from '../utils/baselineAssessment';

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

async function hasPerformanceCoachCrmAccessForUser(user: any): Promise<boolean> {
  const accessFlags = await resolveEffectiveSubscriptionAccess(user);
  return Boolean(accessFlags.hasPerformanceCoachCrmAccess);
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
    if (isTeamStaffUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Staff профиля team доступен только read-only режим daily questionnaire'
      });
    }

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

    let targetUserId = req.user.role === 'staff' && userId ? userId : req.user._id;
    const day = parseDateOnly(date);
    if (!day) throw badRequest('Некорректная дата (ожидается YYYY-MM-DD)');

    if (req.user.role === 'staff' && userId) {
      const player = await findAccessiblePlayerById(req.user, userId, '_id');
      if (!player) {
        throw badRequest('Игрок недоступен для этой команды');
      }
      targetUserId = player._id;
    }

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
      if (hasBreakdown && breakdownTotal > resolvedScreenTimeHours) {
        throw badRequest('Сумма детализации экранного времени не может превышать общее экранное время');
      }

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

router.get(
  '/daily/status',
  asyncHandler(async (req: any, res) => {
    const day = parseDateOnly(req.query.date as string | undefined);
    if (!day) throw badRequest('Некорректная date');

    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [sleepEntry, screenEntry] = await Promise.all([
      SleepEntry.findOne({ userId: req.user._id, date: { $gte: day, $lt: nextDay } }).select('_id').lean(),
      ScreenTime.findOne({ userId: req.user._id, date: { $gte: day, $lt: nextDay } }).select('_id').lean()
    ]);

    return res.json({
      success: true,
      date: day.toISOString().slice(0, 10),
      sleepDone: Boolean(sleepEntry),
      screenDone: Boolean(screenEntry),
      completed: Boolean(sleepEntry && screenEntry)
    });
  })
);

// My daily questionnaire history (combined)
router.get(
  '/daily/my',
  hasPerformanceCoachCrmSubscription,
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
  hasPerformanceCoachCrmSubscription,
  asyncHandler(async (req: any, res) => {
    const playerId = req.params.playerId;
    const dateFrom = parseDateOnly(req.query.dateFrom as string | undefined);
    const dateTo = parseDateOnly(req.query.dateTo as string | undefined) || new Date();
    if (!dateFrom) throw badRequest('Некорректная dateFrom');

    const player = await findAccessiblePlayerById(req.user, playerId, '_id');
    if (!player) throw badRequest('Игрок недоступен для этой команды');

    const [mood, sleep, screen] = await Promise.all([
      MoodEntry.find({ userId: player._id, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      SleepEntry.find({ userId: player._id, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean(),
      ScreenTime.find({ userId: player._id, date: { $gte: dateFrom, $lte: dateTo } }).sort({ date: -1 }).lean()
    ]);

    return res.json({ success: true, mood, sleep, screen });
  })
);

router.get(
  '/baseline/me',
  asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.user._id).select('baselineAssessment').lean();
    const accessFlags = await hasPerformanceCoachCrmAccessForUser(req.user);

    return res.json({
      success: true,
      data: maskBaselineAssessmentSummary(user?.baselineAssessment || null, accessFlags),
      baselineAssessmentCompleted: Boolean(user?.baselineAssessment?.completedAt)
    });
  })
);

router.post(
  '/baseline',
  asyncHandler(async (req: any, res) => {
    const {
      personalityAnswers,
      cs2Role
    }: {
      personalityAnswers?: Array<{ questionId: string; optionId: string }>;
      cs2Role?: {
        primaryRole?: string;
        secondaryRole?: string;
        sidePreference?: string;
        roundStrength?: string;
      };
    } = req.body || {};

    const answersValidation = validateBaselineAnswers(personalityAnswers || []);
    if (!answersValidation.valid) {
      throw badRequest(answersValidation.message || 'Некорректные ответы базового анкетирования');
    }

    if (!cs2Role?.primaryRole || !BASELINE_CS2_ROLES.includes(cs2Role.primaryRole as any)) {
      throw badRequest('Укажите корректную основную роль в CS2');
    }

    if (
      cs2Role.secondaryRole &&
      (!BASELINE_CS2_ROLES.includes(cs2Role.secondaryRole as any) ||
        cs2Role.secondaryRole === cs2Role.primaryRole)
    ) {
      throw badRequest('Вторичная роль должна отличаться от основной и быть корректной');
    }

    if (!cs2Role.sidePreference || !BASELINE_SIDE_PREFERENCES.includes(cs2Role.sidePreference as any)) {
      throw badRequest('Укажите корректное предпочтение по стороне');
    }

    if (!cs2Role.roundStrength || !BASELINE_ROUND_STRENGTHS.includes(cs2Role.roundStrength as any)) {
      throw badRequest('Укажите корректную сильную фазу раунда');
    }

    const personalitySummary = buildBaselinePersonalitySummary(personalityAnswers || []);
    const completedAt = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          baselineAssessment: {
            completedAt,
            personality: {
              answers: personalityAnswers,
              summary: personalitySummary
            },
            cs2Role: {
              primaryRole: cs2Role.primaryRole,
              secondaryRole: cs2Role.secondaryRole || '',
              sidePreference: cs2Role.sidePreference,
              roundStrength: cs2Role.roundStrength
            }
          }
        }
      },
      {
        new: true
      }
    ).select('baselineAssessment');

    const accessFlags = await hasPerformanceCoachCrmAccessForUser(req.user);

    return res.json({
      success: true,
      data: maskBaselineAssessmentSummary(updatedUser?.baselineAssessment || null, accessFlags),
      baselineAssessmentCompleted: true
    });
  })
);

export default router;
