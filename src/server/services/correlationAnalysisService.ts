import TeamReport from '../models/TeamReport';
import MoodEntry from '../models/MoodEntry';
import BalanceWheel from '../models/BalanceWheel';

// Интерфейсы для результатов анализа
export interface CorrelationResult {
  correlation: number;
  pValue?: number;
  significance: 'high' | 'medium' | 'low' | 'none';
  sampleSize: number;
  confidence: number;
}

export interface ReportMoodCorrelation {
  reportId: string;
  reportTitle: string;
  reportType: string;
  reportDate: Date;
  correlations: {
    beforeAfter: {
      moodBefore: number;
      moodAfter: number;
      change: number;
      changePercent: number;
    };
    timeWindow: {
      weekBefore: number[];
      weekAfter: number[];
      correlation: CorrelationResult;
    };
  };
}

export interface TeamPerformancePattern {
  period: string;
  reportsCount: number;
  avgMoodBeforeReports: number;
  avgMoodAfterReports: number;
  moodTrend: 'improving' | 'declining' | 'stable';
  reportTypes: Array<{
    type: string;
    count: number;
    avgMoodImpact: number;
  }>;
}

export interface BalanceWheelReportCorrelation {
  reportId: string;
  reportTitle: string;
  balanceAreas: Array<{
    area: string;
    beforeReport: number;
    afterReport: number;
    change: number;
    correlation: CorrelationResult;
  }>;
  overallBalance: {
    before: number;
    after: number;
    improvement: number;
  };
}

// Вспомогательные функции для расчета корреляций
const calculatePearsonCorrelation = (x: number[], y: number[]): CorrelationResult => {
  if (x.length !== y.length || x.length < 2) {
    return {
      correlation: 0,
      significance: 'none',
      sampleSize: x.length,
      confidence: 0
    };
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) {
    return {
      correlation: 0,
      significance: 'none',
      sampleSize: n,
      confidence: 0
    };
  }

  const correlation = numerator / denominator;
  
  // Определение значимости корреляции
  const absCorr = Math.abs(correlation);
  let significance: 'high' | 'medium' | 'low' | 'none';
  let confidence: number;

  if (absCorr >= 0.7) {
    significance = 'high';
    confidence = 90;
  } else if (absCorr >= 0.5) {
    significance = 'medium';
    confidence = 75;
  } else if (absCorr >= 0.3) {
    significance = 'low';
    confidence = 60;
  } else {
    significance = 'none';
    confidence = 50;
  }

  return {
    correlation,
    significance,
    sampleSize: n,
    confidence
  };
};

const getDateRange = (baseDate: Date, daysBefore: number, daysAfter: number) => {
  const startDate = new Date(baseDate);
  startDate.setDate(startDate.getDate() - daysBefore);
  
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + daysAfter);
  
  return { startDate, endDate };
};

// Основные функции анализа
export const analyzeReportMoodCorrelations = async (
  _teamId?: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<ReportMoodCorrelation[]> => {
  try {
    // Получаем отчеты команды
    const reportsQuery: any = {
      status: 'published',
      isDeleted: false
    };

    if (dateFrom || dateTo) {
      reportsQuery.createdAt = {};
      if (dateFrom) reportsQuery.createdAt.$gte = dateFrom;
      if (dateTo) reportsQuery.createdAt.$lte = dateTo;
    }

    const reports = await TeamReport.find(reportsQuery)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name')
      .limit(20); // Ограничиваем для производительности

    const correlations: ReportMoodCorrelation[] = [];

    for (const report of reports) {
      const reportDate = new Date(report.createdAt);
      
      // Получаем данные настроения за период вокруг отчета
      const { startDate, endDate } = getDateRange(reportDate, 7, 7);
      
      const moodEntries = await MoodEntry.find({
        date: { $gte: startDate, $lte: endDate }
      }).populate('userId', 'name');

      // Группируем данные настроения по периодам
      const weekBeforeEntries = moodEntries.filter(entry => 
        new Date(entry.date) < reportDate
      );
      const weekAfterEntries = moodEntries.filter(entry => 
        new Date(entry.date) > reportDate
      );

      if (weekBeforeEntries.length > 0 && weekAfterEntries.length > 0) {
        const moodBefore = weekBeforeEntries.reduce((sum, entry) => sum + entry.mood, 0) / weekBeforeEntries.length;
        const moodAfter = weekAfterEntries.reduce((sum, entry) => sum + entry.mood, 0) / weekAfterEntries.length;
        
        const change = moodAfter - moodBefore;
        const changePercent = (change / moodBefore) * 100;

        // Создаем временные ряды для корреляционного анализа
        const weekBeforeMoods = weekBeforeEntries.map(entry => entry.mood);
        const weekAfterMoods = weekAfterEntries.map(entry => entry.mood);
        
        // Корреляция между настроениями до и после отчета
        const timeCorrelation = calculatePearsonCorrelation(weekBeforeMoods, weekAfterMoods);

        correlations.push({
          reportId: report._id.toString(),
          reportTitle: report.title,
          reportType: report.type,
          reportDate: reportDate,
          correlations: {
            beforeAfter: {
              moodBefore,
              moodAfter,
              change,
              changePercent
            },
            timeWindow: {
              weekBefore: weekBeforeMoods,
              weekAfter: weekAfterMoods,
              correlation: timeCorrelation
            }
          }
        });
      }
    }

    return correlations;
  } catch (error) {
    console.error('[CorrelationService] Ошибка анализа корреляций отчетов и настроения:', error);
    throw error;
  }
};

export const analyzeTeamPerformancePatterns = async (
  monthsBack: number = 6
): Promise<TeamPerformancePattern[]> => {
  try {
    const patterns: TeamPerformancePattern[] = [];
    const now = new Date();

    for (let i = 0; i < monthsBack; i++) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i, 0);

      // Получаем отчеты за период
      const reports = await TeamReport.find({
        createdAt: { $gte: periodStart, $lte: periodEnd },
        status: 'published',
        isDeleted: false
      });

      if (reports.length === 0) continue;

      // Анализируем настроение вокруг каждого отчета
      let totalMoodBefore = 0;
      let totalMoodAfter = 0;
      let validReports = 0;

      const reportTypeImpacts: Record<string, { count: number; totalImpact: number }> = {};

      for (const report of reports) {
        const reportDate = new Date(report.createdAt);
        const { startDate, endDate } = getDateRange(reportDate, 3, 3);

        const moodEntries = await MoodEntry.find({
          date: { $gte: startDate, $lte: endDate }
        });

        const beforeEntries = moodEntries.filter(entry => new Date(entry.date) < reportDate);
        const afterEntries = moodEntries.filter(entry => new Date(entry.date) > reportDate);

        if (beforeEntries.length > 0 && afterEntries.length > 0) {
          const moodBefore = beforeEntries.reduce((sum, entry) => sum + entry.mood, 0) / beforeEntries.length;
          const moodAfter = afterEntries.reduce((sum, entry) => sum + entry.mood, 0) / afterEntries.length;
          
          totalMoodBefore += moodBefore;
          totalMoodAfter += moodAfter;
          validReports++;

          const impact = moodAfter - moodBefore;
          
          if (!reportTypeImpacts[report.type]) {
            reportTypeImpacts[report.type] = { count: 0, totalImpact: 0 };
          }
          reportTypeImpacts[report.type].count++;
          reportTypeImpacts[report.type].totalImpact += impact;
        }
      }

      if (validReports > 0) {
        const avgMoodBefore = totalMoodBefore / validReports;
        const avgMoodAfter = totalMoodAfter / validReports;
        const moodChange = avgMoodAfter - avgMoodBefore;

        let moodTrend: 'improving' | 'declining' | 'stable';
        if (moodChange > 0.5) {
          moodTrend = 'improving';
        } else if (moodChange < -0.5) {
          moodTrend = 'declining';
        } else {
          moodTrend = 'stable';
        }

        const reportTypes = Object.entries(reportTypeImpacts).map(([type, data]) => ({
          type,
          count: data.count,
          avgMoodImpact: data.totalImpact / data.count
        }));

        patterns.push({
          period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
          reportsCount: reports.length,
          avgMoodBeforeReports: avgMoodBefore,
          avgMoodAfterReports: avgMoodAfter,
          moodTrend,
          reportTypes
        });
      }
    }

    return patterns.reverse(); // Возвращаем в хронологическом порядке
  } catch (error) {
    console.error('[CorrelationService] Ошибка анализа паттернов производительности:', error);
    throw error;
  }
};

export const analyzeBalanceWheelReportCorrelations = async (
  dateFrom?: Date,
  dateTo?: Date
): Promise<BalanceWheelReportCorrelation[]> => {
  try {
    // Получаем отчеты
    const reportsQuery: any = {
      status: 'published',
      isDeleted: false
    };

    if (dateFrom || dateTo) {
      reportsQuery.createdAt = {};
      if (dateFrom) reportsQuery.createdAt.$gte = dateFrom;
      if (dateTo) reportsQuery.createdAt.$lte = dateTo;
    }

    const reports = await TeamReport.find(reportsQuery)
      .sort({ createdAt: -1 })
      .limit(10);

    const correlations: BalanceWheelReportCorrelation[] = [];

    for (const report of reports) {
      const reportDate = new Date(report.createdAt);
      const { startDate, endDate } = getDateRange(reportDate, 14, 14);

      // Получаем данные колеса баланса до и после отчета
      const balanceEntries = await BalanceWheel.find({
        date: { $gte: startDate, $lte: endDate }
      }).populate('userId', 'name');

      const beforeEntries = balanceEntries.filter(entry => new Date(entry.date) < reportDate);
      const afterEntries = balanceEntries.filter(entry => new Date(entry.date) > reportDate);

      if (beforeEntries.length > 0 && afterEntries.length > 0) {
        // Анализируем изменения по каждой области баланса
        const balanceAreas = [
          'physical', 'emotional', 'intellectual', 'spiritual',
          'occupational', 'social', 'environmental', 'financial'
        ];

        const areaCorrelations = balanceAreas.map(area => {
          const beforeValues = beforeEntries.map(entry => entry[area as keyof typeof entry] as number);
          const afterValues = afterEntries.map(entry => entry[area as keyof typeof entry] as number);

          const beforeAvg = beforeValues.reduce((sum, val) => sum + val, 0) / beforeValues.length;
          const afterAvg = afterValues.reduce((sum, val) => sum + val, 0) / afterValues.length;
          const change = afterAvg - beforeAvg;

          const correlation = calculatePearsonCorrelation(beforeValues, afterValues);

          return {
            area,
            beforeReport: beforeAvg,
            afterReport: afterAvg,
            change,
            correlation
          };
        });

        // Рассчитываем общий баланс
        const overallBeforeBalance = areaCorrelations.reduce((sum, area) => sum + area.beforeReport, 0) / areaCorrelations.length;
        const overallAfterBalance = areaCorrelations.reduce((sum, area) => sum + area.afterReport, 0) / areaCorrelations.length;

        correlations.push({
          reportId: report._id.toString(),
          reportTitle: report.title,
          balanceAreas: areaCorrelations,
          overallBalance: {
            before: overallBeforeBalance,
            after: overallAfterBalance,
            improvement: overallAfterBalance - overallBeforeBalance
          }
        });
      }
    }

    return correlations;
  } catch (error) {
    console.error('[CorrelationService] Ошибка анализа корреляций колеса баланса:', error);
    throw error;
  }
};

// Сводная функция для получения всех корреляций
export const getComprehensiveCorrelationAnalysis = async (
  dateFrom?: Date,
  dateTo?: Date
) => {
  try {
    const [
      moodCorrelations,
      performancePatterns,
      balanceCorrelations
    ] = await Promise.all([
      analyzeReportMoodCorrelations(undefined, dateFrom, dateTo),
      analyzeTeamPerformancePatterns(6),
      analyzeBalanceWheelReportCorrelations(dateFrom, dateTo)
    ]);

    // Вычисляем общие инсайты
    const insights = {
      totalReportsAnalyzed: moodCorrelations.length,
      averageMoodImpact: moodCorrelations.length > 0 
        ? moodCorrelations.reduce((sum, corr) => sum + corr.correlations.beforeAfter.change, 0) / moodCorrelations.length
        : 0,
      mostEffectiveReportType: performancePatterns.length > 0 
        ? performancePatterns
            .flatMap(p => p.reportTypes)
            .reduce((best, current) => 
              current.avgMoodImpact > best.avgMoodImpact ? current : best, 
              { type: '', avgMoodImpact: -Infinity }
            ).type
        : '',
      overallTrend: performancePatterns.length > 0
        ? performancePatterns[performancePatterns.length - 1]?.moodTrend
        : 'stable'
    };

    return {
      moodCorrelations,
      performancePatterns,
      balanceCorrelations,
      insights,
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('[CorrelationService] Ошибка комплексного анализа корреляций:', error);
    throw error;
  }
}; 
