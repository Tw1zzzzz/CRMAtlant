import mongoose from 'mongoose';
import User from '../models/User';
import Match from '../models/Match';
import PlayerMetrics from '../models/PlayerMetrics';
import AnalyticsCache from '../models/AnalyticsCache';

/**
 * Получает общую статистику для пользователя
 * @param userId - ID пользователя
 * @param fromDate - Начальная дата (опционально)
 * @param toDate - Конечная дата (опционально)
 * @param gameType - Тип игры (опционально)
 * @returns Объект с аналитическими данными
 */
export const getUserStats = async (
  userId: string, 
  fromDate?: Date, 
  toDate?: Date, 
  gameType?: string
): Promise<any> => {
  try {
    const normalizedGameType = gameType || 'all';

    // Проверяем наличие кэша для указанного периода
    if (fromDate && toDate) {
      const existingCache = await AnalyticsCache.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        periodStart: fromDate,
        periodEnd: toDate,
        gameType: normalizedGameType,
        updatedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Кэш не старше 1 дня
      });
      
      if (existingCache) {
        console.log('Найден актуальный кэш статистики');
        return existingCache;
      }
    }
    
    // Получаем пользователя и его аккаунт Faceit
    const user = await User.findById(userId);
    if (!user || !user.faceitAccountId) {
      throw new Error('Пользователь не найден или не имеет подключенного аккаунта Faceit');
    }
    
    // Создаем условие для поиска матчей
    const matchFilter: any = {
      faceitAccountId: user.faceitAccountId
    };
    
    // Добавляем фильтр по дате
    if (fromDate || toDate) {
      matchFilter.playedAt = {};
      if (fromDate) matchFilter.playedAt.$gte = fromDate;
      if (toDate) matchFilter.playedAt.$lte = toDate;
    }
    
    // Добавляем фильтр по типу игры
    if (gameType) {
      matchFilter.gameType = gameType;
    }
    
    // Агрегация данных матчей
    const matchAggregation = await Match.aggregate([
      { $match: matchFilter },
      { $sort: { playedAt: -1 } },
      { 
        $group: {
          _id: null,
          totalMatches: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] } },
          draws: { $sum: { $cond: [{ $eq: ['$result', 'draw'] }, 1, 0] } },
          avgEloBefore: { $avg: '$eloBefore' },
          avgEloAfter: { $avg: '$eloAfter' },
          totalEloGain: { $sum: { $subtract: ['$eloAfter', '$eloBefore'] } },
          // Собираем все матчи для дальнейшей обработки
          matches: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMatches: 1,
          wins: 1,
          losses: 1,
          draws: 1,
          winRate: { 
            $cond: [
              { $eq: ['$totalMatches', 0] },
              0,
              { $multiply: [{ $divide: ['$wins', '$totalMatches'] }, 100] }
            ] 
          },
          avgEloBefore: 1,
          avgEloAfter: 1,
          totalEloGain: 1,
          avgEloGain: { 
            $cond: [
              { $eq: ['$totalMatches', 0] },
              0,
              { $divide: ['$totalEloGain', '$totalMatches'] }
            ] 
          },
          matches: 1
        }
      }
    ]);
    
    // Если нет матчей, возвращаем пустые данные
    const matchStats = matchAggregation.length > 0 ? matchAggregation[0] : {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      avgEloBefore: 0,
      avgEloAfter: 0,
      totalEloGain: 0,
      avgEloGain: 0,
      matches: []
    };
    
    // Создаем данные для графиков
    const chartsData: any = {};
    
    // График динамики Elo
    if (matchStats.matches && matchStats.matches.length > 0) {
      chartsData.eloHistory = matchStats.matches
        .sort((a: any, b: any) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
        .map((match: any) => ({
          date: match.playedAt,
          elo: match.eloAfter || 0
        }));
      
      // График результатов матчей
      chartsData.matchResults = {
        labels: ['Победы', 'Поражения', 'Ничьи'],
        data: [matchStats.wins, matchStats.losses, matchStats.draws]
      };
    }
    
    // Получаем метрики настроения
    const metricsFilter: any = {
      userId: new mongoose.Types.ObjectId(userId)
    };
    
    if (fromDate || toDate) {
      metricsFilter.createdAt = {};
      if (fromDate) metricsFilter.createdAt.$gte = fromDate;
      if (toDate) metricsFilter.createdAt.$lte = toDate;
    }
    
    const metricsAggregation = await PlayerMetrics.aggregate([
      { $match: metricsFilter },
      { $sort: { createdAt: -1 } },
      { 
        $group: {
          _id: null,
          avgMood: { $avg: '$mood' },
          // Собираем все метрики для дальнейшей обработки
          metrics: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          avgMood: 1,
          metrics: 1
        }
      }
    ]);
    
    const metricsStats = metricsAggregation.length > 0 ? metricsAggregation[0] : {
      avgMood: 0,
      metrics: []
    };
    
    // График настроения
    if (metricsStats.metrics && metricsStats.metrics.length > 0) {
      chartsData.moodHistory = metricsStats.metrics
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((metric: any) => ({
          date: metric.createdAt,
          mood: metric.mood
        }));
      
      // Данные для радарного графика колеса баланса
      const latestBalanceWheel = metricsStats.metrics
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .find((metric: any) => metric.balanceWheel);
      
      if (latestBalanceWheel) {
        chartsData.balanceWheel = latestBalanceWheel.balanceWheel;
      }
    }
    
    // Формируем окончательный объект с аналитикой
    const stats = {
      totalMatches: matchStats.totalMatches,
      wins: matchStats.wins,
      losses: matchStats.losses,
      draws: matchStats.draws,
      winRate: matchStats.winRate,
      avgEloBefore: matchStats.avgEloBefore,
      avgEloAfter: matchStats.avgEloAfter,
      totalEloGain: matchStats.totalEloGain,
      avgEloGain: matchStats.avgEloGain,
      avgMood: metricsStats.avgMood,
    };
    
    // Создаем итоговый результат
    const result = {
      userId,
      periodStart: fromDate,
      periodEnd: toDate,
      stats,
      chartsData,
      recentMatches: matchStats.matches
        .slice(0, 10)
        .sort((a: any, b: any) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        .map((match: any) => ({
          id: match._id,
          matchId: match.matchId,
          gameType: match.gameType,
          map: match.map,
          result: match.result,
          eloBefore: match.eloBefore,
          eloAfter: match.eloAfter,
          eloChange: match.eloAfter - match.eloBefore,
          playedAt: match.playedAt
        }))
    };
    
    // Сохраняем результат в кэш (если указан период)
    if (fromDate && toDate) {
      await AnalyticsCache.findOneAndUpdate(
        {
          userId: new mongoose.Types.ObjectId(userId),
          periodStart: fromDate,
          periodEnd: toDate,
          gameType: normalizedGameType
        },
        {
          userId: new mongoose.Types.ObjectId(userId),
          periodStart: fromDate,
          periodEnd: toDate,
          gameType: normalizedGameType,
          stats,
          chartsData,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }
    
    return result;
  } catch (error) {
    console.error('Ошибка при получении статистики пользователя:', error);
    throw new Error('Не удалось получить статистику');
  }
};

/**
 * Сохраняет метрики пользователя
 * @param userId - ID пользователя
 * @param mood - Настроение (1-10)
 * @param balanceWheel - Объект колеса баланса
 * @param matchId - ID матча (опционально)
 * @returns Созданная запись метрик
 */
export const savePlayerMetrics = async (
  userId: string,
  mood: number,
  balanceWheel: any,
  matchId?: string
): Promise<any> => {
  try {
    const metricsData: any = {
      userId,
      mood,
      balanceWheel
    };
    
    if (matchId) {
      metricsData.matchId = matchId;
    }
    
    return await PlayerMetrics.create(metricsData);
  } catch (error) {
    console.error('Ошибка при сохранении метрик пользователя:', error);
    throw new Error('Не удалось сохранить метрики');
  }
};

/**
 * Получает метрики пользователя
 * @param userId - ID пользователя
 * @param limit - Лимит записей (по умолчанию 10)
 * @returns Список записей метрик
 */
export const getPlayerMetrics = async (userId: string, limit: number = 10): Promise<any> => {
  try {
    return await PlayerMetrics.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  } catch (error) {
    console.error('Ошибка при получении метрик пользователя:', error);
    throw new Error('Не удалось получить метрики');
  }
};

/**
 * Выполняет периодическое обновление кэша
 */
export const updateAnalyticsCache = async (): Promise<void> => {
  try {
    // Получаем всех пользователей с привязанными аккаунтами Faceit
    const users = await User.find({ faceitAccountId: { $ne: null } });
    
    // Для каждого пользователя обновляем кэш
    for (const user of users) {
      // Получаем метрики за последнюю неделю
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      await getUserStats(user._id.toString(), weekAgo, new Date());
      
      // Получаем метрики за последний месяц
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      await getUserStats(user._id.toString(), monthAgo, new Date());
    }
    
    console.log('Обновление кэша аналитики завершено');
  } catch (error) {
    console.error('Ошибка при обновлении кэша аналитики:', error);
  }
};

export default {
  getUserStats,
  savePlayerMetrics,
  getPlayerMetrics,
  updateAnalyticsCache
}; 
