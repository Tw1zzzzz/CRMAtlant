import { Request, Response } from 'express';
import analyticsService from '../services/analyticsService';
import { AuthRequest } from '../types';

/**
 * Получает статистику пользователя
 * @route GET /api/analytics/stats
 */
export const getUserStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    const { from, to, type } = req.query;
    
    // Конвертируем строковые даты в объекты Date
    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;
    
    // Получаем статистику пользователя
    const stats = await analyticsService.getUserStats(
      req.user.id,
      fromDate,
      toDate,
      type as string
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Ошибка при получении статистики пользователя:', error);
    res.status(500).json({ message: 'Не удалось получить статистику' });
  }
};

/**
 * Сохраняет метрики пользователя
 * @route POST /api/analytics/metrics
 */
export const saveMetrics = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    const { mood, balanceWheel, matchId } = req.body;
    
    if (!mood || mood < 1 || mood > 10) {
      return res.status(400).json({ message: 'Настроение должно быть числом от 1 до 10' });
    }
    
    // Сохраняем метрики пользователя
    const metrics = await analyticsService.savePlayerMetrics(
      req.user.id,
      mood,
      balanceWheel,
      matchId
    );
    
    res.json(metrics);
  } catch (error) {
    console.error('Ошибка при сохранении метрик пользователя:', error);
    res.status(500).json({ message: 'Не удалось сохранить метрики' });
  }
};

/**
 * Получает метрики пользователя
 * @route GET /api/analytics/metrics
 */
export const getMetrics = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Получаем метрики пользователя
    const metrics = await analyticsService.getPlayerMetrics(req.user.id, limit);
    
    res.json(metrics);
  } catch (error) {
    console.error('Ошибка при получении метрик пользователя:', error);
    res.status(500).json({ message: 'Не удалось получить метрики' });
  }
};

/**
 * Получает последние матчи пользователя
 * @route GET /api/analytics/matches
 */
export const getRecentMatches = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }
    
    if (!req.user.faceitAccountId) {
      return res.status(400).json({ message: 'Аккаунт Faceit не привязан' });
    }
    
    // Получаем статистику с недавними матчами
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const stats = await analyticsService.getUserStats(req.user.id);
    
    // Возвращаем только последние матчи
    res.json({
      matches: stats.recentMatches.slice(0, limit)
    });
  } catch (error) {
    console.error('Ошибка при получении последних матчей:', error);
    res.status(500).json({ message: 'Не удалось получить последние матчи' });
  }
};

/**
 * Ручной запуск обновления кэша аналитики
 * @route POST /api/analytics/refresh-cache
 */
export const refreshCache = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    // Запускаем обновление кэша в фоновом режиме
    analyticsService.updateAnalyticsCache()
      .then(() => console.log('Обновление кэша завершено'))
      .catch(err => console.error('Ошибка при обновлении кэша:', err));
    
    res.json({ message: 'Запущено обновление кэша' });
  } catch (error) {
    console.error('Ошибка при запуске обновления кэша:', error);
    res.status(500).json({ message: 'Не удалось запустить обновление кэша' });
  }
};

export default {
  getUserStats,
  saveMetrics,
  getMetrics,
  getRecentMatches,
  refreshCache
}; 