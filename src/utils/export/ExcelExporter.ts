import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ExcelExportData {
  sheets: ExcelSheet[];
  filename: string;
  title?: string;
}

interface ExcelSheet {
  name: string;
  data: any[][];
  headers?: string[];
  styles?: ExcelCellStyle[];
}

interface ExcelCellStyle {
  row: number;
  col: number;
  style: {
    font?: { bold?: boolean; color?: string; size?: number };
    fill?: { fgColor?: string };
    border?: any;
    alignment?: { horizontal?: string; vertical?: string };
  };
}

class ExcelExporter {
  private workbook: XLSX.WorkBook;

  constructor() {
    this.workbook = XLSX.utils.book_new();
  }

  /**
   * Основная функция экспорта данных в Excel
   */
  async exportData(exportData: ExcelExportData): Promise<void> {
    try {
      // Создаем листы
      for (const sheetData of exportData.sheets) {
        this.addSheet(sheetData);
      }

      // Генерируем Excel файл
      const workbookBuffer = XLSX.write(this.workbook, {
        bookType: 'xlsx',
        type: 'array'
      });

      // Сохраняем файл
      const blob = new Blob([workbookBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const fileName = `${exportData.filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, fileName);

    } catch (error) {
      console.error('Ошибка при экспорте Excel:', error);
      throw error;
    }
  }

  /**
   * Добавление листа в рабочую книгу
   */
  private addSheet(sheetData: ExcelSheet): void {
    let data = sheetData.data;

    // Добавляем заголовки, если они есть
    if (sheetData.headers) {
      data = [sheetData.headers, ...data];
    }

    // Создаем лист
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Применяем стили
    if (sheetData.styles) {
      this.applyStyles(worksheet, sheetData.styles);
    }

    // Автоподбор ширины колонок
    this.autoFitColumns(worksheet, data);

    // Добавляем лист в рабочую книгу
    XLSX.utils.book_append_sheet(this.workbook, worksheet, sheetData.name);
  }

  /**
   * Применение стилей к ячейкам
   */
  private applyStyles(worksheet: XLSX.WorkSheet, styles: ExcelCellStyle[]): void {
    if (!worksheet['!styles']) {
      worksheet['!styles'] = [];
    }

    styles.forEach(styleConfig => {
      const cellAddress = XLSX.utils.encode_cell({ r: styleConfig.row, c: styleConfig.col });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = styleConfig.style;
      }
    });
  }

  /**
   * Автоподбор ширины колонок
   */
  private autoFitColumns(worksheet: XLSX.WorkSheet, data: any[][]): void {
    const colWidths: number[] = [];

    data.forEach(row => {
      row.forEach((cell, colIndex) => {
        const cellLength = cell ? cell.toString().length : 0;
        colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, cellLength);
      });
    });

    worksheet['!cols'] = colWidths.map(width => ({ wch: Math.min(width + 2, 50) }));
  }

  /**
   * Экспорт отчетов команды
   */
  async exportTeamReports(reports: any[]): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Отчеты_команды',
      sheets: [
        {
          name: 'Обзор отчетов',
          headers: [
            'ID',
            'Заголовок',
            'Автор',
            'Тип',
            'Статус',
            'Дата создания',
            'Оценка влияния',
            'Участники',
            'Теги'
          ],
          data: reports.map(report => [
            report.id,
            report.title,
            report.author?.username || 'Неизвестно',
            this.getReportTypeText(report.type),
            this.getStatusText(report.status),
            new Date(report.createdAt).toLocaleDateString('ru-RU'),
            report.impactRating || 'Не оценено',
            report.participants?.map((p: any) => p.username).join(', ') || '',
            report.tags?.join(', ') || ''
          ]),
          styles: [
            // Стили для заголовков
            ...Array.from({ length: 9 }, (_, i) => ({
              row: 0,
              col: i,
              style: {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '2F5597' } },
                alignment: { horizontal: 'center' }
              }
            }))
          ]
        },
        {
          name: 'Статистика по типам',
          headers: ['Тип отчета', 'Количество', 'Процент', 'Средняя оценка'],
          data: this.generateTypeStatistics(reports)
        },
        {
          name: 'Статистика по авторам',
          headers: ['Автор', 'Количество отчетов', 'Средняя оценка', 'Последний отчет'],
          data: this.generateAuthorStatistics(reports)
        }
      ]
    };

    await this.exportData(exportData);
  }

  /**
   * Экспорт корреляционного анализа
   */
  async exportCorrelationAnalysis(correlationData: any): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Корреляционный_анализ',
      sheets: [
        {
          name: 'Сводка анализа',
          headers: ['Метрика', 'Значение'],
          data: [
            ['Общее количество отчетов', correlationData.totalReports],
            ['Проанализированный период', correlationData.period],
            ['Средний эффект на настроение (%)', correlationData.avgMoodImpact?.toFixed(1) || 'Н/Д'],
            ['Количество положительных корреляций', correlationData.positiveCorrelations],
            ['Количество отрицательных корреляций', correlationData.negativeCorrelations],
            ['Сильные корреляции (|r| > 0.7)', correlationData.strongCorrelations],
            ['Наиболее эффективный тип отчетов', correlationData.mostEffectiveType],
            ['Общий тренд команды', correlationData.trend]
          ]
        },
        {
          name: 'Корреляционная матрица',
          headers: ['Переменная 1', 'Переменная 2', 'Коэффициент корреляции', 'Значимость', 'Интерпретация'],
          data: correlationData.correlations?.map((corr: any) => [
            corr.variable1,
            corr.variable2,
            corr.coefficient?.toFixed(3),
            corr.significance,
            this.interpretCorrelation(corr.coefficient)
          ]) || []
        },
        {
          name: 'Влияние по типам отчетов',
          headers: ['Тип отчета', 'Количество', 'Средний эффект (%)', 'Стандартное отклонение'],
          data: correlationData.impactByType?.map((type: any) => [
            this.getReportTypeText(type.type),
            type.count,
            type.avgImpact?.toFixed(1),
            type.stdDev?.toFixed(2)
          ]) || []
        }
      ]
    };

    await this.exportData(exportData);
  }

  /**
   * Экспорт анализа тональности
   */
  async exportSentimentAnalysis(sentimentData: any): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Анализ_тональности',
      sheets: [
        {
          name: 'Обзор тональности',
          headers: ['Категория', 'Количество', 'Процент'],
          data: [
            ['Позитивные отчеты', sentimentData.positiveCount, `${sentimentData.positivePercentage}%`],
            ['Нейтральные отчеты', sentimentData.neutralCount, `${sentimentData.neutralPercentage}%`],
            ['Негативные отчеты', sentimentData.negativeCount, `${sentimentData.negativePercentage}%`]
          ]
        },
        {
          name: 'Эмоциональный анализ',
          headers: ['Эмоция', 'Средний уровень', 'Максимум', 'Минимум', 'Частота упоминаний'],
          data: sentimentData.emotions?.map((emotion: any) => [
            emotion.name,
            emotion.avgLevel?.toFixed(2),
            emotion.maxLevel?.toFixed(2),
            emotion.minLevel?.toFixed(2),
            emotion.frequency
          ]) || []
        },
        {
          name: 'Детализация по отчетам',
          headers: ['ID отчета', 'Заголовок', 'Общая тональность', 'Радость', 'Грусть', 'Гнев', 'Страх', 'Уверенность'],
          data: sentimentData.reportDetails?.map((report: any) => [
            report.id,
            report.title,
            report.overallSentiment?.toFixed(2),
            report.emotions?.joy?.toFixed(2) || 0,
            report.emotions?.sadness?.toFixed(2) || 0,
            report.emotions?.anger?.toFixed(2) || 0,
            report.emotions?.fear?.toFixed(2) || 0,
            report.emotions?.confidence?.toFixed(2) || 0
          ]) || []
        }
      ]
    };

    await this.exportData(exportData);
  }

  /**
   * Экспорт данных кластеризации игроков
   */
  async exportPlayerClustering(clusteringData: any): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Кластеризация_игроков',
      sheets: [
        {
          name: 'Обзор кластеров',
          headers: ['Кластер', 'Количество игроков', 'Описание', 'Характеристики'],
          data: clusteringData.clusters?.map((cluster: any) => [
            cluster.name,
            cluster.playerCount,
            cluster.description,
            cluster.characteristics.join('; ')
          ]) || []
        },
        {
          name: 'Распределение игроков',
          headers: ['Игрок', 'Кластер', 'Средняя активность', 'Средняя отзывчивость', 'Рекомендации'],
          data: clusteringData.playerAssignments?.map((assignment: any) => [
            assignment.playerName,
            assignment.clusterName,
            assignment.avgActivity?.toFixed(2),
            assignment.avgResponsiveness?.toFixed(2),
            assignment.recommendations?.join('; ') || ''
          ]) || []
        },
        {
          name: 'Метрики кластеров',
          headers: ['Кластер', 'Центр - Активность', 'Центр - Отзывчивость', 'Внутрикластерная дисперсия'],
          data: clusteringData.clusterMetrics?.map((metric: any) => [
            metric.clusterName,
            metric.centroid?.activity?.toFixed(3),
            metric.centroid?.responsiveness?.toFixed(3),
            metric.withinClusterVariance?.toFixed(3)
          ]) || []
        }
      ]
    };

    await this.exportData(exportData);
  }

  /**
   * Экспорт временных рядов и прогнозов
   */
  async exportTimeSeriesAnalysis(timeSeriesData: any): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Анализ_временных_рядов',
      sheets: [
        {
          name: 'Исторические данные',
          headers: ['Дата', 'Настроение команды', 'Количество отчетов', 'Активность', 'Тренд'],
          data: timeSeriesData.historicalData?.map((point: any) => [
            new Date(point.date).toLocaleDateString('ru-RU'),
            point.teamMood?.toFixed(2),
            point.reportCount,
            point.activity?.toFixed(2),
            point.trend
          ]) || []
        },
        {
          name: 'Прогнозы',
          headers: ['Дата', 'Прогноз настроения', 'Доверительный интервал (низ)', 'Доверительный интервал (верх)', 'Метод'],
          data: timeSeriesData.forecasts?.map((forecast: any) => [
            new Date(forecast.date).toLocaleDateString('ru-RU'),
            forecast.prediction?.toFixed(2),
            forecast.confidenceInterval?.lower?.toFixed(2),
            forecast.confidenceInterval?.upper?.toFixed(2),
            forecast.method
          ]) || []
        },
        {
          name: 'Статистика модели',
          headers: ['Метрика', 'Значение'],
          data: [
            ['R² (коэффициент детерминации)', timeSeriesData.modelStats?.rSquared?.toFixed(4)],
            ['RMSE (корень из среднеквадратичной ошибки)', timeSeriesData.modelStats?.rmse?.toFixed(4)],
            ['MAE (средняя абсолютная ошибка)', timeSeriesData.modelStats?.mae?.toFixed(4)],
            ['Тип тренда', timeSeriesData.modelStats?.trendType],
            ['Сезонность обнаружена', timeSeriesData.modelStats?.seasonalityDetected ? 'Да' : 'Нет'],
            ['Период анализа (дней)', timeSeriesData.modelStats?.analysisPeriod]
          ]
        }
      ]
    };

    await this.exportData(exportData);
  }

  /**
   * Экспорт комплексного отчета аналитики
   */
  async exportComprehensiveAnalytics(analyticsData: any): Promise<void> {
    const exportData: ExcelExportData = {
      filename: 'Комплексная_аналитика',
      sheets: [
        {
          name: 'Сводка',
          headers: ['Раздел', 'Ключевая метрика', 'Значение', 'Интерпретация'],
          data: [
            ['Отчеты', 'Общее количество', analyticsData.summary?.totalReports, 'Активность команды'],
            ['Тональность', 'Средний настрой (%)', analyticsData.summary?.avgSentiment?.toFixed(1), this.interpretSentiment(analyticsData.summary?.avgSentiment)],
            ['Корреляция', 'Сильные связи', analyticsData.summary?.strongCorrelations, 'Выявленные закономерности'],
            ['Кластеризация', 'Основной кластер', analyticsData.summary?.dominantCluster, 'Профиль команды'],
            ['Прогноз', 'Тренд на неделю', analyticsData.summary?.weeklyTrend, 'Ожидаемая динамика']
          ]
        }
      ]
    };

    // Добавляем дополнительные листы из других анализов
    if (analyticsData.sentiment) {
      exportData.sheets.push({
        name: 'Детали тональности',
        headers: ['Отчет', 'Тональность', 'Доминирующая эмоция', 'Уровень'],
        data: analyticsData.sentiment.details?.map((item: any) => [
          item.reportTitle,
          item.sentiment?.toFixed(2),
          item.dominantEmotion,
          item.emotionLevel?.toFixed(2)
        ]) || []
      });
    }

    if (analyticsData.correlations) {
      exportData.sheets.push({
        name: 'Значимые корреляции',
        headers: ['Переменная 1', 'Переменная 2', 'Коэффициент', 'P-значение'],
        data: analyticsData.correlations.significant?.map((corr: any) => [
          corr.var1,
          corr.var2,
          corr.coefficient?.toFixed(3),
          corr.pValue?.toFixed(4)
        ]) || []
      });
    }

    await this.exportData(exportData);
  }

  // Вспомогательные методы

  private getReportTypeText(type: string): string {
    const typeMap: { [key: string]: string } = {
      'team_meeting': 'Собрание команды',
      'performance_review': 'Обзор производительности',
      'mood_check': 'Проверка настроения',
      'feedback_session': 'Сессия обратной связи',
      'training_session': 'Тренировочная сессия',
      'match_analysis': 'Анализ матча',
      'strategy_discussion': 'Обсуждение стратегии',
      'other': 'Другое'
    };
    return typeMap[type] || type;
  }

  private getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'draft': 'Черновик',
      'published': 'Опубликован',
      'archived': 'Архивирован'
    };
    return statusMap[status] || status;
  }

  private generateTypeStatistics(reports: any[]): any[][] {
    const typeStats = reports.reduce((acc, report) => {
      const type = report.type;
      if (!acc[type]) {
        acc[type] = { count: 0, totalRating: 0 };
      }
      acc[type].count++;
      if (report.impactRating) {
        acc[type].totalRating += report.impactRating;
      }
      return acc;
    }, {} as any);

    return Object.entries(typeStats).map(([type, stats]: [string, any]) => [
      this.getReportTypeText(type),
      stats.count,
      `${((stats.count / reports.length) * 100).toFixed(1)}%`,
      stats.totalRating > 0 ? (stats.totalRating / stats.count).toFixed(1) : 'Не оценено'
    ]);
  }

  private generateAuthorStatistics(reports: any[]): any[][] {
    const authorStats = reports.reduce((acc, report) => {
      const author = report.author?.username || 'Неизвестно';
      if (!acc[author]) {
        acc[author] = { count: 0, totalRating: 0, lastReport: null };
      }
      acc[author].count++;
      if (report.impactRating) {
        acc[author].totalRating += report.impactRating;
      }
      if (!acc[author].lastReport || new Date(report.createdAt) > new Date(acc[author].lastReport)) {
        acc[author].lastReport = report.createdAt;
      }
      return acc;
    }, {} as any);

    return Object.entries(authorStats).map(([author, stats]: [string, any]) => [
      author,
      stats.count,
      stats.totalRating > 0 ? (stats.totalRating / stats.count).toFixed(1) : 'Не оценено',
      stats.lastReport ? new Date(stats.lastReport).toLocaleDateString('ru-RU') : 'Н/Д'
    ]);
  }

  private interpretCorrelation(coefficient: number): string {
    const abs = Math.abs(coefficient);
    if (abs < 0.3) return 'Слабая связь';
    if (abs < 0.7) return 'Умеренная связь';
    return 'Сильная связь';
  }

  private interpretSentiment(sentiment: number): string {
    if (sentiment > 0.6) return 'Положительный';
    if (sentiment < 0.4) return 'Отрицательный';
    return 'Нейтральный';
  }
}

export default ExcelExporter; 