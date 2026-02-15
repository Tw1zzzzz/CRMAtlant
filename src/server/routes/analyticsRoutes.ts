import express, { Request, Response, NextFunction } from 'express';
import analyticsController from '../controllers/analyticsController';
import { protect } from '../middleware/authMiddleware';
import { AuthRequest } from '../types';

const router = express.Router();

// Маршруты для получения статистики и метрик
router.get('/stats', protect, analyticsController.getUserStats as any);
router.get('/metrics', protect, analyticsController.getMetrics as any);
router.post('/metrics', protect, analyticsController.saveMetrics as any);

// Маршруты для получения последних матчей
router.get('/matches', protect, analyticsController.getRecentMatches as any);

// Маршрут для обновления кэша (доступен только для персонала)
router.post('/refresh-cache', protect, analyticsController.refreshCache as any);

export default router; 