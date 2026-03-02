import { Request, Response } from 'express';
import GameStats from '../models/GameStats';
import User from '../models/User';
import { AuthRequest } from '../types';

/**
 * Создание новой записи игровых показателей
 */
export const createGameStats = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      date,
      userId,
      // K/D статистика
      kills = 0,
      deaths = 0,
      assists = 0,
      // CT Side статистика
      ctSide = {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalRounds: 0,
        roundsWon: 0,
        roundsLost: 0,
        pistolRounds: 0,
        pistolRoundsWon: 0
      },
      // T Side статистика
      tSide = {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalRounds: 0,
        roundsWon: 0,
        roundsLost: 0,
        pistolRounds: 0,
        pistolRoundsWon: 0
      },
      // Расширенные аналитические метрики
      adr = null,
      kpr = null,
      deathPerRound = null,
      avgKr = null,
      avgKd = null,
      kast = null,
      firstKills = null,
      firstDeaths = null,
      openingDuelDiff = null,
      udr = null,
      avgMultikills = null,
      clutchesWon = null,
      avgFlashTime = null
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    if (!date) {
      return res.status(400).json({ message: 'Дата обязательна' });
    }

    // Определяем для какого пользователя создаем статистику
    let targetUserId = req.user.id;
    
    // Если пользователь - staff и передан userId, используем его
    if (req.user.role === 'staff' && userId) {
      targetUserId = userId;
      
      // Проверяем, что целевой пользователь существует
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Указанный пользователь не найден' });
      }
    }

    const advancedMetrics = {
      adr,
      kpr,
      deathPerRound,
      avgKr,
      avgKd,
      kast,
      firstKills,
      firstDeaths,
      openingDuelDiff,
      udr,
      avgMultikills,
      clutchesWon,
      avgFlashTime
    };

    // Проверка существования записи на эту дату для целевого пользователя
    const existingStats = await GameStats.findOne({
      userId: targetUserId,
      date: new Date(date)
    });

    if (existingStats) {
      Object.assign(existingStats, {
        kills,
        deaths,
        assists,
        ctSide,
        tSide,
        ...advancedMetrics
      });
      await existingStats.save();
      await existingStats.populate('userId', 'name email role');

      return res.status(200).json({
        message: 'Игровые показатели за дату обновлены',
        data: existingStats
      });
    }

    // Валидация CT Side данных
    if (ctSide.wins + ctSide.losses + ctSide.draws !== ctSide.totalMatches) {
      return res.status(400).json({ 
        message: 'CT Side: Сумма побед, поражений и ничьих должна равняться общему количеству матчей' 
      });
    }

    if (ctSide.roundsWon + ctSide.roundsLost !== ctSide.totalRounds) {
      return res.status(400).json({ 
        message: 'CT Side: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов' 
      });
    }

    if (ctSide.pistolRoundsWon > ctSide.pistolRounds) {
      return res.status(400).json({ 
        message: 'CT Side: Количество выигранных пистолетных раундов не может превышать общее количество пистолетных раундов' 
      });
    }

    // Валидация T Side данных
    if (tSide.wins + tSide.losses + tSide.draws !== tSide.totalMatches) {
      return res.status(400).json({ 
        message: 'T Side: Сумма побед, поражений и ничьих должна равняться общему количеству матчей' 
      });
    }

    if (tSide.roundsWon + tSide.roundsLost !== tSide.totalRounds) {
      return res.status(400).json({ 
        message: 'T Side: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов' 
      });
    }

    if (tSide.pistolRoundsWon > tSide.pistolRounds) {
      return res.status(400).json({ 
        message: 'T Side: Количество выигранных пистолетных раундов не может превышать общее количество пистолетных раундов' 
      });
    }

    // Создание новой записи
    const gameStats = new GameStats({
      userId: targetUserId,
      date: new Date(date),
      kills,
      deaths,
      assists,
      ctSide,
      tSide,
      ...advancedMetrics
    });

    await gameStats.save();

    // Популируем данные пользователя для ответа
    await gameStats.populate('userId', 'name email');

    res.status(201).json({
      message: 'Игровые показатели успешно созданы',
      data: gameStats
    });
  } catch (error) {
    console.error('Ошибка при создании игровых показателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Получение игровых показателей пользователя
 */
export const getGameStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const { startDate, endDate, limit = 30, page = 1, mode = 'individual', playerId } = req.query;
    const effectiveMode = mode === 'team' ? 'team' : 'individual';
    const query: any = {};

    if (req.user.role === 'staff') {
      if (effectiveMode === 'team') {
        const players = await User.find({ role: 'player' }).select('_id').lean();
        const playerIds = players.map((player: any) => player._id);

        if (!playerIds.length) {
          return res.json({
            data: [],
            pagination: {
              total: 0,
              page: Number(page),
              limit: Number(limit),
              totalPages: 0
            },
            meta: {
              mode: effectiveMode,
              playerId: null
            }
          });
        }

        query.userId = { $in: playerIds };
      } else if (playerId) {
        query.userId = playerId;
      } else {
        query.userId = req.user.id;
      }
    } else {
      query.userId = req.user.id;
    }

    // Фильтр по датам
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(`${startDate as string}T00:00:00.000Z`);
      if (endDate) query.date.$lte = new Date(`${endDate as string}T23:59:59.999Z`);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const gameStats = await GameStats.find(query)
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip(skip)
      .populate('userId', 'name email role');

    const total = await GameStats.countDocuments(query);

    res.json({
      data: gameStats,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      },
      meta: {
        mode: req.user.role === 'staff' ? effectiveMode : 'individual',
        playerId: req.user.role === 'staff' ? (playerId || null) : req.user.id
      }
    });
  } catch (error) {
    console.error('Ошибка при получении игровых показателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Обновление игровых показателей
 */
export const updateGameStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const gameStats =
      req.user.role === 'staff'
        ? await GameStats.findById(id)
        : await GameStats.findOne({ _id: id, userId: req.user.id });

    if (!gameStats) {
      return res.status(404).json({ message: 'Запись игровых показателей не найдена' });
    }

    // Валидация данных при обновлении
    if (updateData.ctSide) {
      const { ctSide } = updateData;
      if (ctSide.wins + ctSide.losses + ctSide.draws !== ctSide.totalMatches) {
        return res.status(400).json({ 
          message: 'CT Side: Сумма побед, поражений и ничьих должна равняться общему количеству матчей' 
        });
      }
      if (ctSide.roundsWon + ctSide.roundsLost !== ctSide.totalRounds) {
        return res.status(400).json({ 
          message: 'CT Side: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов' 
        });
      }
    }

    if (updateData.tSide) {
      const { tSide } = updateData;
      if (tSide.wins + tSide.losses + tSide.draws !== tSide.totalMatches) {
        return res.status(400).json({ 
          message: 'T Side: Сумма побед, поражений и ничьих должна равняться общему количеству матчей' 
        });
      }
      if (tSide.roundsWon + tSide.roundsLost !== tSide.totalRounds) {
        return res.status(400).json({ 
          message: 'T Side: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов' 
        });
      }
    }

    Object.assign(gameStats, updateData);
    await gameStats.save();

    res.json({
      message: 'Игровые показатели успешно обновлены',
      data: gameStats
    });
  } catch (error) {
    console.error('Ошибка при обновлении игровых показателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Удаление игровых показателей
 */
export const deleteGameStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const gameStats = await GameStats.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!gameStats) {
      return res.status(404).json({ message: 'Запись игровых показателей не найдена' });
    }

    res.json({ message: 'Игровые показатели успешно удалены' });
  } catch (error) {
    console.error('Ошибка при удалении игровых показателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Получение статистики игровых показателей
 */
export const getGameStatsAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    const { startDate, endDate } = req.query;

    let matchQuery: any = { userId: req.user.id };

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate as string);
      if (endDate) matchQuery.date.$lte = new Date(endDate as string);
    }

    const analytics = await GameStats.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          // Общая статистика
          totalEntries: { $sum: 1 },
          avgWinRate: { $avg: '$winRate' },
          avgKDRatio: { $avg: '$kdRatio' },
          totalKills: { $sum: '$kills' },
          totalDeaths: { $sum: '$deaths' },
          totalAssists: { $sum: '$assists' },
          
          // CT Side статистика
          ctTotalMatches: { $sum: '$ctSide.totalMatches' },
          ctWins: { $sum: '$ctSide.wins' },
          ctAvgWinRate: { $avg: '$ctSide.winRate' },
          ctTotalRounds: { $sum: '$ctSide.totalRounds' },
          ctRoundsWon: { $sum: '$ctSide.roundsWon' },
          ctAvgRoundWinRate: { $avg: '$ctSide.roundWinRate' },
          ctPistolRounds: { $sum: '$ctSide.pistolRounds' },
          ctPistolRoundsWon: { $sum: '$ctSide.pistolRoundsWon' },
          
          // T Side статистика
          tTotalMatches: { $sum: '$tSide.totalMatches' },
          tWins: { $sum: '$tSide.wins' },
          tAvgWinRate: { $avg: '$tSide.winRate' },
          tTotalRounds: { $sum: '$tSide.totalRounds' },
          tRoundsWon: { $sum: '$tSide.roundsWon' },
          tAvgRoundWinRate: { $avg: '$tSide.roundWinRate' },
          tPistolRounds: { $sum: '$tSide.pistolRounds' },
          tPistolRoundsWon: { $sum: '$tSide.pistolRoundsWon' },
          
          // Общие раунды
          totalRounds: { $sum: '$totalRounds' },
          totalRoundsWon: { $sum: '$roundsWon' },
          avgRoundWinRate: { $avg: '$roundWinRate' },
          
          // Пистолетные раунды
          totalPistolRounds: { $sum: '$totalPistolRounds' },
          totalPistolRoundsWon: { $sum: '$pistolRoundsWon' },
          avgPistolWinRate: { $avg: '$pistolWinRate' }
        }
      }
    ]);

    const result = analytics[0] || {
      totalEntries: 0,
      avgWinRate: 0,
      avgKDRatio: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      ctTotalMatches: 0,
      ctWins: 0,
      ctAvgWinRate: 0,
      tTotalMatches: 0,
      tWins: 0,
      tAvgWinRate: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Ошибка при получении аналитики игровых показателей:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Получение топ игроков по игровым показателям
 */
export const getTopPlayersByGameStats = async (req: Request, res: Response) => {
  try {
    const { metric = 'winRate', limit = 10, startDate, endDate } = req.query;

    let matchQuery: any = {};

    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = new Date(startDate as string);
      if (endDate) matchQuery.date.$lte = new Date(endDate as string);
    }

    // Определяем поле для сортировки в зависимости от метрики
    let sortField: string;
    let groupField: any;

    switch (metric) {
      case 'winRate':
        sortField = 'avgWinRate';
        groupField = { $avg: '$winRate' };
        break;
      case 'kdRatio':
        sortField = 'avgKDRatio';
        groupField = { $avg: '$kdRatio' };
        break;
      case 'ctWinRate':
        sortField = 'avgCTWinRate';
        groupField = { $avg: '$ctSide.winRate' };
        break;
      case 'tWinRate':
        sortField = 'avgTWinRate';
        groupField = { $avg: '$tSide.winRate' };
        break;
      case 'roundWinRate':
        sortField = 'avgRoundWinRate';
        groupField = { $avg: '$roundWinRate' };
        break;
      default:
        sortField = 'avgWinRate';
        groupField = { $avg: '$winRate' };
    }

    const topPlayers = await GameStats.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$userId',
          [sortField]: groupField,
          totalMatches: { $sum: '$totalMatches' },
          totalEntries: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          email: '$user.email',
          avatar: '$user.avatar',
          [sortField]: 1,
          totalMatches: 1,
          totalEntries: 1
        }
      },
      { $sort: { [sortField]: -1 } },
      { $limit: Number(limit) }
    ]);

    res.json(topPlayers);
  } catch (error) {
    console.error('Ошибка при получении топ игроков:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};
