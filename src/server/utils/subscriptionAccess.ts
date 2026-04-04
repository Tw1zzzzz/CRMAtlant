import Subscription from '../models/Subscription';
import Team from '../models/Team';

export interface SubscriptionPlanLike {
  _id?: unknown;
  id?: unknown;
  name?: unknown;
  periodDays?: unknown;
}

export interface SubscriptionLike {
  _id?: unknown;
  id?: unknown;
  status?: unknown;
  startedAt?: unknown;
  expiresAt?: unknown;
  planId?: unknown;
}

export interface SubscriptionSummary {
  id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startedAt: string | null;
  expiresAt: string | null;
  planId: string | null;
  planName: string | null;
  periodDays: number | null;
}

export interface SubscriptionAccessFlags {
  hasPerformanceCoachCrmAccess: boolean;
  hasCorrelationAnalysisAccess: boolean;
  hasGameStatsAccess: boolean;
}

export interface EffectiveSubscriptionAccessFlags extends SubscriptionAccessFlags {
  inheritedFromTeamOwnerId: string | null;
}

export const PERFORMANCE_COACH_CRM_PLAN_PREFIX = 'PerformanceCoach CRM';
export const CORRELATION_ANALYSIS_PLAN_PREFIX = 'Корреляционный анализ';
export const GAME_STATS_PLAN_PREFIX = 'Игровая статистика';

type SubscriptionProduct = 'performanceCoachCrm' | 'correlationAnalysis' | 'gameStats';

const EMPTY_SUBSCRIPTION_ACCESS_FLAGS: SubscriptionAccessFlags = {
  hasPerformanceCoachCrmAccess: false,
  hasCorrelationAnalysisAccess: false,
  hasGameStatsAccess: false,
};

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

const toIsoStringOrNull = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const isPerformanceCoachCrmPlanName = (planName: unknown): boolean =>
  typeof planName === 'string' && planName.startsWith(PERFORMANCE_COACH_CRM_PLAN_PREFIX);

export const isCorrelationAnalysisPlanName = (planName: unknown): boolean =>
  typeof planName === 'string' && planName.startsWith(CORRELATION_ANALYSIS_PLAN_PREFIX);

export const isGameStatsPlanName = (planName: unknown): boolean =>
  typeof planName === 'string' && planName.startsWith(GAME_STATS_PLAN_PREFIX);

const isSubscriptionActive = (subscription: SubscriptionSummary | null | undefined): boolean => {
  if (!subscription || subscription.status !== 'active' || !subscription.expiresAt) {
    return false;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

const getPlanProduct = (planName: string | null): SubscriptionProduct | null => {
  if (isPerformanceCoachCrmPlanName(planName)) {
    return 'performanceCoachCrm';
  }

  if (isCorrelationAnalysisPlanName(planName)) {
    return 'correlationAnalysis';
  }

  if (isGameStatsPlanName(planName)) {
    return 'gameStats';
  }

  return null;
};

export const buildSubscriptionSummary = (subscription: SubscriptionLike | null | undefined): SubscriptionSummary | null => {
  if (!subscription || typeof subscription !== 'object') {
    return null;
  }

  const plan = subscription.planId as SubscriptionPlanLike | string | null | undefined;
  const planObject = plan && typeof plan === 'object' ? plan : null;
  const rawStatus = typeof subscription.status === 'string' ? subscription.status : 'pending';
  const status =
    rawStatus === 'active' || rawStatus === 'expired' || rawStatus === 'cancelled' || rawStatus === 'pending'
      ? rawStatus
      : 'pending';

  return {
    id: String(subscription._id || subscription.id || ''),
    status,
    startedAt: toIsoStringOrNull(subscription.startedAt),
    expiresAt: toIsoStringOrNull(subscription.expiresAt),
    planId: planObject
      ? String(planObject._id || planObject.id || plan)
      : typeof plan === 'string' || typeof plan === 'number'
        ? String(plan)
        : plan
          ? String(plan)
          : null,
    planName: typeof planObject?.name === 'string' ? planObject.name : null,
    periodDays: typeof planObject?.periodDays === 'number' ? planObject.periodDays : null,
  };
};

export const hasPerformanceCoachCrmAccess = (subscription: SubscriptionSummary | null | undefined): boolean => {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return false;
  }

  return isPerformanceCoachCrmPlanName(subscription.planName);
};

export const hasCorrelationAnalysisAccess = (subscription: SubscriptionSummary | null | undefined): boolean => {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return false;
  }

  return isCorrelationAnalysisPlanName(subscription.planName) || isPerformanceCoachCrmPlanName(subscription.planName);
};

export const hasGameStatsAccess = (subscription: SubscriptionSummary | null | undefined): boolean => {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return false;
  }

  return isGameStatsPlanName(subscription.planName) || isPerformanceCoachCrmPlanName(subscription.planName);
};

export const buildSubscriptionAccessFlags = (
  subscriptions: Array<SubscriptionSummary | null | undefined>
): SubscriptionAccessFlags => {
  const flags: SubscriptionAccessFlags = {
    ...EMPTY_SUBSCRIPTION_ACCESS_FLAGS,
  };

  subscriptions.forEach((subscription) => {
    if (!isSubscriptionActive(subscription)) {
      return;
    }

    if (!subscription) {
      return;
    }

    const product = getPlanProduct(subscription.planName);
    if (product === 'performanceCoachCrm') {
      flags.hasPerformanceCoachCrmAccess = true;
      flags.hasCorrelationAnalysisAccess = true;
      flags.hasGameStatsAccess = true;
    }

    if (product === 'correlationAnalysis') {
      flags.hasCorrelationAnalysisAccess = true;
    }

    if (product === 'gameStats') {
      flags.hasGameStatsAccess = true;
    }
  });

  return flags;
};

const loadActiveSubscriptionSummaries = async (userId: unknown): Promise<SubscriptionSummary[]> => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) {
    return [];
  }

  const activeSubscriptions = await Subscription.find({
    userId: normalizedUserId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).populate('planId');

  return activeSubscriptions
    .map((subscription) => buildSubscriptionSummary(subscription))
    .filter((subscription): subscription is SubscriptionSummary => Boolean(subscription));
};

export const resolveEffectiveSubscriptionAccess = async (
  user: { _id?: unknown; teamId?: unknown } | null | undefined
): Promise<EffectiveSubscriptionAccessFlags> => {
  const personalSubscriptions = await loadActiveSubscriptionSummaries(user?._id);
  const personalFlags = buildSubscriptionAccessFlags(personalSubscriptions);
  const userId = toIdString(user?._id);
  const teamId = toIdString(user?.teamId);

  if (!userId || !teamId) {
    return {
      ...personalFlags,
      inheritedFromTeamOwnerId: null,
    };
  }

  const team = await Team.findById(teamId).select('createdBy');
  const teamOwnerUserId = toIdString(team?.createdBy);

  if (!teamOwnerUserId || teamOwnerUserId === userId) {
    return {
      ...personalFlags,
      inheritedFromTeamOwnerId: null,
    };
  }

  const teamOwnerSubscriptions = await loadActiveSubscriptionSummaries(teamOwnerUserId);
  const teamOwnerFlags = buildSubscriptionAccessFlags(teamOwnerSubscriptions);

  if (!teamOwnerFlags.hasPerformanceCoachCrmAccess) {
    return {
      ...personalFlags,
      inheritedFromTeamOwnerId: null,
    };
  }

  return {
    hasPerformanceCoachCrmAccess: personalFlags.hasPerformanceCoachCrmAccess || teamOwnerFlags.hasPerformanceCoachCrmAccess,
    hasCorrelationAnalysisAccess: personalFlags.hasCorrelationAnalysisAccess || teamOwnerFlags.hasCorrelationAnalysisAccess,
    hasGameStatsAccess: personalFlags.hasGameStatsAccess || teamOwnerFlags.hasGameStatsAccess,
    inheritedFromTeamOwnerId: teamOwnerUserId,
  };
};
