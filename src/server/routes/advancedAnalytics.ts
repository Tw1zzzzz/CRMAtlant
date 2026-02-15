import express from 'express';
import { protect, isStaff } from '../middleware/auth';

// Попытка импорта контроллеров - если не удастся, используем заглушки
let controllersAvailable = true;
let advancedAnalyticsControllers: any;

try {
  advancedAnalyticsControllers = require('../controllers/advancedAnalyticsController');
} catch (error) {
  console.warn('[AdvancedAnalytics] Контроллеры недоступны, используются заглушки');
  controllersAvailable = false;
}

const router = express.Router();

/**
 * Все маршруты расширенной аналитики требуют авторизации и доступа персонала
 */
router.use(protect);
router.use(isStaff);

// Заглушка для недоступных функций
const notImplementedHandler = (req: any, res: any) => {
  res.status(501).json({
    success: false,
    message: 'Функция расширенной аналитики находится в разработке',
    data: [],
    meta: {
      generatedAt: new Date(),
      status: 'not_implemented'
    }
  });
};

// Выбор между реальными контроллерами и заглушками
const getSentimentAnalysis = controllersAvailable 
  ? advancedAnalyticsControllers.getSentimentAnalysis 
  : notImplementedHandler;

const getPlayerClustering = controllersAvailable 
  ? advancedAnalyticsControllers.getPlayerClustering 
  : notImplementedHandler;

const getTimeSeriesAnalysis = controllersAvailable 
  ? advancedAnalyticsControllers.getTimeSeriesAnalysis 
  : notImplementedHandler;

const getPredictiveInsights = controllersAvailable 
  ? advancedAnalyticsControllers.getPredictiveInsights 
  : notImplementedHandler;

const getTeamPerformanceProfile = controllersAvailable 
  ? advancedAnalyticsControllers.getTeamPerformanceProfile 
  : notImplementedHandler;

const getAdvancedAnalyticsReport = controllersAvailable 
  ? advancedAnalyticsControllers.getAdvancedAnalyticsReport 
  : notImplementedHandler;

const getAdvancedAnalyticsStats = controllersAvailable 
  ? advancedAnalyticsControllers.getAdvancedAnalyticsStats 
  : notImplementedHandler;

/**
 * GET /api/advanced-analytics/sentiment
 * Анализ сентимента отчетов команды
 * 
 * Query parameters:
 * - dateFrom: string (ISO date) - начальная дата анализа
 * - dateTo: string (ISO date) - конечная дата анализа
 * 
 * Returns: SentimentAnalysis[]
 */
router.get('/sentiment', getSentimentAnalysis);

/**
 * GET /api/advanced-analytics/clustering
 * Кластерный анализ игроков по поведенческим паттернам
 * 
 * Returns: PlayerCluster[]
 */
router.get('/clustering', getPlayerClustering);

/**
 * GET /api/advanced-analytics/time-series
 * Анализ временных рядов для ключевых метрик
 * 
 * Query parameters:
 * - metric: 'mood' | 'balance' | 'activity' - тип метрики для анализа
 * - daysBack: number (7-365) - количество дней для анализа
 * 
 * Returns: TimeSeriesPattern[]
 */
router.get('/time-series', getTimeSeriesAnalysis);

/**
 * GET /api/advanced-analytics/predictions
 * Прогнозные инсайты на основе машинного обучения
 * 
 * Returns: PredictiveInsight[]
 */
router.get('/predictions', getPredictiveInsights);

/**
 * GET /api/advanced-analytics/team-profile
 * Профиль производительности команды с рекомендациями
 * 
 * Returns: TeamPerformanceProfile
 */
router.get('/team-profile', getTeamPerformanceProfile);

/**
 * GET /api/advanced-analytics/comprehensive-report
 * Комплексный расширенный аналитический отчет
 * 
 * Query parameters:
 * - dateFrom: string (ISO date) - начальная дата анализа
 * - dateTo: string (ISO date) - конечная дата анализа
 * 
 * Returns: AdvancedAnalyticsReport
 */
router.get('/comprehensive-report', getAdvancedAnalyticsReport);

/**
 * GET /api/advanced-analytics/stats
 * Быстрая статистика по всем модулям расширенной аналитики
 * 
 * Returns: Quick overview stats
 */
router.get('/stats', getAdvancedAnalyticsStats);

export default router; 