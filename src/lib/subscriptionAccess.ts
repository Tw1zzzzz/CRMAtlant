import ROUTES from '@/lib/routes';
import type { User } from '@/types';

export const PERFORMANCE_COACH_CRM_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.TEST_TRACKER,
] as const;

export const CORRELATION_ANALYSIS_PLAN_PREFIX = 'Корреляционный анализ';
export const GAME_STATS_PLAN_PREFIX = 'Игровая статистика';
export const PERFORMANCE_COACH_CRM_PLAN_PREFIX = 'PerformanceCoach CRM';

export const hasPerformanceCoachCrmAccess = (user: User | null): boolean =>
  Boolean(user?.hasPerformanceCoachCrmAccess);

export const hasCorrelationAnalysisAccess = (user: User | null): boolean =>
  Boolean(user?.hasCorrelationAnalysisAccess);

export const hasGameStatsAccess = (user: User | null): boolean =>
  Boolean(user?.hasGameStatsAccess);

export const isCorrelationAnalysisPlanName = (planName: string): boolean =>
  planName.startsWith(CORRELATION_ANALYSIS_PLAN_PREFIX);

export const isGameStatsPlanName = (planName: string): boolean =>
  planName.startsWith(GAME_STATS_PLAN_PREFIX);

export const isPerformanceCoachCrmPlanName = (planName: string): boolean =>
  planName.startsWith(PERFORMANCE_COACH_CRM_PLAN_PREFIX);

export const isPlanActiveForUser = (user: User | null, planName: string): boolean => {
  if (isPerformanceCoachCrmPlanName(planName)) {
    return hasPerformanceCoachCrmAccess(user);
  }

  if (isCorrelationAnalysisPlanName(planName)) {
    return hasCorrelationAnalysisAccess(user);
  }

  if (isGameStatsPlanName(planName)) {
    return hasGameStatsAccess(user);
  }

  return false;
};
