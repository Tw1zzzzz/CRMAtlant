import { Request, Response } from 'express';
import {
  analyzeSentimentOfReports,
  performPlayerClustering,
  analyzeTimeSeriesPatterns,
  generatePredictiveInsights,
  generateTeamPerformanceProfile,
  generateAdvancedAnalyticsReport
} from '../services/advancedAnalyticsService';

/**
 * Получение анализа сентимента отчетов команды
 */
export const getSentimentAnalysis = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom && typeof dateFrom === 'string') {
      fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateFrom'
        });
      }
    }

    if (dateTo && typeof dateTo === 'string') {
      toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateTo'
        });
      }
    }

    // Проверка корректности диапазона дат
    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: 'Дата начала не может быть больше даты окончания'
      });
    }

    console.log('[AdvancedAnalytics] Получение анализа сентимента, период:', fromDate, '->', toDate);

    const sentimentData = await analyzeSentimentOfReports(fromDate, toDate);

    res.json({
      success: true,
      data: sentimentData,
      meta: {
        totalReports: sentimentData.length,
        positiveReports: sentimentData.filter(r => r.overallSentiment === 'positive').length,
        negativeReports: sentimentData.filter(r => r.overallSentiment === 'negative').length,
        neutralReports: sentimentData.filter(r => r.overallSentiment === 'neutral').length,
        averageSentiment: sentimentData.length > 0 
          ? sentimentData.reduce((sum, r) => sum + r.sentimentScore, 0) / sentimentData.length
          : 0,
        dateRange: { from: fromDate, to: toDate }
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка анализа сентимента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при анализе сентимента отчетов',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получение кластерного анализа игроков
 */
export const getPlayerClustering = async (req: Request, res: Response) => {
  try {
    console.log('[AdvancedAnalytics] Выполнение кластерного анализа игроков');

    const clusterData = await performPlayerClustering();

    res.json({
      success: true,
      data: clusterData,
      meta: {
        totalClusters: clusterData.length,
        totalPlayersAnalyzed: clusterData.reduce((sum, cluster) => sum + cluster.playerIds.length, 0),
        clusterSizes: clusterData.map(cluster => ({
          clusterId: cluster.clusterId,
          clusterName: cluster.clusterName,
          playerCount: cluster.playerIds.length
        })),
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка кластерного анализа:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при выполнении кластерного анализа игроков',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получение анализа временных рядов
 */
export const getTimeSeriesAnalysis = async (req: Request, res: Response) => {
  try {
    const { metric, daysBack } = req.query;

    // Валидация метрики
    const validMetrics = ['mood', 'balance', 'activity'];
    if (!metric || !validMetrics.includes(metric as string)) {
      return res.status(400).json({
        success: false,
        message: `Неверная метрика. Доступные: ${validMetrics.join(', ')}`
      });
    }

    // Валидация количества дней
    let days = 30; // значение по умолчанию
    if (daysBack) {
      days = parseInt(daysBack as string);
      if (isNaN(days) || days < 7 || days > 365) {
        return res.status(400).json({
          success: false,
          message: 'Количество дней должно быть от 7 до 365'
        });
      }
    }

    console.log('[AdvancedAnalytics] Анализ временных рядов:', metric, 'за', days, 'дней');

    const timeSeriesData = await analyzeTimeSeriesPatterns(metric as 'mood' | 'balance' | 'activity', days);

    res.json({
      success: true,
      data: timeSeriesData,
      meta: {
        metric: metric,
        daysAnalyzed: days,
        patternsFound: timeSeriesData.length,
        analysisDate: new Date(),
        dataQuality: timeSeriesData.length > 0 ? timeSeriesData[0].confidence : 0
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка анализа временных рядов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при анализе временных рядов',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получение прогнозных инсайтов
 */
export const getPredictiveInsights = async (req: Request, res: Response) => {
  try {
    console.log('[AdvancedAnalytics] Генерация прогнозных инсайтов');

    const predictiveData = await generatePredictiveInsights();

    res.json({
      success: true,
      data: predictiveData,
      meta: {
        totalInsights: predictiveData.length,
        improvingMetrics: predictiveData.filter(i => i.trend === 'improving').length,
        decliningMetrics: predictiveData.filter(i => i.trend === 'declining').length,
        stableMetrics: predictiveData.filter(i => i.trend === 'stable').length,
        highConfidenceInsights: predictiveData.filter(i => i.confidence > 0.7).length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка генерации прогнозов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при генерации прогнозных инсайтов',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получение профиля производительности команды
 */
export const getTeamPerformanceProfile = async (req: Request, res: Response) => {
  try {
    console.log('[AdvancedAnalytics] Создание профиля производительности команды');

    const profileData = await generateTeamPerformanceProfile();

    res.json({
      success: true,
      data: profileData,
      meta: {
        profileGenerated: true,
        nextReviewInDays: Math.ceil((profileData.nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        riskLevel: profileData.riskAreas.length > profileData.strengthAreas.length ? 'high' : 
                  profileData.riskAreas.length === profileData.strengthAreas.length ? 'medium' : 'low',
        actionRequired: profileData.recommendedInterventions.filter(i => i.priority === 'high').length > 0,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка создания профиля команды:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании профиля производительности команды',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Получение комплексного расширенного аналитического отчета
 */
export const getAdvancedAnalyticsReport = async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (dateFrom && typeof dateFrom === 'string') {
      fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateFrom'
        });
      }
    }

    if (dateTo && typeof dateTo === 'string') {
      toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат даты dateTo'
        });
      }
    }

    console.log('[AdvancedAnalytics] Генерация комплексного аналитического отчета');

    const reportData = await generateAdvancedAnalyticsReport(fromDate, toDate);

    res.json({
      success: true,
      data: reportData,
      meta: {
        reportType: 'comprehensive_advanced_analytics',
        reportPeriodDays: Math.ceil((reportData.reportPeriod.endDate.getTime() - reportData.reportPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        analysisModules: {
          predictiveInsights: reportData.predictiveInsights.length,
          sentimentAnalysis: reportData.sentimentAnalysis.length,
          playerClusters: reportData.playerClusters.length,
          timeSeriesPatterns: reportData.timeSeriesPatterns.length,
          teamProfileIncluded: !!reportData.teamProfile
        },
        executiveSummary: {
          overallHealthScore: reportData.executiveSummary.overallScore,
          totalFindings: reportData.executiveSummary.keyFindings.length,
          criticalIssues: reportData.executiveSummary.criticalAlerts.length,
          positiveMetrics: reportData.executiveSummary.successMetrics.length
        },
        actionItems: {
          immediate: reportData.actionPlan.immediateActions.length,
          shortTerm: reportData.actionPlan.shortTermGoals.length,
          longTerm: reportData.actionPlan.longTermStrategies.length
        },
        processingTime: new Date().getTime() - reportData.generatedAt.getTime(),
        generatedAt: reportData.generatedAt
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка создания комплексного отчета:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании комплексного аналитического отчета',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Быстрая статистика по расширенной аналитике
 */
export const getAdvancedAnalyticsStats = async (req: Request, res: Response) => {
  try {
    console.log('[AdvancedAnalytics] Получение быстрой статистики');

    // Выполняем параллельно быстрые запросы для получения общей статистики
    const [
      sentimentSample,
      clusterSample,
      predictiveSample
    ] = await Promise.all([
      analyzeSentimentOfReports().then(data => data.slice(0, 5)), // Последние 5 отчетов
      performPlayerClustering().then(data => data.map(cluster => ({ 
        id: cluster.clusterId, 
        name: cluster.clusterName, 
        count: cluster.playerIds.length 
      }))),
      generatePredictiveInsights().then(data => data.map(insight => ({
        metric: insight.metric,
        trend: insight.trend,
        confidence: insight.confidence
      })))
    ]);

    res.json({
      success: true,
      data: {
        sentimentOverview: {
          recentReports: sentimentSample.length,
          averageSentiment: sentimentSample.length > 0 
            ? sentimentSample.reduce((sum, r) => sum + r.sentimentScore, 0) / sentimentSample.length
            : 0,
          positiveCount: sentimentSample.filter(r => r.overallSentiment === 'positive').length,
          negativeCount: sentimentSample.filter(r => r.overallSentiment === 'negative').length
        },
        clusterOverview: {
          totalClusters: clusterSample.length,
          clusters: clusterSample
        },
        predictiveOverview: {
          totalMetrics: predictiveSample.length,
          improvingCount: predictiveSample.filter(p => p.trend === 'improving').length,
          decliningCount: predictiveSample.filter(p => p.trend === 'declining').length,
          averageConfidence: predictiveSample.length > 0
            ? predictiveSample.reduce((sum, p) => sum + p.confidence, 0) / predictiveSample.length
            : 0
        }
      },
      meta: {
        dataType: 'quick_stats',
        samplingDate: new Date(),
        fullAnalysisAvailable: true
      }
    });
  } catch (error) {
    console.error('[AdvancedAnalytics] Ошибка получения статистики:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики расширенной аналитики',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default {
  getSentimentAnalysis,
  getPlayerClustering,
  getTimeSeriesAnalysis,
  getPredictiveInsights,
  getTeamPerformanceProfile,
  getAdvancedAnalyticsReport,
  getAdvancedAnalyticsStats
}; 