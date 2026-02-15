import express from 'express';
import { protect, isStaff } from '../middleware/auth';
import {
  getMoodReportsCorrelations,
  getPerformancePatterns,
  getBalanceWheelReportsCorrelations,
  getComprehensiveAnalysis,
  getCorrelationStats,
  getMultiMetrics
} from '../controllers/correlationController';

const router = express.Router();

/**
 * Все маршруты требуют аутентификации
 * Доступ только для персонала
 */
router.use(protect);
router.use(isStaff);

/**
 * @route GET /api/correlations/mood-reports
 * @desc Получить корреляции между отчетами команды и настроением игроков
 * @access Staff only
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 * @query teamId - ID команды (опционально)
 */
router.get('/mood-reports', getMoodReportsCorrelations);

/**
 * @route GET /api/correlations/performance-patterns
 * @desc Получить паттерны производительности команды
 * @access Staff only
 * @query monthsBack - количество месяцев для анализа (по умолчанию 6)
 */
router.get('/performance-patterns', getPerformancePatterns);

/**
 * @route GET /api/correlations/balance-wheel-reports
 * @desc Получить корреляции между отчетами и колесом баланса
 * @access Staff only
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 */
router.get('/balance-wheel-reports', getBalanceWheelReportsCorrelations);

/**
 * @route GET /api/correlations/comprehensive
 * @desc Получить комплексный корреляционный анализ
 * @access Staff only
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 */
router.get('/comprehensive', getComprehensiveAnalysis);

/**
 * @route GET /api/correlations/stats
 * @desc Получить статистику корреляционного анализа
 * @access Staff only
 */
router.get('/stats', getCorrelationStats);

/**
 * @route GET /api/correlations/multi-metrics
 * @desc Получить мультиметричные данные для корреляционного анализа
 * @access Staff only
 * @query dateFrom - начальная дата (YYYY-MM-DD)
 * @query dateTo - конечная дата (YYYY-MM-DD)
 * @query playerId - ID игрока (опционально, для индивидуального анализа)
 * @query mode - режим анализа (team|individual)
 */
router.get('/multi-metrics', getMultiMetrics);

export default router; 