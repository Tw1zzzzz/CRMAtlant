import express from 'express';
import { protect, isSoloOrStaff } from '../middleware/auth';
import {
  getMoodReportsCorrelations,
  getPerformancePatterns,
  getBalanceWheelReportsCorrelations,
  getComprehensiveAnalysis,
  getCorrelationStats,
  getCorrelationAssistantInsight,
  getMultiMetrics
} from '../controllers/correlationController';

const router = express.Router();

/**
 * Все маршруты требуют аутентификации
 */
router.use(protect);

/**
 * @route GET /api/correlations/mood-reports
 * @desc Получить корреляции между отчетами команды и настроением игроков
 * @access Staff + Solo players
 */
router.get('/mood-reports', isSoloOrStaff, getMoodReportsCorrelations);

/**
 * @route GET /api/correlations/performance-patterns
 * @desc Получить паттерны производительности команды
 * @access Staff + Solo players
 */
router.get('/performance-patterns', isSoloOrStaff, getPerformancePatterns);

/**
 * @route GET /api/correlations/balance-wheel-reports
 * @desc Получить корреляции между отчетами и колесом баланса
 * @access Staff + Solo players
 */
router.get('/balance-wheel-reports', isSoloOrStaff, getBalanceWheelReportsCorrelations);

/**
 * @route GET /api/correlations/comprehensive
 * @desc Получить комплексный корреляционный анализ
 * @access Staff + Solo players
 */
router.get('/comprehensive', isSoloOrStaff, getComprehensiveAnalysis);

/**
 * @route GET /api/correlations/stats
 * @desc Получить статистику корреляционного анализа
 * @access Staff + Solo players
 */
router.get('/stats', isSoloOrStaff, getCorrelationStats);

/**
 * @route POST /api/correlations/ai-assistant
 * @desc Сгенерировать AI-вывод по данным корреляционного анализа
 * @access Staff + Solo players
 */
router.post('/ai-assistant', isSoloOrStaff, getCorrelationAssistantInsight);

/**
 * @route GET /api/correlations/multi-metrics
 * @desc Получить мультиметричные данные для корреляционного анализа
 * @access Staff + Solo players
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 * @query playerId - ID игрока (опционально, для индивидуального анализа)
 * @query mode - режим анализа (team|individual)
 */
router.get('/multi-metrics', isSoloOrStaff, getMultiMetrics);

export default router;
