import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Team from '../models/Team';
import Plan from '../models/Plan';
import Subscription from '../models/Subscription';
import AdminAuditLog, { AdminAuditAction } from '../models/AdminAuditLog';
import { protect, requireSuperAdmin } from '../middleware/auth';
import { ensurePlansSeeded } from '../config/paymentPlans';
import { buildSubscriptionSummary } from '../utils/subscriptionAccess';
import { applyActiveProfileProjection } from '../utils/userProfiles';
import { issuePasswordResetForUser } from '../services/passwordResetService';

const router = express.Router();

const DASHBOARD_WINDOWS = [7, 30, 90] as const;
const DEFAULT_DASHBOARD_WINDOW = 30;

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toIdString = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value && 'toString' in value) {
    return String(value.toString());
  }

  return String(value);
};

const toNullableId = (value: unknown): string | null => {
  const id = toIdString(value);
  return id || null;
};

const startOfDayUtc = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const normalizeDashboardWindow = (value: unknown): number => {
  const parsed = Number(value);
  return DASHBOARD_WINDOWS.includes(parsed as typeof DASHBOARD_WINDOWS[number])
    ? parsed
    : DEFAULT_DASHBOARD_WINDOW;
};

export const buildDailyRegistrationSeries = (
  days: number,
  buckets: Array<{ _id?: string; count?: number }>,
  now = new Date()
) => {
  const today = startOfDayUtc(now);
  const firstDay = addUtcDays(today, -(days - 1));
  const bucketMap = new Map(
    buckets.map((bucket) => [typeof bucket._id === 'string' ? bucket._id : '', Number(bucket.count || 0)])
  );

  return Array.from({ length: days }, (_, index) => {
    const currentDate = addUtcDays(firstDay, index);
    const isoDate = currentDate.toISOString().slice(0, 10);

    return {
      date: isoDate,
      registrations: bucketMap.get(isoDate) || 0,
    };
  });
};

const ensureDatabaseReady = (res: express.Response): boolean => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      message: 'База данных инициализируется, повторите запрос через несколько секунд',
    });
    return false;
  }

  return true;
};

type AdminListUser = {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  playerType?: string | null;
  teamId?: unknown;
  teamName?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  deactivatedAt?: Date | null;
  deactivatedReason?: string | null;
  createdAt: Date;
  subscription?: unknown;
  profiles?: unknown[];
  activeProfileKey?: string | null;
  privilegeKey?: string;
  teamLogo?: string;
};

type PopulatedUserPreview = {
  _id: unknown;
  name: string;
  email: string;
  isActive?: boolean;
};

type PopulatedTeamPreview = {
  _id: unknown;
  name: string;
};

const serializeUserForAdmin = (user: AdminListUser) => {
  applyActiveProfileProjection(user);

  return {
    id: toIdString(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    playerType: user.playerType || null,
    teamId: toNullableId(user.teamId),
    teamName: user.teamName || '',
    isSuperAdmin: Boolean(user.isSuperAdmin),
    isActive: user.isActive !== false,
    deactivatedAt: user.deactivatedAt || null,
    deactivatedReason: user.deactivatedReason || null,
    createdAt: user.createdAt,
    subscription: buildSubscriptionSummary(user.subscription),
  };
};

const recordAuditLog = async (payload: {
  actorUserId?: unknown;
  targetUserId?: unknown;
  targetTeamId?: unknown;
  action: AdminAuditAction;
  meta?: Record<string, unknown>;
}) => {
  await AdminAuditLog.create({
    actorUserId: payload.actorUserId || null,
    targetUserId: payload.targetUserId || null,
    targetTeamId: payload.targetTeamId || null,
    action: payload.action,
    meta: payload.meta || {},
  });
};

const activatePlanForUser = async (userId: string, plan: { _id: unknown; periodDays: number }) => {
  await Subscription.updateMany(
    {
      userId,
      status: { $in: ['pending', 'active'] },
    },
    {
      $set: {
        status: 'cancelled',
      },
    }
  );

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + plan.periodDays * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    userId,
    planId: plan._id,
    status: 'active',
    startedAt,
    expiresAt,
    robokassaInvoiceId: `admin-grant-${new mongoose.Types.ObjectId().toString()}`,
  });

  await User.findByIdAndUpdate(userId, {
    subscription: subscription._id,
  });

  return subscription;
};

router.use(protect);
router.use(requireSuperAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const days = normalizeDashboardWindow(req.query.days);
    const now = new Date();
    const startDate = addUtcDays(startOfDayUtc(now), -(days - 1));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalPlayers,
      totalStaff,
      activeUsers,
      blockedUsers,
      newUsers7d,
      newUsers30d,
      recentRegistrations,
      registrationBuckets,
      playerTypeBuckets,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'player' }),
      User.countDocuments({ role: 'staff' }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name email role playerType isActive createdAt')
        .lean(),
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { role: 'player' } },
        {
          $group: {
            _id: '$playerType',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.json({
      totals: {
        users: totalUsers,
        players: totalPlayers,
        staff: totalStaff,
        active: activeUsers,
        blocked: blockedUsers,
        newUsers7d,
        newUsers30d,
      },
      selectedWindowDays: days,
      registrationSeries: buildDailyRegistrationSeries(days, registrationBuckets, now),
      playerTypeBreakdown: {
        solo: playerTypeBuckets.find((entry) => entry._id === 'solo')?.count || 0,
        team: playerTypeBuckets.find((entry) => entry._id === 'team')?.count || 0,
      },
      recentRegistrations: recentRegistrations.map((user) => ({
        id: toIdString(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        playerType: user.playerType || null,
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
      })),
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при загрузке dashboard:', error);
    return res.status(500).json({ message: 'Не удалось загрузить данные админки' });
  }
});

router.get('/users', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const query: Record<string, unknown> = {};
    const search = normalizeText(req.query.search);
    const role = normalizeText(req.query.role);
    const teamId = normalizeText(req.query.teamId);
    const isActiveRaw = normalizeText(req.query.isActive);

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role === 'player' || role === 'staff') {
      query.role = role;
    }

    if (isActiveRaw === 'true') {
      query.isActive = true;
    }

    if (isActiveRaw === 'false') {
      query.isActive = false;
    }

    if (teamId && mongoose.Types.ObjectId.isValid(teamId)) {
      query.teamId = teamId;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .limit(250)
        .select(
          'name email role playerType teamId teamName profiles activeProfileKey privilegeKey isSuperAdmin isActive deactivatedAt deactivatedReason subscription createdAt'
        )
        .populate({
          path: 'subscription',
          populate: {
            path: 'planId',
            model: 'Plan',
          },
        }),
      User.countDocuments(query),
    ]);

    return res.json({
      total,
      users: users.map(serializeUserForAdmin),
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при загрузке пользователей:', error);
    return res.status(500).json({ message: 'Не удалось загрузить пользователей' });
  }
});

router.get('/teams', async (_req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const teams = await Team.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select('name logo createdBy playerLimit isActive createdAt')
      .populate('createdBy', 'name email isActive');

    const rows = await Promise.all(
      teams.map(async (team) => {
        const [playerCount, staffCount] = await Promise.all([
          User.countDocuments({ teamId: team._id, role: 'player', playerType: 'team' }),
          User.countDocuments({ teamId: team._id, role: 'staff' }),
        ]);

        const owner = team.createdBy as unknown as PopulatedUserPreview | null;

        return {
          id: toIdString(team._id),
          name: team.name,
          logo: team.logo,
          playerLimit: team.playerLimit,
          isActive: team.isActive,
          createdAt: team.createdAt,
          playerCount,
          staffCount,
          owner:
          owner
            ? {
                id: toIdString(owner._id),
                name: owner.name,
                email: owner.email,
                isActive: owner.isActive !== false,
              }
            : null,
        };
      })
    );

    return res.json({ teams: rows });
  } catch (error) {
    console.error('[ADMIN] Ошибка при загрузке команд:', error);
    return res.status(500).json({ message: 'Не удалось загрузить команды' });
  }
});

router.post('/subscriptions/grant-user', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    await ensurePlansSeeded();

    const userId = normalizeText(req.body?.userId);
    const planId = normalizeText(req.body?.planId);

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: 'Необходимо передать корректные userId и planId' });
    }

    const [user, plan] = await Promise.all([
      User.findById(userId).select('name email'),
      Plan.findOne({ _id: planId, isActive: true }).select('name periodDays'),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!plan) {
      return res.status(404).json({ message: 'Тариф не найден' });
    }

    const subscription = await activatePlanForUser(userId, plan);

    await recordAuditLog({
      actorUserId: req.user?._id,
      targetUserId: user._id,
      action: 'grant_user_subscription',
      meta: {
        planId: toIdString(plan._id),
        planName: plan.name,
        subscriptionId: toIdString(subscription._id),
      },
    });

    return res.json({
      message: 'Тариф успешно выдан пользователю',
      subscription: {
        id: toIdString(subscription._id),
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при выдаче тарифа пользователю:', error);
    return res.status(500).json({ message: 'Не удалось выдать тариф пользователю' });
  }
});

router.post('/subscriptions/grant-team', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    await ensurePlansSeeded();

    const teamId = normalizeText(req.body?.teamId);
    const planId = normalizeText(req.body?.planId);

    if (!mongoose.Types.ObjectId.isValid(teamId) || !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ message: 'Необходимо передать корректные teamId и planId' });
    }

    const [team, plan] = await Promise.all([
      Team.findById(teamId).select('name createdBy'),
      Plan.findOne({ _id: planId, isActive: true }).select('name periodDays'),
    ]);

    if (!team) {
      return res.status(404).json({ message: 'Команда не найдена' });
    }

    if (!plan) {
      return res.status(404).json({ message: 'Тариф не найден' });
    }

    const teamOwnerId = toIdString(team.createdBy);
    if (!teamOwnerId) {
      return res.status(400).json({ message: 'У команды не найден владелец для выдачи тарифа' });
    }

    const teamOwner = await User.findById(teamOwnerId).select('_id');
    if (!teamOwner) {
      return res.status(404).json({ message: 'Владелец команды не найден' });
    }

    const subscription = await activatePlanForUser(teamOwnerId, plan);

    await recordAuditLog({
      actorUserId: req.user?._id,
      targetUserId: teamOwnerId,
      targetTeamId: team._id,
      action: 'grant_team_subscription',
      meta: {
        planId: toIdString(plan._id),
        planName: plan.name,
        subscriptionId: toIdString(subscription._id),
        teamName: team.name,
      },
    });

    return res.json({
      message: 'Тариф успешно выдан команде через владельца команды',
      ownerUserId: teamOwnerId,
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при выдаче тарифа команде:', error);
    return res.status(500).json({ message: 'Не удалось выдать тариф команде' });
  }
});

router.post('/users/:id/send-password-reset', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const userId = normalizeText(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Некорректный идентификатор пользователя' });
    }

    const user = await User.findById(userId).select('name email');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    await issuePasswordResetForUser({
      _id: user._id,
      email: user.email,
      name: user.name,
    });

    await recordAuditLog({
      actorUserId: req.user?._id,
      targetUserId: user._id,
      action: 'send_password_reset',
      meta: {
        email: user.email,
      },
    });

    return res.json({ message: 'Письмо для сброса пароля отправлено' });
  } catch (error) {
    console.error('[ADMIN] Ошибка при отправке password reset:', error);
    return res.status(503).json({ message: 'Не удалось отправить письмо для сброса пароля' });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const userId = normalizeText(req.params.id);
    const isActive = req.body?.isActive;
    const reason = normalizeText(req.body?.reason);

    if (!mongoose.Types.ObjectId.isValid(userId) || typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Необходимо передать корректные id и isActive' });
    }

    if (toIdString(req.user?._id) === userId) {
      return res.status(400).json({ message: 'Нельзя заблокировать собственный аккаунт' });
    }

    const user = await User.findById(userId).select('name email isSuperAdmin isActive');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!isActive && user.isSuperAdmin) {
      const otherActiveSuperAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        isSuperAdmin: true,
        isActive: true,
      });

      if (otherActiveSuperAdmins === 0) {
        return res.status(400).json({ message: 'Нельзя заблокировать последнего активного супер-админа' });
      }
    }

    user.isActive = isActive;
    user.deactivatedAt = isActive ? null : new Date();
    user.deactivatedReason = isActive ? null : reason || 'Заблокирован супер-администратором';
    await user.save();

    await recordAuditLog({
      actorUserId: req.user?._id,
      targetUserId: user._id,
      action: isActive ? 'unblock_user' : 'block_user',
      meta: {
        reason: user.deactivatedReason,
      },
    });

    return res.json({
      message: isActive ? 'Пользователь разблокирован' : 'Пользователь заблокирован',
      user: {
        id: toIdString(user._id),
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        deactivatedReason: user.deactivatedReason,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при обновлении статуса пользователя:', error);
    return res.status(500).json({ message: 'Не удалось обновить статус пользователя' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 30;

    const entries = await AdminAuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorUserId', 'name email')
      .populate('targetUserId', 'name email')
      .populate('targetTeamId', 'name');

    return res.json({
      entries: entries.map((entry) => {
        const actor = entry.actorUserId as unknown as PopulatedUserPreview | null;
        const targetUser = entry.targetUserId as unknown as PopulatedUserPreview | null;
        const targetTeam = entry.targetTeamId as unknown as PopulatedTeamPreview | null;

        return {
          id: toIdString(entry._id),
          action: entry.action,
          createdAt: entry.createdAt,
          meta: entry.meta || {},
          actor: actor
            ? {
                id: toIdString(actor._id),
                name: actor.name,
                email: actor.email,
              }
            : null,
          targetUser: targetUser
            ? {
                id: toIdString(targetUser._id),
                name: targetUser.name,
                email: targetUser.email,
              }
            : null,
          targetTeam: targetTeam
            ? {
                id: toIdString(targetTeam._id),
                name: targetTeam.name,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('[ADMIN] Ошибка при загрузке журнала действий:', error);
    return res.status(500).json({ message: 'Не удалось загрузить журнал действий' });
  }
});

export default router;
