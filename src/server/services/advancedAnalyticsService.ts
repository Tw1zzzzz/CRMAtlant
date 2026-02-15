import mongoose from 'mongoose';
import TeamReport from '../models/TeamReport';
import MoodEntry from '../models/MoodEntry';
import TestEntry from '../models/TestEntry';
import BalanceWheel from '../models/BalanceWheel';
import User from '../models/User';

// Интерфейсы для расширенного анализа
export interface PredictiveInsight {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'improving' | 'declining' | 'stable';
  timeframe: string;
  factors: string[];
}

export interface SentimentAnalysis {
  reportId: string;
  reportTitle: string;
  overallSentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -1 до 1
  emotionalTone: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    confidence: number;
    surprise: number;
  };
  keyPhrases: string[];
  recommendedActions: string[];
}

export interface PlayerCluster {
  clusterId: number;
  clusterName: string;
  playerIds: string[];
  characteristics: {
    avgMoodScore: number;
    responsiveness: 'high' | 'medium' | 'low';
    preferredReportTypes: string[];
    optimalReportTiming: string;
    strengths: string[];
    improvementAreas: string[];
  };
  recommendedStrategies: string[];
}

export interface TimeSeriesPattern {
  metric: string;
  pattern: 'seasonal' | 'cyclical' | 'trending' | 'random';
  seasonality?: {
    period: string;
    amplitude: number;
    phase: number;
  };
  trend?: {
    direction: 'upward' | 'downward' | 'stable';
    strength: number;
    acceleration: number;
  };
  forecast: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
}

export interface TeamPerformanceProfile {
  profileId: string;
  profileName: string;
  activePlayersCount: number;
  overallHealthScore: number;
  strengthAreas: string[];
  riskAreas: string[];
  recommendedInterventions: {
    priority: 'high' | 'medium' | 'low';
    intervention: string;
    expectedImpact: number;
    timeframe: string;
  }[];
  nextReviewDate: Date;
}

export interface AdvancedAnalyticsReport {
  generatedAt: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  executiveSummary: {
    overallScore: number;
    keyFindings: string[];
    criticalAlerts: string[];
    successMetrics: string[];
  };
  predictiveInsights: PredictiveInsight[];
  sentimentAnalysis: SentimentAnalysis[];
  playerClusters: PlayerCluster[];
  timeSeriesPatterns: TimeSeriesPattern[];
  teamProfile: TeamPerformanceProfile;
  actionPlan: {
    immediateActions: string[];
    shortTermGoals: string[];
    longTermStrategies: string[];
  };
}

/**
 * Простой алгоритм сентимент-анализа на основе ключевых слов
 */
const analyzeSentiment = (text: string): { score: number; tone: any } => {
  // Словари для анализа тональности
  const positiveWords = [
    'отлично', 'хорошо', 'замечательно', 'прогресс', 'улучшение', 'успех', 
    'победа', 'достижение', 'эффективно', 'продуктивно', 'мотивация',
    'уверенность', 'сильный', 'растем', 'развиваемся', 'команда'
  ];
  
  const negativeWords = [
    'плохо', 'ужасно', 'проблема', 'ошибка', 'неудача', 'провал',
    'слабость', 'недостаток', 'сложность', 'трудность', 'стресс',
    'усталость', 'разочарование', 'фрустрация', 'конфликт'
  ];

  const emotionalWords = {
    joy: ['радость', 'счастье', 'веселье', 'удовольствие', 'восторг'],
    sadness: ['грусть', 'печаль', 'уныние', 'тоска', 'депрессия'],
    anger: ['злость', 'гнев', 'раздражение', 'ярость', 'недовольство'],
    fear: ['страх', 'тревога', 'волнение', 'беспокойство', 'паника'],
    confidence: ['уверенность', 'сила', 'мощь', 'контроль', 'спокойствие'],
    surprise: ['удивление', 'шок', 'неожиданность', 'изумление']
  };

  const words = text.toLowerCase().split(/\s+/);
  
  let positiveCount = 0;
  let negativeCount = 0;
  const emotionalCounts = {
    joy: 0, sadness: 0, anger: 0, fear: 0, confidence: 0, surprise: 0
  };

  words.forEach(word => {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
    
    Object.keys(emotionalWords).forEach(emotion => {
      if (emotionalWords[emotion].includes(word)) {
        emotionalCounts[emotion]++;
      }
    });
  });

  const totalWords = words.length;
  const score = (positiveCount - negativeCount) / Math.max(totalWords, 1);
  
  // Нормализация эмоциональных счетчиков
  const emotionalTone = Object.keys(emotionalCounts).reduce((acc, emotion) => {
    acc[emotion] = Math.min(emotionalCounts[emotion] / Math.max(totalWords * 0.1, 1), 1);
    return acc;
  }, {} as any);

  return { score: Math.max(-1, Math.min(1, score)), tone: emotionalTone };
};

/**
 * Простой алгоритм линейной регрессии для прогнозирования
 */
const linearRegression = (data: number[]): { slope: number; intercept: number; r2: number } => {
  if (data.length < 2) return { slope: 0, intercept: 0, r2: 0 };

  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Вычисление R²
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
};

/**
 * K-means кластеризация для игроков
 */
const kMeansClustering = (players: any[], k: number = 3): PlayerCluster[] => {
  if (players.length < k) return [];

  // Простая версия k-means для 2D данных (средний mood и responsiveness)
  const points = players.map(player => ({
    id: player._id.toString(),
    x: player.avgMood || 5,
    y: player.responsiveness || 0.5,
    data: player
  }));

  // Инициализация центроидов
  let centroids = Array.from({ length: k }, (_, i) => ({
    x: Math.random() * 10,
    y: Math.random(),
    cluster: i
  }));

  let clusters: { [key: number]: typeof points } = {};
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    // Очистка кластеров
    clusters = {};
    for (let i = 0; i < k; i++) {
      clusters[i] = [];
    }

    // Назначение точек к ближайшим центроидам
    points.forEach(point => {
      let minDistance = Infinity;
      let closestCluster = 0;

      centroids.forEach((centroid, index) => {
        const distance = Math.sqrt(
          Math.pow(point.x - centroid.x, 2) + Math.pow(point.y - centroid.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = index;
        }
      });

      clusters[closestCluster].push(point);
    });

    // Обновление центроидов
    const newCentroids = centroids.map((_, index) => {
      const clusterPoints = clusters[index] || [];
      if (clusterPoints.length === 0) return centroids[index];

      const avgX = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length;
      const avgY = clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length;

      return { x: avgX, y: avgY, cluster: index };
    });

    // Проверка сходимости
    const converged = centroids.every((centroid, index) => {
      const newCentroid = newCentroids[index];
      return Math.abs(centroid.x - newCentroid.x) < 0.01 && 
             Math.abs(centroid.y - newCentroid.y) < 0.01;
    });

    centroids = newCentroids;
    iterations++;

    if (converged) break;
  }

  // Формирование результатов кластеризации
  const clusterNames = ['Высокопроизводительные', 'Стабильные', 'Требующие внимания'];
  
  return Object.keys(clusters).map((clusterKey, index) => {
    const clusterIndex = parseInt(clusterKey);
    const clusterPoints = clusters[clusterIndex] || [];
    
    if (clusterPoints.length === 0) return null;

    const avgMood = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length;
    const avgResponsiveness = clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length;

    let responsiveness: 'high' | 'medium' | 'low' = 'medium';
    if (avgResponsiveness > 0.7) responsiveness = 'high';
    else if (avgResponsiveness < 0.3) responsiveness = 'low';

    return {
      clusterId: clusterIndex,
      clusterName: clusterNames[index] || `Кластер ${clusterIndex + 1}`,
      playerIds: clusterPoints.map(p => p.id),
      characteristics: {
        avgMoodScore: Number(avgMood.toFixed(1)),
        responsiveness,
        preferredReportTypes: ['weekly', 'training_report'],
        optimalReportTiming: avgMood > 6 ? 'morning' : 'afternoon',
        strengths: avgMood > 6 ? ['Высокая мотивация', 'Стабильность'] : ['Потенциал роста'],
        improvementAreas: avgMood < 5 ? ['Настроение', 'Мотивация'] : []
      },
      recommendedStrategies: avgMood > 6 
        ? ['Поддержка текущего уровня', 'Новые вызовы']
        : ['Индивидуальная работа', 'Дополнительная поддержка']
    };
  }).filter(Boolean) as PlayerCluster[];
};

/**
 * Анализ сентимента отчетов команды
 */
export const analyzeSentimentOfReports = async (
  dateFrom?: Date,
  dateTo?: Date
): Promise<SentimentAnalysis[]> => {
  try {
    const query: any = {};
    if (dateFrom && dateTo) {
      query.createdAt = { $gte: dateFrom, $lte: dateTo };
    }

    const reports = await TeamReport.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    const sentimentResults: SentimentAnalysis[] = [];

    for (const report of reports) {
      // Объединяем весь текстовый контент отчета
      const fullText = [
        report.title,
        report.description || '',
        report.content.summary,
        report.content.details,
        ...(report.content.recommendations || [])
      ].join(' ');

      const { score, tone } = analyzeSentiment(fullText);

      let overallSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (score > 0.1) overallSentiment = 'positive';
      else if (score < -0.1) overallSentiment = 'negative';

      // Извлечение ключевых фраз (простой подход)
      const words = fullText.toLowerCase().split(/\s+/)
        .filter(word => word.length > 3)
        .filter((word, index, array) => array.indexOf(word) === index)
        .slice(0, 5);

      const recommendedActions: string[] = [];
      if (overallSentiment === 'negative') {
        recommendedActions.push('Провести индивидуальные беседы');
        recommendedActions.push('Усилить поддержку команды');
      } else if (overallSentiment === 'positive') {
        recommendedActions.push('Поддержать текущий подход');
        recommendedActions.push('Использовать как пример для других');
      }

      sentimentResults.push({
        reportId: report._id.toString(),
        reportTitle: report.title,
        overallSentiment,
        sentimentScore: Number(score.toFixed(3)),
        emotionalTone: {
          joy: Number(tone.joy.toFixed(2)),
          sadness: Number(tone.sadness.toFixed(2)),
          anger: Number(tone.anger.toFixed(2)),
          fear: Number(tone.fear.toFixed(2)),
          confidence: Number(tone.confidence.toFixed(2)),
          surprise: Number(tone.surprise.toFixed(2))
        },
        keyPhrases: words,
        recommendedActions
      });
    }

    return sentimentResults;
  } catch (error) {
    console.error('Ошибка анализа сентимента отчетов:', error);
    throw new Error('Не удалось выполнить анализ сентимента');
  }
};

/**
 * Кластерный анализ игроков
 */
export const performPlayerClustering = async (): Promise<PlayerCluster[]> => {
  try {
    // Получаем всех игроков с их статистикой
    const players = await User.find({ role: 'player' });
    
    const playerStats = await Promise.all(
      players.map(async (player) => {
        // Получаем последние записи настроения
        const recentMoods = await MoodEntry.find({ 
          userId: player._id 
        })
          .sort({ createdAt: -1 })
          .limit(10);

        // Вычисляем средний mood
        const avgMood = recentMoods.length > 0 
          ? recentMoods.reduce((sum, entry) => sum + entry.mood, 0) / recentMoods.length
          : 5;

        // Простая метрика отзывчивости (частота заполнения форм)
        const responsiveness = Math.min(recentMoods.length / 10, 1);

        return {
          _id: player._id,
          name: player.name,
          avgMood,
          responsiveness,
          moodEntries: recentMoods.length
        };
      })
    );

    if (playerStats.length < 3) {
      return [];
    }

    return kMeansClustering(playerStats, Math.min(3, playerStats.length));
  } catch (error) {
    console.error('Ошибка кластерного анализа игроков:', error);
    throw new Error('Не удалось выполнить кластерный анализ игроков');
  }
};

/**
 * Анализ временных рядов для ключевых метрик
 */
export const analyzeTimeSeriesPatterns = async (
  metric: 'mood' | 'balance' | 'activity',
  daysBack: number = 30
): Promise<TimeSeriesPattern[]> => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    let data: number[] = [];
    let metricName = '';

    switch (metric) {
      case 'mood':
        metricName = 'Настроение команды';
        const moodEntries = await MoodEntry.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              avgMood: { $avg: '$mood' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        data = moodEntries.map(entry => entry.avgMood);
        break;

      case 'balance':
        metricName = 'Общий баланс';
        const balanceEntries = await BalanceWheel.aggregate([
          {
            $match: {
              date: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' }
              },
              avgBalance: {
                $avg: {
                  $avg: [
                    '$physical', '$emotional', '$intellectual', '$spiritual',
                    '$occupational', '$social', '$environmental', '$financial'
                  ]
                }
              }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        data = balanceEntries.map(entry => entry.avgBalance);
        break;

      case 'activity':
        metricName = 'Активность команды';
        const activityData = await MoodEntry.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        data = activityData.map(entry => entry.count);
        break;
    }

    if (data.length < 3) {
      return [{
        metric: metricName,
        pattern: 'random',
        forecast: { nextWeek: 0, nextMonth: 0, confidence: 0 }
      }];
    }

    // Анализ тренда с помощью линейной регрессии
    const regression = linearRegression(data);
    
    let trendDirection: 'upward' | 'downward' | 'stable' = 'stable';
    if (Math.abs(regression.slope) > 0.01) {
      trendDirection = regression.slope > 0 ? 'upward' : 'downward';
    }

    // Простое прогнозирование
    const lastValue = data[data.length - 1];
    const nextWeek = lastValue + regression.slope * 7;
    const nextMonth = lastValue + regression.slope * 30;

    return [{
      metric: metricName,
      pattern: regression.r2 > 0.3 ? 'trending' : 'random',
      trend: {
        direction: trendDirection,
        strength: Math.abs(regression.slope),
        acceleration: regression.r2
      },
      forecast: {
        nextWeek: Number(nextWeek.toFixed(2)),
        nextMonth: Number(nextMonth.toFixed(2)),
        confidence: Number(regression.r2.toFixed(2))
      }
    }];
  } catch (error) {
    console.error('Ошибка анализа временных рядов:', error);
    throw new Error('Не удалось выполнить анализ временных рядов');
  }
};

/**
 * Создание прогнозных инсайтов
 */
export const generatePredictiveInsights = async (): Promise<PredictiveInsight[]> => {
  try {
    const insights: PredictiveInsight[] = [];

    // Прогноз настроения команды
    const moodPattern = await analyzeTimeSeriesPatterns('mood', 14);
    if (moodPattern.length > 0 && moodPattern[0].trend) {
      insights.push({
        metric: 'Настроение команды',
        currentValue: 6.5, // Можно получить из последних данных
        predictedValue: moodPattern[0].forecast.nextWeek,
        confidence: moodPattern[0].confidence,
        trend: moodPattern[0].trend.direction === 'upward' ? 'improving' : 
               moodPattern[0].trend.direction === 'downward' ? 'declining' : 'stable',
        timeframe: 'следующая неделя',
        factors: ['Регулярность отчетов', 'Время публикации', 'Тип контента']
      });
    }

    // Прогноз баланса
    const balancePattern = await analyzeTimeSeriesPatterns('balance', 21);
    if (balancePattern.length > 0 && balancePattern[0].trend) {
      insights.push({
        metric: 'Общий баланс жизни',
        currentValue: 7.2,
        predictedValue: balancePattern[0].forecast.nextWeek,
        confidence: balancePattern[0].confidence,
        trend: balancePattern[0].trend.direction === 'upward' ? 'improving' : 
               balancePattern[0].trend.direction === 'downward' ? 'declining' : 'stable',
        timeframe: 'следующие 3 недели',
        factors: ['Рабочая нагрузка', 'Социальная активность', 'Физическое состояние']
      });
    }

    // Прогноз активности
    const activityPattern = await analyzeTimeSeriesPatterns('activity', 30);
    if (activityPattern.length > 0 && activityPattern[0].trend) {
      insights.push({
        metric: 'Вовлеченность команды',
        currentValue: 8.0,
        predictedValue: activityPattern[0].forecast.nextMonth,
        confidence: activityPattern[0].confidence,
        trend: activityPattern[0].trend.direction === 'upward' ? 'improving' : 
               activityPattern[0].trend.direction === 'downward' ? 'declining' : 'stable',
        timeframe: 'следующий месяц',
        factors: ['Частота отчетов', 'Качество обратной связи', 'Мотивация']
      });
    }

    return insights;
  } catch (error) {
    console.error('Ошибка создания прогнозных инсайтов:', error);
    throw new Error('Не удалось создать прогнозные инсайты');
  }
};

/**
 * Создание профиля производительности команды
 */
export const generateTeamPerformanceProfile = async (): Promise<TeamPerformanceProfile> => {
  try {
    const playersCount = await User.countDocuments({ role: 'player' });
    
    // Получаем последние данные для расчета общего здоровья
    const recentMoods = await MoodEntry.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    const recentBalance = await BalanceWheel.find({})
      .sort({ date: -1 })
      .limit(20);

    // Расчет общего здоровья команды
    const avgMood = recentMoods.length > 0 
      ? recentMoods.reduce((sum, entry) => sum + entry.mood, 0) / recentMoods.length
      : 5;

    const avgBalance = recentBalance.length > 0
      ? recentBalance.reduce((sum, entry) => {
          const entryAvg = (entry.physical + entry.emotional + entry.intellectual + 
                           entry.spiritual + entry.occupational + entry.social + 
                           entry.environmental + entry.financial) / 8;
          return sum + entryAvg;
        }, 0) / recentBalance.length
      : 5;

    const overallHealthScore = Number(((avgMood + avgBalance) / 2).toFixed(1));

    // Определение сильных и слабых сторон
    const strengthAreas: string[] = [];
    const riskAreas: string[] = [];

    if (avgMood > 7) strengthAreas.push('Высокое моральное состояние');
    else if (avgMood < 5) riskAreas.push('Низкое настроение команды');

    if (avgBalance > 7) strengthAreas.push('Хороший жизненный баланс');
    else if (avgBalance < 5) riskAreas.push('Дисбаланс в жизни игроков');

    if (recentMoods.length > 30) strengthAreas.push('Высокая активность участников');
    else if (recentMoods.length < 10) riskAreas.push('Низкая вовлеченность');

    // Рекомендуемые вмешательства
    const recommendedInterventions = [];

    if (riskAreas.includes('Низкое настроение команды')) {
      recommendedInterventions.push({
        priority: 'high' as const,
        intervention: 'Провести индивидуальные встречи с игроками',
        expectedImpact: 0.8,
        timeframe: '1-2 недели'
      });
    }

    if (riskAreas.includes('Низкая вовлеченность')) {
      recommendedInterventions.push({
        priority: 'medium' as const,
        intervention: 'Пересмотреть формат отчетов и обратной связи',
        expectedImpact: 0.6,
        timeframe: '2-4 недели'
      });
    }

    if (strengthAreas.length > riskAreas.length) {
      recommendedInterventions.push({
        priority: 'low' as const,
        intervention: 'Поддержать текущую стратегию и масштабировать успешные практики',
        expectedImpact: 0.4,
        timeframe: '1-3 месяца'
      });
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 14); // Через 2 недели

    return {
      profileId: `profile_${Date.now()}`,
      profileName: 'Основной состав команды',
      activePlayersCount: playersCount,
      overallHealthScore,
      strengthAreas,
      riskAreas,
      recommendedInterventions,
      nextReviewDate
    };
  } catch (error) {
    console.error('Ошибка создания профиля команды:', error);
    throw new Error('Не удалось создать профиль производительности команды');
  }
};

/**
 * Главная функция: комплексный расширенный анализ
 */
export const generateAdvancedAnalyticsReport = async (
  dateFrom?: Date,
  dateTo?: Date
): Promise<AdvancedAnalyticsReport> => {
  try {
    const startTime = new Date();
    
    // Выполняем все виды анализа параллельно
    const [
      predictiveInsights,
      sentimentAnalysis,
      playerClusters,
      timeSeriesPatterns,
      teamProfile
    ] = await Promise.all([
      generatePredictiveInsights(),
      analyzeSentimentOfReports(dateFrom, dateTo),
      performPlayerClustering(),
      Promise.all([
        analyzeTimeSeriesPatterns('mood', 30),
        analyzeTimeSeriesPatterns('balance', 30),
        analyzeTimeSeriesPatterns('activity', 30)
      ]).then(results => results.flat()),
      generateTeamPerformanceProfile()
    ]);

    // Создание исполнительного резюме
    const overallScore = teamProfile.overallHealthScore;
    
    const keyFindings: string[] = [];
    const criticalAlerts: string[] = [];
    const successMetrics: string[] = [];

    // Анализ результатов для ключевых выводов
    if (sentimentAnalysis.length > 0) {
      const positiveReports = sentimentAnalysis.filter(s => s.overallSentiment === 'positive').length;
      const totalReports = sentimentAnalysis.length;
      const positiveRatio = positiveReports / totalReports;
      
      if (positiveRatio > 0.7) {
        successMetrics.push(`${Math.round(positiveRatio * 100)}% отчетов имеют позитивную тональность`);
      } else if (positiveRatio < 0.3) {
        criticalAlerts.push('Высокий процент негативных отчетов требует внимания');
      }
    }

    if (playerClusters.length > 0) {
      const highPerformanceCluster = playerClusters.find(c => c.characteristics.avgMoodScore > 7);
      if (highPerformanceCluster) {
        successMetrics.push(`${highPerformanceCluster.playerIds.length} игроков показывают высокие результаты`);
      }

      const riskCluster = playerClusters.find(c => c.characteristics.avgMoodScore < 5);
      if (riskCluster) {
        criticalAlerts.push(`${riskCluster.playerIds.length} игроков требуют дополнительного внимания`);
      }
    }

    predictiveInsights.forEach(insight => {
      if (insight.trend === 'improving' && insight.confidence > 0.6) {
        successMetrics.push(`Прогноз улучшения: ${insight.metric}`);
      } else if (insight.trend === 'declining' && insight.confidence > 0.6) {
        criticalAlerts.push(`Прогноз ухудшения: ${insight.metric}`);
      }
    });

    // План действий
    const actionPlan = {
      immediateActions: [
        ...teamProfile.recommendedInterventions
          .filter(i => i.priority === 'high')
          .map(i => i.intervention)
      ],
      shortTermGoals: [
        'Проведение еженедельного мониторинга ключевых метрик',
        'Оптимизация формата отчетов на основе сентимент-анализа',
        'Внедрение персонализированного подхода по кластерам игроков'
      ],
      longTermStrategies: [
        'Развитие предиктивной аналитики для упреждающих действий',
        'Создание автоматизированной системы раннего предупреждения',
        'Интеграция машинного обучения для персонализации рекомендаций'
      ]
    };

    return {
      generatedAt: new Date(),
      reportPeriod: {
        startDate: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: dateTo || new Date()
      },
      executiveSummary: {
        overallScore,
        keyFindings,
        criticalAlerts,
        successMetrics
      },
      predictiveInsights,
      sentimentAnalysis,
      playerClusters,
      timeSeriesPatterns,
      teamProfile,
      actionPlan
    };
  } catch (error) {
    console.error('Ошибка создания расширенного аналитического отчета:', error);
    throw new Error('Не удалось создать расширенный аналитический отчет');
  }
};

export default {
  analyzeSentimentOfReports,
  performPlayerClustering,
  analyzeTimeSeriesPatterns,
  generatePredictiveInsights,
  generateTeamPerformanceProfile,
  generateAdvancedAnalyticsReport
}; 