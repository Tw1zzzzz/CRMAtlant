import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import {
  analyzeReportMoodCorrelations,
  analyzeTeamPerformancePatterns,
  analyzeBalanceWheelReportCorrelations,
  getComprehensiveCorrelationAnalysis
} from '../services/correlationAnalysisService';
import MoodEntry from '../models/MoodEntry';
import BalanceWheel from '../models/BalanceWheel';
import ScreenTime from '../models/ScreenTime';
import GameStats from '../models/GameStats';
import Match from '../models/Match';
import TestEntry from '../models/TestEntry';
import User from '../models/User';
import FaceitAccount from '../models/FaceitAccount';
import { resolveFaceitProfile } from '../services/faceitService';

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

    // Только персонал может просматривать корреляции
    if (req.user.role !== 'staff') {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав для просмотра корреляционного анализа' 
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

    if (req.user.role !== 'staff') {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав для просмотра паттернов производительности' 
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

    if (req.user.role !== 'staff') {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав для просмотра корреляций колеса баланса' 
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

    if (req.user.role !== 'staff') {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав для просмотра комплексного анализа' 
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

    if (req.user.role !== 'staff') {
      return res.status(403).json({ 
        success: false, 
        message: 'Недостаточно прав для просмотра статистики корреляций' 
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
 * Получить мультиметричные данные для корреляционного анализа
 */
export const getMultiMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, playerId, mode = 'team' } = req.query;
    const analysisMode = mode === 'individual' ? 'individual' : 'team';
    
    console.log(`[CORRELATION] Запрос мультиметричных данных: ${analysisMode} режим, период: ${dateFrom} - ${dateTo}, игрок: ${playerId || 'все'}`);
    
    // Базовый фильтр по датам для дневных метрик
    const dateFilter: any = {};
    // Базовый фильтр по датам для матчей (ELO)
    const matchDateFilter: any = {};
    if (dateFrom || dateTo) {
      const dateRange: any = {};
      if (dateFrom) {
        dateRange.$gte = new Date(`${dateFrom as string}T00:00:00.000Z`);
      }
      if (dateTo) {
        dateRange.$lte = new Date(`${dateTo as string}T23:59:59.999Z`);
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

    const getCurrentFaceitElo = async (faceitAccountIds: string[]): Promise<number | null> => {
      if (!faceitAccountIds.length) return null;

      try {
        const accounts = await FaceitAccount.find({ _id: { $in: faceitAccountIds } })
          .select('faceitId')
          .lean();

        if (!accounts.length) return null;

        const profiles = await Promise.all(
          accounts.map(async (account: any) => {
            try {
              return await resolveFaceitProfile(account.faceitId);
            } catch (error) {
              console.warn('[CORRELATION] Не удалось получить live ELO Faceit:', account.faceitId, error);
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
    const [moodData, balanceData, screenTimeData, gameStatsData, matchData, testData] = await Promise.all([
      MoodEntry.find(filter).sort({ date: 1 }).lean(),
      BalanceWheel.find(filter).sort({ date: 1 }).lean(),
      ScreenTime.find(filter).sort({ date: 1 }).lean(),
      GameStats.find(filter).sort({ date: 1 }).lean(),
      Match.find(matchFilter).sort({ playedAt: 1 }).lean(),
      TestEntry.find(filter).sort({ date: 1 }).lean()
    ]);
    
    console.log(`[CORRELATION] Найдено данных: настроение=${moodData.length}, баланс=${balanceData.length}, экранное время=${screenTimeData.length}, игровые показатели=${gameStatsData.length}, матчи(ELO)=${matchData.length}`);
    
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
      dayData.gameStatsCount = (dayData.gameStatsCount || 0) + 1;
    });

    // Обрабатываем ELO по матчам (используем eloAfter как актуальный рейтинг после матча)
    matchData.forEach((entry: any) => {
      const dateKey = entry.playedAt.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      const eloValue = Number.isFinite(entry.eloAfter) ? entry.eloAfter : entry.eloBefore;
      if (Number.isFinite(eloValue)) {
        dayData.elo = (dayData.elo || 0) + eloValue;
        dayData.eloCount = (dayData.eloCount || 0) + 1;
      }
    });

    // РћР±СЂР°Р±Р°С‚С‹РІР°РµРј РґР°РЅРЅС‹Рµ С‚РµСЃС‚РѕРІ
    testData.forEach((entry: any) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, { date: dateKey, count: 0 });
      }
      const dayData = dataByDate.get(dateKey);
      dayData.testsCount = (dayData.testsCount || 0) + 1;
      if (Number.isFinite(entry.scoreNormalized)) {
        dayData.testsScore = (dayData.testsScore || 0) + entry.scoreNormalized;
        dayData.testsScoreCount = (dayData.testsScoreCount || 0) + 1;
      }
    });

    // Текущий ELO: для individual — последний матч, для team — среднее по последнему матчу каждого игрока
    let currentElo: number | null = null;
    const requestedFaceitAccountIds =
      analysisMode === 'individual'
        ? (matchFilter.faceitAccountId ? [String(matchFilter.faceitAccountId)] : [])
        : Array.isArray(matchFilter.faceitAccountId?.$in)
          ? matchFilter.faceitAccountId.$in.map((id: any) => String(id))
          : [];

    currentElo = await getCurrentFaceitElo(requestedFaceitAccountIds);

    if (matchData.length > 0) {
      if (currentElo === null) {
        if (analysisMode === 'individual') {
          const lastMatch = matchData[matchData.length - 1];
          const eloValue = Number.isFinite(lastMatch.eloAfter) ? lastMatch.eloAfter : lastMatch.eloBefore;
          currentElo = Number.isFinite(eloValue) ? Math.round(eloValue) : null;
        } else {
          const latestByAccount = new Map<string, { playedAt: Date; elo: number }>();
          matchData.forEach((entry: any) => {
            const accountId = entry.faceitAccountId?.toString?.() || String(entry.faceitAccountId);
            const eloValue = Number.isFinite(entry.eloAfter) ? entry.eloAfter : entry.eloBefore;
            if (!Number.isFinite(eloValue)) return;
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
      balanceAvg: dayData.balanceCount ? Number((dayData.balanceAvg / dayData.balanceCount).toFixed(1)) : null,
      screenTime: dayData.screenTimeCount ? Number((dayData.screenTime / dayData.screenTimeCount).toFixed(1)) : null,
      winRate: dayData.gameStatsCount ? Number((dayData.winRate / dayData.gameStatsCount).toFixed(1)) : null,
      kdRatio: dayData.gameStatsCount ? Number((dayData.kdRatio / dayData.gameStatsCount).toFixed(2)) : null,
      elo: dayData.eloCount ? Number((dayData.elo / dayData.eloCount).toFixed(0)) : null,
      testsScore: dayData.testsScoreCount ? Number((dayData.testsScore / dayData.testsScoreCount).toFixed(1)) : null,
      testsCount: dayData.testsCount ? Number(dayData.testsCount) : null
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`[CORRELATION] Обработано ${result.length} дней данных`);
    
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
        currentElo
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
