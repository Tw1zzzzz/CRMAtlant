import { Request, Response } from 'express';
import ScreenTime from '../models/ScreenTime';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

/**
 * Получить экранное время для пользователя
 */
export const getScreenTime = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, dateFrom, dateTo } = req.query;
    const targetUserId = userId || req.user?.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'ID пользователя обязателен'
      });
    }

    // Проверяем права доступа
    if (req.user?.role !== 'staff' && req.user?.id !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для просмотра данных'
      });
    }

    const query: any = { userId: targetUserId };
    
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom as string);
      if (dateTo) query.date.$lte = new Date(dateTo as string);
    }

    const screenTimeData = await ScreenTime.find(query)
      .populate('userId', 'name email')
      .sort({ date: -1 })
      .limit(100);

    res.json({
      success: true,
      data: screenTimeData,
      meta: {
        count: screenTimeData.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Ошибка получения экранного времени:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении экранного времени'
    });
  }
};

/**
 * Создать или обновить запись экранного времени
 */
export const createOrUpdateScreenTime = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, date, totalTime, entertainment, communication, browser, study } = req.body;

    // Проверяем права доступа (только staff может вводить данные)
    if (req.user?.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Только персонал может вводить данные экранного времени'
      });
    }

    // Валидация данных
    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        message: 'ID пользователя и дата обязательны'
      });
    }

    // Проверяем существование пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    // Проверяем валидность времени
    const categoryTotal = (entertainment || 0) + (communication || 0) + (browser || 0) + (study || 0);
    const inputTotalTime = totalTime || 0;
    
    if (inputTotalTime > 24) {
      return res.status(400).json({
        success: false,
        message: 'Общее время не может превышать 24 часа'
      });
    }

    if (categoryTotal > inputTotalTime) {
      return res.status(400).json({
        success: false,
        message: 'Сумма категорий не может превышать общее время'
      });
    }

    // Создаем или обновляем запись
    const screenTimeData = await ScreenTime.findOneAndUpdate(
      { userId, date: new Date(date) },
      {
        userId,
        date: new Date(date),
        totalTime: inputTotalTime,
        entertainment: entertainment || 0,
        communication: communication || 0,
        browser: browser || 0,
        study: study || 0
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true
      }
    ).populate('userId', 'name email');

    res.json({
      success: true,
      data: screenTimeData,
      message: 'Данные экранного времени успешно сохранены'
    });
  } catch (error) {
    console.error('Ошибка сохранения экранного времени:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при сохранении экранного времени'
    });
  }
};

/**
 * Получить статистику экранного времени для всех игроков
 */
export const getScreenTimeStats = async (req: AuthRequest, res: Response) => {
  try {
    // Проверяем права доступа (только staff)
    if (req.user?.role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав для просмотра статистики'
      });
    }

    const { dateFrom, dateTo } = req.query;
    const query: any = {};
    
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom as string);
      if (dateTo) query.date.$lte = new Date(dateTo as string);
    }

    // Агрегация статистики
    const stats = await ScreenTime.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          avgTotalTime: { $avg: '$totalTime' },
          avgEntertainment: { $avg: '$entertainment' },
          avgCommunication: { $avg: '$communication' },
          avgBrowser: { $avg: '$browser' },
          avgStudy: { $avg: '$study' },
          avgCalculatedTotal: { $avg: '$calculatedTotal' },
          maxTotalTime: { $max: '$totalTime' },
          minTotalTime: { $min: '$totalTime' }
        }
      }
    ]);

    const result = stats[0] || {
      totalEntries: 0,
      avgTotalTime: 0,
      avgEntertainment: 0,
      avgCommunication: 0,
      avgBrowser: 0,
      avgStudy: 0,
      avgCalculatedTotal: 0,
      maxTotalTime: 0,
      minTotalTime: 0
    };

    res.json({
      success: true,
      data: result,
      meta: {
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики экранного времени:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении статистики'
    });
  }
}; 