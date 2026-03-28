import express from 'express';
import { protect, isStaff, hasGameStatsSubscription } from '../middleware/auth';
import {
  getGameStats,
  createGameStats,
  updateGameStats,
  deleteGameStats,
  getGameStatsAnalytics,
  getTopPlayersByGameStats
} from '../controllers/gameStatsController';

const router = express.Router();

// Применяем middleware авторизации ко всем маршрутам
router.use(protect);
router.use(hasGameStatsSubscription);

/**
 * @route GET /api/game-stats
 * @desc Получить игровые показатели для пользователя
 * @access Private
 */
router.get('/', getGameStats);

/**
 * @route POST /api/game-stats
 * @desc Создать игровые показатели
 * @access Private
 */
router.post('/', createGameStats);

/**
 * @route PUT /api/game-stats/:id
 * @desc Обновить игровые показатели
 * @access Private
 */
router.put('/:id', updateGameStats);

/**
 * @route DELETE /api/game-stats/:id
 * @desc Удалить игровые показатели
 * @access Private
 */
router.delete('/:id', deleteGameStats);

/**
 * @route GET /api/game-stats/analytics
 * @desc Получить аналитику игровых показателей
 * @access Staff only
 */
router.get('/analytics', isStaff, getGameStatsAnalytics);

/**
 * @route GET /api/game-stats/top-players
 * @desc Получить топ игроков по игровым показателям
 * @access Staff only
 */
router.get('/top-players', isStaff, getTopPlayersByGameStats);

export default router; 
