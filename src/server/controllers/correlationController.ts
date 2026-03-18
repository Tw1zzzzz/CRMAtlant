import { Response } from 'express';
import { AuthRequest } from '../types';
import {
  analyzeReportMoodCorrelations,
  analyzeTeamPerformancePatterns,
  analyzeBalanceWheelReportCorrelations,
  getComprehensiveCorrelationAnalysis
} from '../services/correlationAnalysisService';
import {
  generateCorrelationAssistantInsight,
  CorrelationAssistantPayload
} from '../services/correlationAiAssistantService';
import MoodEntry from '../models/MoodEntry';
import SleepEntry from '../models/SleepEntry';
import BalanceWheel from '../models/BalanceWheel';
import ScreenTime from '../models/ScreenTime';
import GameStats from '../models/GameStats';
import Match from '../models/Match';
import User from '../models/User';
import FaceitAccount from '../models/FaceitAccount';
import { getPlayerDailyStats, resolveFaceitProfile } from '../services/faceitService';
import BrainTestAttempt from '../models/BrainTestAttempt';
import { BRAIN_TEST_KEYS, computeBatteryIndex } from '../services/brainTestsService';

/**
 * Получить корреляции между отчетами команды и настроением игроков
 * GET /api/correlations/mood-reports
 */
export const getMoodReportsCorrelations = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // Проверка авторизации
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
    }

    // Получаем параметры запроса
    const { dateFrom, dateTo, teamId } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom && typeof dateFrom === 'string') {
      fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Неверный формат даты dateFrom' 
        });
      }
    }

    if (dateTo && typeof dateTo === 'string') {
      toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Неверный формат даты dateTo' 
        });
      }
    }

    console.log('[CorrelationController] Анализ корреляций настроения и отчетов от', req.user.name);
    console.log('[CorrelationController] Параметры:', { dateFrom, dateTo, teamId });

    // Получаем корреляции
    const correlations = await analyzeReportMoodCorrelations(
      teamId as string,
      fromDate,
      toDate
    );

    return res.status(200).json({
      success: true,
      data: correlations,
      meta: {
        totalCorrelations: correlations.length,
        generatedAt: new Date(),
        parameters: {
          dateFrom: fromDate,
          dateTo: toDate,
          teamId
        }
      }
    });

  } catch (error: any) {
    console.error('[CorrelationController] Ошибка получения корреляций настроения:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при анализе корреляций настроения и отчетов',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить паттерны производительности команды
 * GET /api/correlations/performance-patterns
 */
export const getPerformancePatterns = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
    }

    const { monthsBack } = req.query;
    let months = 6; // По умолчанию

    if (monthsBack && typeof monthsBack === 'string') {
      const parsed = parseInt(monthsBack, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 24) {
        months = parsed;
      }
    }

    console.log('[CorrelationController] Анализ паттернов производительности от', req.user.name);
    console.log('[CorrelationController] Период анализа:', months, 'месяцев');

    const patterns = await analyzeTeamPerformancePatterns(months);

    return res.status(200).json({
      success: true,
      data: patterns,
      meta: {
        totalPatterns: patterns.length,
        monthsAnalyzed: months,
        generatedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('[CorrelationController] Ошибка получения паттернов производительности:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при анализе паттернов производительности',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить корреляции между отчетами и колесом баланса
 * GET /api/correlations/balance-wheel-reports
 */
export const getBalanceWheelReportsCorrelations = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
    }

    const { dateFrom, dateTo } = req.query;

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom && typeof dateFrom === 'string') {
      fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateFrom'
        });
      }
    }

    if (dateTo && typeof dateTo === 'string') {
      toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateTo'
        });
      }
    }

    console.log('[CorrelationController] Анализ корреляций колеса баланса от', req.user.name);

    const correlations = await analyzeBalanceWheelReportCorrelations(fromDate, toDate);

    return res.status(200).json({
      success: true,
      data: correlations,
      meta: {
        totalCorrelations: correlations.length,
        generatedAt: new Date(),
        parameters: {
          dateFrom: fromDate,
          dateTo: toDate
        }
      }
    });

  } catch (error: any) {
    console.error('[CorrelationController] Ошибка получения корреляций колеса баланса:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при анализе корреляций колеса баланса и отчетов',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить комплексный корреляционный анализ
 * GET /api/correlations/comprehensive
 */
export const getComprehensiveAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
    }

    const { dateFrom, dateTo } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom && typeof dateFrom === 'string') {
      fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Неверный формат даты dateFrom' 
        });
      }
    }

    if (dateTo && typeof dateTo === 'string') {
      toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Неверный формат даты dateTo' 
        });
      }
    }

    console.log('[CorrelationController] Комплексный корреляционный анализ от', req.user.name);
    console.log('[CorrelationController] Период:', { dateFrom, dateTo });

    const analysis = await getComprehensiveCorrelationAnalysis(fromDate, toDate);

    return res.status(200).json({
      success: true,
      data: analysis,
      meta: {
        generatedAt: new Date(),
        parameters: {
          dateFrom: fromDate,
          dateTo: toDate
        }
      }
    });

  } catch (error: any) {
    console.error('[CorrelationController] Ошибка комплексного анализа:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при выполнении комплексного корреляционного анализа',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить статистику корреляционного анализа
 * GET /api/correlations/stats
 */
export const getCorrelationStats = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Не авторизован' 
      });
    }

    // Быстрый анализ для получения общей статистики
    const [moodCorrelations, patterns] = await Promise.all([
      analyzeReportMoodCorrelations(),
      analyzeTeamPerformancePatterns(3) // Последние 3 месяца для быстрой статистики
    ]);

    const stats = {
      totalReportsAnalyzed: moodCorrelations.length,
      avgMoodImpact: moodCorrelations.length > 0 
        ? moodCorrelations.reduce((sum, corr) => sum + corr.correlations.beforeAfter.change, 0) / moodCorrelations.length
        : 0,
      positiveImpactReports: moodCorrelations.filter(corr => corr.correlations.beforeAfter.change > 0).length,
      negativeImpactReports: moodCorrelations.filter(corr => corr.correlations.beforeAfter.change < 0).length,
      highCorrelations: moodCorrelations.filter(corr => 
        corr.correlations.timeWindow.correlation.significance === 'high'
      ).length,
      currentTrend: patterns.length > 0 ? patterns[patterns.length - 1]?.moodTrend : 'stable',
      lastAnalysisDate: new Date()
    };

    return res.status(200).json({
      success: true,
      data: stats,
      meta: {
        generatedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('[CorrelationController] Ошибка получения статистики корреляций:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики корреляций',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Сгенерировать AI-вывод по данным корреляционного анализа
 * POST /api/correlations/ai-assistant
 */
export const getCorrelationAssistantInsight = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
    }

    const payload = req.body as CorrelationAssistantPayload;

    if (!payload || !Array.isArray(payload.metricSummaries) || payload.metricSummaries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Недостаточно данных для AI-анализа'
      });
    }

    const fromDate = payload.dateFrom ? new Date(`${payload.dateFrom}T00:00:00.000Z`) : undefined;
    const toDate = payload.dateTo ? new Date(`${payload.dateTo}T23:59:59.999Z`) : undefined;

    const comprehensive = await getComprehensiveCorrelationAnalysis(fromDate, toDate);
    const insight = await generateCorrelationAssistantInsight({
      payload,
      comprehensive: {
        totalReportsAnalyzed: comprehensive.insights.totalReportsAnalyzed,
        averageMoodImpact: comprehensive.insights.averageMoodImpact,
        mostEffectiveReportType: comprehensive.insights.mostEffectiveReportType,
        overallTrend: comprehensive.insights.overallTrend,
        recentPatterns: comprehensive.performancePatterns.slice(-3).map((pattern) => ({
          period: pattern.period,
          moodTrend: pattern.moodTrend,
          reportsCount: pattern.reportsCount,
          avgMoodAfterReports: pattern.avgMoodAfterReports
        }))
      }
    });

    return res.status(200).json({
      success: true,
      data: insight,
      meta: {
        generatedAt: new Date(),
        totalRows: payload.totalRows,
        metricsAnalyzed: payload.metricSummaries.length
      }
    });
  } catch (error: any) {
    console.error('[CorrelationController] Ошибка AI-анализа корреляций:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при генерации AI-анализа',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получить мультиметричные данные для корреляционного анализа
 */
export const getMultiMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, playerId, mode = 'team' } = req.query;
    const analysisMode = mode === 'individual' ? 'individual' : 'team';
    const fromDateValue = typeof dateFrom === 'string'
      ? new Date(`${dateFrom}T00:00:00.000Z`)
      : undefined;
    const toDateValue = typeof dateTo === 'string'
      ? new Date(`${dateTo}T23:59:59.999Z`)
      : undefined;

    console.log(`[CORRELATION] Запрос мультиметричных данных: ${analysisMode} режим, период: ${dateFrom} - ${dateTo}, игрок: ${playerId || 'все'}`);
    
    // Базовый фильтр по датам для дневных метрик
    const dateFilter: any = {};
    // Базовый фильтр по датам для матчей (ELO)
    const matchDateFilter: any = {};
    if (dateFrom || dateTo) {
      const dateRange: any = {};
      if (dateFrom) {
        dateRange.$gte = fromDateValue;
      }
      if (dateTo) {
        dateRange.$lte = toDateValue;
      }
      dateFilter.date = dateRange;
      matchDateFilter.playedAt = dateRange;
    }
    
    // Фильтр по пользователю
    const userFilter: any = {};
    const matchFilter: any = { ...matchDateFilter };
    if (analysisMode === 'individual' && playerId) {
      userFilter.userId = playerId;

      const player = await User.findById(playerId).select('faceitAccountId').lean();
      if (player?.faceitAccountId) {
        matchFilter.faceitAccountId = player.faceitAccountId;
      } else {
        matchFilter.faceitAccountId = { $in: [] };
      }
    } else if (analysisMode === 'team') {
      // Для командного режима учитываем только игроков, исключая staff.
      const players = await User.find({ role: 'player' }).select('_id faceitAccountId').lean();
      const playerIds = players.map((player: any) => player._id);

      if (!playerIds.length) {
        return res.json({
          success: true,
          data: [],
          meta: {
            mode: analysisMode,
            playerId,
            dateFrom,
            dateTo,
            totalDays: 0,
            generatedAt: new Date().toISOString()
          }
        });
      }

      userFilter.userId = { $in: playerIds };

      const faceitAccountIds = players
        .map((player: any) => player.faceitAccountId)
        .filter((id: any) => Boolean(id));

      if (faceitAccountIds.length) {
        matchFilter.faceitAccountId = { $in: faceitAccountIds };
      } else {
        matchFilter.faceitAccountId = { $in: [] };
      }
    }
    
    // Объединяем фильтры
    const filter = { ...dateFilter, ...userFilter };
    
    console.log(`[CORRELATION] Фильтр запроса:`, filter);
    console.log(`[CORRELATION] Фильтр матчей (ELO):`, matchFilter);

    const getCurrentFaceitElo = async (faceitIds: string[]): Promise<number | null> => {
      if (!faceitIds.length) return null;

      try {
        const profiles = await Promise.all(
          faceitIds.map(async (faceitId: string) => {
            try {
              return await resolveFaceitProfile(faceitId);
            } catch (error) {
              console.warn('[CORRELATION] Не удалось получить live ELO Faceit:', faceitId, error);
              return null;
            }
          })
        );

        const eloValues = profiles
          .map((profile) => profile?.elo)
          .filter((elo): elo is number => Number.isFinite(elo));

        if (!eloValues.length) return null;

        if (analysisMode === 'individual') {
          return Math.round(eloValues[0]);
        }

        const avg = eloValues.reduce((sum, value) => sum + value, 0) / eloValues.length;
        return Math.round(avg);
      } catch (error) {
        console.warn('[CORRELATION] Ошибка получения live ELO Faceit:', error);
        return null;
      }
    };
    
    // Получаем данные из всех коллекций параллельно
    const [moodData, sleepData, balanceData, screenTimeData, gameStatsData, matchData, brainAttempts] = await Promise.all([
      MoodEntry.find(filter).sort({ date: 1 }).lean(),
      SleepEntry.find(filter).sort({ date: 1 }).lean(),
      BalanceWheel.find(filter).sort({ date: 1 }).lean(),
      ScreenTime.find(filter).sort({ date: 1 }).lean(),
      GameStats.find(filter).sort({ date: 1 }).lean(),
      Match.find(matchFilter).sort({ playedAt: 1 }).lean(),
      BrainTestAttempt.find({
        ...userFilter,
        status: 'completed',
        validityStatus: 'valid',
        ...(dateFilter.date ? { completedAt: dateFilter.date } : {})
      })
        .sort({ completedAt: 1 })
        .lean()
    ]);
    
    console.log(`[CORRELATION] Найдено данных: настроение=${moodData.length}, сон=${sleepData.length}, баланс=${balanceData.length}, экранное время=${screenTimeData.length}, игровые показатели=${gameStatsData.length}, матчи(ELO)=${matchData.length}`);
    
    // Группируем данные по датам
    const dataByDate = new Map();
    
    // Обрабатываем данные настроения
    moodData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      dayData.mood = (dayData.mood || 0) + entry.mood;
      dayData.energy = (dayData.energy || 0) + entry.energy;
      dayData.moodCount = (dayData.moodCount || 0) + 1;
    });
    
    // Обрабатываем данные сна
    sleepData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      dayData.sleepHours = (dayData.sleepHours || 0) + entry.hours;
      dayData.sleepCount = (dayData.sleepCount || 0) + 1;
    });

    // Обрабатываем данные баланса
    balanceData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      const avgBalance = (entry.physical + entry.emotional + entry.intellectual + entry.spiritual + entry.occupational + entry.social + entry.environmental + entry.financial) / 8;
      dayData.balanceAvg = (dayData.balanceAvg || 0) + avgBalance;
      dayData.balanceCount = (dayData.balanceCount || 0) + 1;
    });
    
    // Обрабатываем данные экранного времени
    screenTimeData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      dayData.screenTime = (dayData.screenTime || 0) + entry.totalTime;
      dayData.screenTimeCount = (dayData.screenTimeCount || 0) + 1;
    });
    
    // Обрабатываем игровые показатели
    gameStatsData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      dayData.winRate = (dayData.winRate || 0) + entry.winRate;
      dayData.kdRatio = (dayData.kdRatio || 0) + entry.kdRatio;
      dayData.kills = (dayData.kills || 0) + (entry.kills ?? 0);
      dayData.deaths = (dayData.deaths || 0) + (entry.deaths ?? 0);
      dayData.assists = (dayData.assists || 0) + (entry.assists ?? 0);
      if (Number.isFinite(entry.adr) && entry.adr !== null) {
        dayData.adr = (dayData.adr || 0) + entry.adr;
        dayData.adrCount = (dayData.adrCount || 0) + 1;
      }
      if (Number.isFinite(entry.kast) && entry.kast !== null) {
        dayData.kast = (dayData.kast || 0) + entry.kast;
        dayData.kastCount = (dayData.kastCount || 0) + 1;
      }
      dayData.gameStatsCount = (dayData.gameStatsCount || 0) + 1;
    });

    // Обрабатываем ELO по матчам (используем eloAfter как актуальный рейтинг после матча)
    matchData.forEach((entry: any) => {
      const dateKey = entry.playedAt.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      // FACEIT Open Data history API не возвращает elo_before/elo_after, поэтому
      // значения по умолчанию равны 0. Учитываем ELO только если оно реально положительное.
      const eloValue = Number.isFinite(entry.eloAfter) && entry.eloAfter > 0
        ? entry.eloAfter
        : (Number.isFinite(entry.eloBefore) && entry.eloBefore > 0 ? entry.eloBefore : null);
      if (eloValue !== null) {
        dayData.elo = (dayData.elo || 0) + eloValue;
        dayData.eloCount = (dayData.eloCount || 0) + 1;
      }

      dayData.faceitMatchCountFallback = (dayData.faceitMatchCountFallback || 0) + 1;
      if (entry.result === 'win') {
        dayData.faceitWinCountFallback = (dayData.faceitWinCountFallback || 0) + 1;
      }
    });

    const brainAttemptsBySession = new Map<string, any[]>();

    brainAttempts.forEach((attempt: any) => {
      if (!attempt.batterySessionId) return;
      const sessionKey = `${String(attempt.userId)}:${attempt.batterySessionId}`;
      const sessionAttempts = brainAttemptsBySession.get(sessionKey) || [];
      sessionAttempts.push(attempt);
      brainAttemptsBySession.set(sessionKey, sessionAttempts);
    });

    brainAttemptsBySession.forEach((sessionAttempts) => {
      const testsInSession = new Set(sessionAttempts.map((attempt) => attempt.testKey));
      const isCompleteBattery = BRAIN_TEST_KEYS.every((testKey) => testsInSession.has(testKey));
      if (!isCompleteBattery) return;

      const brainPerformanceIndex = computeBatteryIndex(sessionAttempts);
      if (!Number.isFinite(brainPerformanceIndex)) return;

      const completedAtValues = sessionAttempts
        .map((attempt) => (attempt.completedAt ? new Date(attempt.completedAt) : null))
        .filter((value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()));

      if (!completedAtValues.length) return;

      const latestCompletedAt = new Date(Math.max(...completedAtValues.map((value) => value.getTime())));
      const dateKey = latestCompletedAt.toISOString().split('T')[0];

      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }

      const dayData = dataByDate.get(dateKey);
      dayData.brainPerformanceIndex = (dayData.brainPerformanceIndex || 0) + brainPerformanceIndex;
      dayData.brainPerformanceIndexCount = (dayData.brainPerformanceIndexCount || 0) + 1;
      dayData.brainBatteryCount = (dayData.brainBatteryCount || 0) + 1;
    });

    // Текущий ELO: для individual — последний матч, для team — среднее по последнему матчу каждого игрока
    let currentElo: number | null = null;
    const requestedFaceitAccountIds =
      analysisMode === 'individual'
        ? (matchFilter.faceitAccountId && !matchFilter.faceitAccountId?.$in
          ? [String(matchFilter.faceitAccountId)]
          : [])
        : Array.isArray(matchFilter.faceitAccountId?.$in)
          ? matchFilter.faceitAccountId.$in.map((id: any) => String(id))
          : [];

    const requestedAccounts = requestedFaceitAccountIds.length
      ? await FaceitAccount.find({ _id: { $in: requestedFaceitAccountIds } })
        .select('faceitId')
        .lean()
      : [];
    const requestedFaceitIds = requestedAccounts
      .map((account: any) => account.faceitId)
      .filter((faceitId: any): faceitId is string => typeof faceitId === 'string' && faceitId.trim().length > 0);

    currentElo = await getCurrentFaceitElo(requestedFaceitIds);

    let faceitMetricsStatus: 'ok' | 'partial' | 'unavailable' = 'unavailable';
    if (requestedFaceitIds.length > 0) {
      const faceitDailyStatsResults = await Promise.all(
        requestedFaceitIds.map(async (faceitId) => {
          try {
            return await getPlayerDailyStats(faceitId, fromDateValue, toDateValue);
          } catch (error) {
            console.warn('[CORRELATION] Не удалось получить дневные FACEIT метрики:', faceitId, error);
            return null;
          }
        })
      );

      const successfulResponses = faceitDailyStatsResults.filter((value): value is Awaited<ReturnType<typeof getPlayerDailyStats>> => Array.isArray(value));
      if (successfulResponses.length > 0) {
        faceitMetricsStatus = successfulResponses.length === requestedFaceitIds.length ? 'ok' : 'partial';
      }

      successfulResponses.forEach((playerDays) => {
        playerDays.forEach((entry) => {
          const dateKey = entry.date;
          if (!dataByDate.has(dateKey)) {
            dataByDate.set(dateKey, { date: dateKey, count: 0 });
          }

          const dayData = dataByDate.get(dateKey);
          const weight = entry.matches > 0 ? entry.matches : 1;
          const addWeightedMetric = (metricKey: string, value: number | null) => {
            if (!Number.isFinite(value)) return;
            dayData[`${metricKey}WeightedSum`] = (dayData[`${metricKey}WeightedSum`] || 0) + (value as number) * weight;
            dayData[`${metricKey}Weight`] = (dayData[`${metricKey}Weight`] || 0) + weight;
          };

          dayData.faceitMatches = (dayData.faceitMatches || 0) + entry.matches;

          if (Number.isFinite(entry.elo)) {
            dayData.faceitLatestElo = entry.elo;
          }
          if (Number.isFinite(entry.eloChange)) {
            dayData.faceitEloChange = (dayData.faceitEloChange || 0) + entry.eloChange;
          }

          if (Number.isFinite(entry.kills)) {
            dayData.faceitKills = (dayData.faceitKills || 0) + entry.kills;
          }
          if (Number.isFinite(entry.deaths)) {
            dayData.faceitDeaths = (dayData.faceitDeaths || 0) + entry.deaths;
          }
          if (Number.isFinite(entry.assists)) {
            dayData.faceitAssists = (dayData.faceitAssists || 0) + entry.assists;
          }

          addWeightedMetric('faceitKdRatio', entry.kdRatio);
          addWeightedMetric('faceitAdr', entry.adr);
          addWeightedMetric('faceitKast', entry.kast);
          addWeightedMetric('faceitKr', entry.kr);
          addWeightedMetric('faceitHsPercent', entry.hsPercent);
          addWeightedMetric('faceitWinRate', entry.winRate);
        });
      });
    }

    if (matchData.length > 0) {
      if (currentElo === null) {
        if (analysisMode === 'individual') {
          const lastMatch = matchData[matchData.length - 1];
          const eloValue = (Number.isFinite(lastMatch.eloAfter) && lastMatch.eloAfter > 0)
            ? lastMatch.eloAfter
            : (Number.isFinite(lastMatch.eloBefore) && lastMatch.eloBefore > 0 ? lastMatch.eloBefore : null);
          currentElo = eloValue !== null ? Math.round(eloValue) : null;
        } else {
          const latestByAccount = new Map<string, { playedAt: Date; elo: number }>();
          matchData.forEach((entry: any) => {
            const accountId = entry.faceitAccountId?.toString?.() || String(entry.faceitAccountId);
            const eloValue = (Number.isFinite(entry.eloAfter) && entry.eloAfter > 0)
              ? entry.eloAfter
              : (Number.isFinite(entry.eloBefore) && entry.eloBefore > 0 ? entry.eloBefore : null);
            if (eloValue === null) return;
            const prev = latestByAccount.get(accountId);
            if (!prev || entry.playedAt > prev.playedAt) {
              latestByAccount.set(accountId, { playedAt: entry.playedAt, elo: eloValue });
            }
          });
          const eloValues = Array.from(latestByAccount.values()).map((item) => item.elo);
          if (eloValues.length > 0) {
            const avg = eloValues.reduce((sum, v) => sum + v, 0) / eloValues.length;
            currentElo = Math.round(avg);
          }
        }
      }
    }
    
    // Преобразуем в массив и усредняем значения
    const result = Array.from(dataByDate.values()).map((dayData: any) => ({
      date: dayData.date,
      mood: dayData.moodCount ? Number((dayData.mood / dayData.moodCount).toFixed(1)) : null,
      energy: dayData.moodCount ? Number((dayData.energy / dayData.moodCount).toFixed(1)) : null,
      sleepHours: dayData.sleepCount ? Number((dayData.sleepHours / dayData.sleepCount).toFixed(1)) : null,
      balanceAvg: dayData.balanceCount ? Number((dayData.balanceAvg / dayData.balanceCount).toFixed(1)) : null,
      screenTime: dayData.screenTimeCount ? Number((dayData.screenTime / dayData.screenTimeCount).toFixed(1)) : null,
      winRate: dayData.gameStatsCount ? Number((dayData.winRate / dayData.gameStatsCount).toFixed(1)) : null,
      kdRatio: dayData.gameStatsCount ? Number((dayData.kdRatio / dayData.gameStatsCount).toFixed(2)) : null,
      kills: dayData.gameStatsCount ? Number((dayData.kills / dayData.gameStatsCount).toFixed(1)) : null,
      deaths: dayData.gameStatsCount ? Number((dayData.deaths / dayData.gameStatsCount).toFixed(1)) : null,
      assists: dayData.gameStatsCount ? Number((dayData.assists / dayData.gameStatsCount).toFixed(1)) : null,
      adr: dayData.adrCount ? Number((dayData.adr / dayData.adrCount).toFixed(1)) : null,
      kast: dayData.kastCount ? Number((dayData.kast / dayData.kastCount).toFixed(1)) : null,
      elo: dayData.eloCount
        ? Number((dayData.elo / dayData.eloCount).toFixed(0))
        : (Number.isFinite(dayData.faceitLatestElo) ? Number(dayData.faceitLatestElo.toFixed(0)) : null),
      brainPerformanceIndex: dayData.brainPerformanceIndexCount
        ? Number((dayData.brainPerformanceIndex / dayData.brainPerformanceIndexCount).toFixed(1))
        : null,
      brainBatteryCount: dayData.brainBatteryCount ? Number(dayData.brainBatteryCount) : null,
      faceitMatches: dayData.faceitMatches
        ? Number(dayData.faceitMatches)
        : (dayData.faceitMatchCountFallback ? Number(dayData.faceitMatchCountFallback) : null),
      faceitWinRate: dayData.faceitWinRateWeight
        ? Number((dayData.faceitWinRateWeightedSum / dayData.faceitWinRateWeight).toFixed(1))
        : (dayData.faceitMatchCountFallback
          ? Number(((dayData.faceitWinCountFallback || 0) / dayData.faceitMatchCountFallback * 100).toFixed(1))
          : null),
      faceitKdRatio: dayData.faceitKdRatioWeight ? Number((dayData.faceitKdRatioWeightedSum / dayData.faceitKdRatioWeight).toFixed(2)) : null,
      faceitAdr: dayData.faceitAdrWeight ? Number((dayData.faceitAdrWeightedSum / dayData.faceitAdrWeight).toFixed(1)) : null,
      faceitKast: dayData.faceitKastWeight ? Number((dayData.faceitKastWeightedSum / dayData.faceitKastWeight).toFixed(1)) : null,
      faceitKr: dayData.faceitKrWeight ? Number((dayData.faceitKrWeightedSum / dayData.faceitKrWeight).toFixed(2)) : null,
      faceitHsPercent: dayData.faceitHsPercentWeight ? Number((dayData.faceitHsPercentWeightedSum / dayData.faceitHsPercentWeight).toFixed(1)) : null,
      faceitKills: Number.isFinite(dayData.faceitKills) ? Number(dayData.faceitKills.toFixed(1)) : null,
      faceitDeaths: Number.isFinite(dayData.faceitDeaths) ? Number(dayData.faceitDeaths.toFixed(1)) : null,
      faceitAssists: Number.isFinite(dayData.faceitAssists) ? Number(dayData.faceitAssists.toFixed(1)) : null,
      faceitEloChange: Number.isFinite(dayData.faceitEloChange) ? Number(dayData.faceitEloChange.toFixed(0)) : null
    })).sort((a, b) => a.date.localeCompare(b.date));

    let previousElo: number | null = null;
    result.forEach((day: any) => {
      if (typeof day.elo === 'number' && Number.isFinite(day.elo)) {
        day.eloChange = previousElo === null
          ? (Number.isFinite(day.faceitEloChange) ? Number(day.faceitEloChange.toFixed(0)) : null)
          : Number((day.elo - previousElo).toFixed(0));
        previousElo = day.elo;
      } else {
        day.eloChange = Number.isFinite(day.faceitEloChange) ? Number(day.faceitEloChange.toFixed(0)) : null;
      }
      delete day.faceitEloChange;
    });
    
    return res.json({
      success: true,
      data: result,
      meta: {
        mode: analysisMode,
        playerId,
        dateFrom,
        dateTo,
        totalDays: result.length,
        generatedAt: new Date().toISOString(),
        currentElo,
        faceitMetricsStatus
      }
    });
    
  } catch (error) {
    console.error('[CORRELATION] Ошибка получения мультиметричных данных:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных корреляций',
      error: error.message
    });
  }
}; 
