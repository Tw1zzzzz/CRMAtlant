import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import {
  getScreenTime,
  createOrUpdateScreenTime,
  getScreenTimeStats
} from '../controllers/screenTimeController';

const router = express.Router();

// Применяем middleware авторизации ко всем маршрутам
router.use(protect);

/**
 * @route GET /api/screen-time
 * @desc Получить экранное время для пользователя
 * @access Private
 * @query userId - ID пользователя (опционально, по умолчанию текущий пользователь)
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 */
router.get('/', getScreenTime);

/**
 * @route POST /api/screen-time
 * @desc Создать или обновить запись экранного времени
 * @access Staff only
 * @body { userId, date, hoursPlayed, hoursStreaming, hoursWatching }
 */
router.post('/', isStaff, createOrUpdateScreenTime);

/**
 * @route GET /api/screen-time/stats
 * @desc Получить статистику экранного времени для всех игроков
 * @access Staff only
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 */
router.get('/stats', isStaff, getScreenTimeStats);

export default router; 