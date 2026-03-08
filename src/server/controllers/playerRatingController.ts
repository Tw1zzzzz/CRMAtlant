import { Request, Response } from 'express';
import PlayerRating from '../models/PlayerRating';
import User from '../models/User';
import mongoose from 'mongoose';

// Получение списка игроков с рейтингом
export const getTopPlayers = async (req: Request, res: Response) => {
  try {
    const period = req.query.period || 'all';
    const limit = parseInt(req.query.limit as string) || 10;
    
    console.log(`Fetching top players for period: ${period}, limit: ${limit}`);

    // ????? ?????? ???????, ????????? ? ????????
    const teamPlayers = await User.find({ role: 'player', playerType: 'team' })
      .select('_id')
      .lean();
    const teamPlayerIds = teamPlayers.map(player => player._id);
    if (!teamPlayerIds.length) {
      return res.json({
        players: [],
        stats: {
          totalPlayers: 0,
          activePlayers: 0,
          averageRating: 0,
          monthlyTournaments: 6
        }
      });
    }

    
    // Получаем рейтинги игроков с информацией о пользователе
    let players = await PlayerRating.find({ userId: { $in: teamPlayerIds } })
      .populate('userId', 'name avatar playerType role')
      .sort({ rating: -1 })
      .limit(limit);
    
    // Фильтруем записи, где userId не был найден (пользователь удален)
    players = players.filter(player => player.userId && (player.userId as any)?._id && (player.userId as any)?.playerType === 'team');
      
    const formattedPlayers = players.map((player, index) => ({
      rank: index + 1,
      id: player.userId?._id || player.userId,
      name: (player.userId as any)?.name || 'Unknown',
      avatar: (player.userId as any)?.avatar || '',
      rating: player.rating,
      gamePoints: player.gamePoints,
      nonGamePoints: player.nonGamePoints,
      discipline: player.discipline
    }));
    
    console.log(`Returning ${formattedPlayers.length} top players`);
    
    return res.json({
      players: formattedPlayers,
      stats: {
        totalPlayers: await PlayerRating.countDocuments({ userId: { $in: teamPlayerIds } }),
        activePlayers: await PlayerRating.countDocuments({ userId: { $in: teamPlayerIds }, updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
        averageRating: (await PlayerRating.aggregate([{ $match: { userId: { $in: teamPlayerIds } } }, { $group: { _id: null, avg: { $avg: "$rating" } } }]))[0]?.avg?.toFixed(0) || 0,
        monthlyTournaments: 6 // TODO: Replace with actual count from tournament data
      }
    });
  } catch (error) {
    console.error('Error getting top players:', error);
    return res.status(500).json({ 
      message: 'Ошибка при получении рейтинга игроков',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Обновление рейтинга игрока для персонала
export const updatePlayerRating = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, pointType, operation } = req.body;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Некорректный ID игрока' });
    }
    
    if (!points || isNaN(parseInt(points)) || parseInt(points) <= 0) {
      return res.status(400).json({ message: 'Количество очков должно быть положительным числом' });
    }
    
    if (!['gamePoints', 'nonGamePoints', 'discipline'].includes(pointType)) {
      return res.status(400).json({ message: 'Некорректный тип очков' });
    }
    
    if (!['add', 'subtract'].includes(operation)) {
      return res.status(400).json({ message: 'Некорректная операция' });
    }
    
    console.log(`${operation === 'add' ? 'Adding' : 'Subtracting'} ${points} ${pointType} for player ${userId}`);
    
    // Проверяем, существует ли пользователь
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Игрок не найден' });
    }
    
    // Находим или создаем запись рейтинга игрока
        if (user.role !== 'player' || user.playerType !== 'team') {
      return res.status(400).json({ message: '??????? ???????? ?????? ??? ??????? ? ????????' });
    }

let playerRating = await PlayerRating.findOne({ userId });
    
    if (!playerRating) {
      playerRating = new PlayerRating({ userId });
    }
    
    // Обновляем соответствующее поле
    const pointsNum = parseInt(points);
    const modifier = operation === 'add' ? 1 : -1;
    playerRating[pointType] += pointsNum * modifier;
    
    // Обновляем общий рейтинг
    playerRating.rating = playerRating.gamePoints + playerRating.nonGamePoints;
    
    // Обеспечиваем, что дисциплина остается в пределах 0-100
    if (pointType === 'discipline') {
      playerRating.discipline = Math.max(0, Math.min(100, playerRating.discipline));
    }
    
    // Обновляем дату обновления
    playerRating.updatedAt = new Date();
    
    await playerRating.save();
    
    return res.json({
      message: 'Рейтинг игрока успешно обновлен',
      playerRating
    });
  } catch (error) {
    console.error('Error updating player rating:', error);
    return res.status(500).json({ 
      message: 'Ошибка при обновлении рейтинга игрока',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 