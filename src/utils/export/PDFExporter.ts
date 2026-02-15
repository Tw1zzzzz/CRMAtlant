import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportData {
  title: string;
  subtitle?: string;
  generatedAt: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: 'text' | 'chart' | 'table' | 'metrics';
  content?: string;
  data?: any;
  chartElement?: HTMLElement;
  tableData?: TableData;
  metrics?: MetricCard[];
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface MetricCard {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

class PDFExporter {
  private pdf: jsPDF;
  private pageHeight: number = 297; // A4 height in mm
  private pageWidth: number = 210; // A4 width in mm
  private margins = { top: 20, bottom: 20, left: 15, right: 15 };
  private currentY: number = this.margins.top;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
  }

  /**
   * Основная функция экспорта отчета в PDF
   */
  async exportReport(data: ExportData): Promise<void> {
    try {
      // Добавляем заголовок
      this.addHeader(data.title, data.subtitle, data.generatedAt);
      
      // Добавляем содержание
      for (const section of data.sections) {
        await this.addSection(section);
      }

      // Добавляем номера страниц
      this.addPageNumbers();

      // Сохраняем файл
      const fileName = `${data.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      this.pdf.save(fileName);

    } catch (error) {
      console.error('Ошибка при экспорте PDF:', error);
      throw error;
    }
  }

  /**
   * Добавление заголовка отчета
   */
  private addHeader(title: string, subtitle?: string, generatedAt?: string): void {
    // Логотип или заголовок приложения
    this.pdf.setFontSize(24);
    this.pdf.setTextColor(47, 85, 151); // Цвет primary
    this.pdf.text('Esports Mood Tracker', this.margins.left, this.currentY);
    this.currentY += 15;

    // Основной заголовок
    this.pdf.setFontSize(18);
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text(title, this.margins.left, this.currentY);
    this.currentY += 10;

    // Подзаголовок
    if (subtitle) {
      this.pdf.setFontSize(12);
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text(subtitle, this.margins.left, this.currentY);
      this.currentY += 8;
    }

    // Дата генерации
    if (generatedAt) {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(150, 150, 150);
      const dateText = `Сгенерировано: ${new Date(generatedAt).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      this.pdf.text(dateText, this.margins.left, this.currentY);
      this.currentY += 15;
    }

    // Разделительная линия
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(this.margins.left, this.currentY, this.pageWidth - this.margins.right, this.currentY);
    this.currentY += 10;
  }

  /**
   * Добавление секции отчета
   */
  private async addSection(section: ReportSection): Promise<void> {
    // Проверяем, нужна ли новая страница
    if (this.currentY > this.pageHeight - 40) {
      this.addPage();
    }

    // Заголовок секции
    this.pdf.setFontSize(14);
    this.pdf.setTextColor(47, 85, 151);
    this.pdf.text(section.title, this.margins.left, this.currentY);
    this.currentY += 10;

    // Содержимое секции
    switch (section.type) {
      case 'text':
        this.addTextContent(section.content || '');
        break;
      case 'chart':
        if (section.chartElement) {
          await this.addChartContent(section.chartElement);
        }
        break;
      case 'table':
        if (section.tableData) {
          this.addTableContent(section.tableData);
        }
        break;
      case 'metrics':
        if (section.metrics) {
          this.addMetricsContent(section.metrics);
        }
        break;
    }

    this.currentY += 10; // Отступ после секции
  }

  /**
   * Добавление текстового содержимого
   */
  private addTextContent(content: string): void {
    const maxWidth = this.pageWidth - this.margins.left - this.margins.right;
    const lineHeight = 6;

    this.pdf.setFontSize(11);
    this.pdf.setTextColor(0, 0, 0);

    // Разбиваем текст на строки
    const lines = this.pdf.splitTextToSize(content, maxWidth);
    
    for (const line of lines) {
      // Проверяем, помещается ли строка на странице
      if (this.currentY + lineHeight > this.pageHeight - this.margins.bottom) {
        this.addPage();
      }
      
      this.pdf.text(line, this.margins.left, this.currentY);
      this.currentY += lineHeight;
    }
  }

  /**
   * Добавление графика (преобразование HTML элемента в изображение)
   */
  private async addChartContent(chartElement: HTMLElement): Promise<void> {
    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = this.pageWidth - this.margins.left - this.margins.right;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Проверяем, помещается ли изображение на странице
      if (this.currentY + imgHeight > this.pageHeight - this.margins.bottom) {
        this.addPage();
      }

      this.pdf.addImage(imgData, 'PNG', this.margins.left, this.currentY, imgWidth, imgHeight);
      this.currentY += imgHeight + 5;

    } catch (error) {
      console.error('Ошибка при добавлении графика в PDF:', error);
      // Добавляем заглушку
      this.addTextContent('[Ошибка загрузки графика]');
    }
  }

  /**
   * Добавление таблицы
   */
  private addTableContent(tableData: TableData): void {
    const maxWidth = this.pageWidth - this.margins.left - this.margins.right;
    const colWidth = maxWidth / tableData.headers.length;
    const rowHeight = 8;

    // Заголовки таблицы
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFillColor(47, 85, 151);
    
    tableData.headers.forEach((header, index) => {
      const x = this.margins.left + index * colWidth;
      this.pdf.rect(x, this.currentY, colWidth, rowHeight, 'F');
      this.pdf.text(header, x + 2, this.currentY + 5);
    });
    
    this.currentY += rowHeight;

    // Строки таблицы
    this.pdf.setTextColor(0, 0, 0);
    
    tableData.rows.forEach((row, rowIndex) => {
      // Проверяем, помещается ли строка на странице
      if (this.currentY + rowHeight > this.pageHeight - this.margins.bottom) {
        this.addPage();
        
        // Повторяем заголовки на новой странице
        this.pdf.setTextColor(255, 255, 255);
        this.pdf.setFillColor(47, 85, 151);
        
        tableData.headers.forEach((header, index) => {
          const x = this.margins.left + index * colWidth;
          this.pdf.rect(x, this.currentY, colWidth, rowHeight, 'F');
          this.pdf.text(header, x + 2, this.currentY + 5);
        });
        
        this.currentY += rowHeight;
        this.pdf.setTextColor(0, 0, 0);
      }

      // Альтернативная заливка строк
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(245, 245, 245);
        this.pdf.rect(this.margins.left, this.currentY, maxWidth, rowHeight, 'F');
      }

      // Ячейки строки
      row.forEach((cell, cellIndex) => {
        const x = this.margins.left + cellIndex * colWidth;
        this.pdf.text(cell, x + 2, this.currentY + 5);
      });

      this.currentY += rowHeight;
    });

    // Обводка таблицы
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margins.left, this.currentY - tableData.rows.length * rowHeight - rowHeight, maxWidth, (tableData.rows.length + 1) * rowHeight);
  }

  /**
   * Добавление метрик (карточки со статистикой)
   */
  private addMetricsContent(metrics: MetricCard[]): void {
    const cardsPerRow = 3;
    const cardWidth = (this.pageWidth - this.margins.left - this.margins.right - 10) / cardsPerRow;
    const cardHeight = 25;

    metrics.forEach((metric, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      
      const x = this.margins.left + col * (cardWidth + 5);
      const y = this.currentY + row * (cardHeight + 5);

      // Проверяем, помещается ли карточка на странице
      if (y + cardHeight > this.pageHeight - this.margins.bottom) {
        this.addPage();
        return;
      }

      // Фон карточки
      this.pdf.setFillColor(248, 249, 250);
      this.pdf.rect(x, y, cardWidth, cardHeight, 'F');

      // Рамка карточки
      this.pdf.setDrawColor(229, 231, 235);
      this.pdf.rect(x, y, cardWidth, cardHeight);

      // Заголовок метрики
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(107, 114, 128);
      this.pdf.text(metric.label, x + 3, y + 7);

      // Значение метрики
      this.pdf.setFontSize(16);
      this.pdf.setTextColor(0, 0, 0);
      const valueText = typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value;
      this.pdf.text(valueText.toString(), x + 3, y + 18);

      // Индикатор тренда
      if (metric.trend) {
        const trendSymbol = metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→';
        const trendColor = metric.trend === 'up' ? [34, 197, 94] : metric.trend === 'down' ? [239, 68, 68] : [107, 114, 128];
        
        this.pdf.setFontSize(12);
        this.pdf.setTextColor(trendColor[0], trendColor[1], trendColor[2]);
        this.pdf.text(trendSymbol, x + cardWidth - 15, y + 18);
      }
    });

    // Обновляем позицию Y
    const rows = Math.ceil(metrics.length / cardsPerRow);
    this.currentY += rows * (cardHeight + 5);
  }

  /**
   * Добавление новой страницы
   */
  private addPage(): void {
    this.pdf.addPage();
    this.currentY = this.margins.top;
  }

  /**
   * Добавление номеров страниц
   */
  private addPageNumbers(): void {
    const pageCount = this.pdf.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(150, 150, 150);
      
      const pageText = `Страница ${i} из ${pageCount}`;
      const textWidth = this.pdf.getTextWidth(pageText);
      
      this.pdf.text(
        pageText, 
        this.pageWidth - this.margins.right - textWidth, 
        this.pageHeight - 10
      );
    }
  }

  /**
   * Экспорт данных корреляционного анализа
   */
  async exportCorrelationAnalysis(correlationData: any): Promise<void> {
    const exportData: ExportData = {
      title: 'Отчет корреляционного анализа',
      subtitle: 'Анализ взаимосвязей между отчетами команды и метриками производительности',
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Общая статистика',
          type: 'metrics',
          metrics: [
            { label: 'Проанализировано отчетов', value: correlationData.totalReports },
            { label: 'Средний эффект на настроение', value: `${correlationData.avgMoodImpact.toFixed(1)}%` },
            { label: 'Положительных корреляций', value: correlationData.positiveCorrelations },
            { label: 'Сильных корреляций', value: correlationData.strongCorrelations }
          ]
        },
        {
          title: 'Ключевые выводы',
          type: 'text',
          content: `Анализ показал ${correlationData.strongCorrelations} сильных корреляций из ${correlationData.totalReports} проанализированных отчетов. Наиболее эффективный тип отчетов: ${correlationData.mostEffectiveType}. Общий тренд команды: ${correlationData.trend}.`
        }
      ]
    };

    await this.exportReport(exportData);
  }

  /**
   * Экспорт данных сентимент-анализа
   */
  async exportSentimentAnalysis(sentimentData: any): Promise<void> {
    const exportData: ExportData = {
      title: 'Отчет анализа тональности',
      subtitle: 'Эмоциональный анализ отчетов команды',
      generatedAt: new Date().toISOString(),
      sections: [
        {
          title: 'Распределение тональности',
          type: 'metrics',
          metrics: [
            { label: 'Позитивные отчеты', value: `${sentimentData.positivePercentage}%`, trend: 'up' },
            { label: 'Нейтральные отчеты', value: `${sentimentData.neutralPercentage}%`, trend: 'stable' },
            { label: 'Негативные отчеты', value: `${sentimentData.negativePercentage}%`, trend: 'down' }
          ]
        },
        {
          title: 'Анализ эмоционального тона',
          type: 'text',
          content: `Доминирующие эмоции в отчетах: ${sentimentData.dominantEmotions.join(', ')}. Средняя оценка тональности: ${sentimentData.averageSentiment}%. Рекомендации: ${sentimentData.recommendations.join(' ')}`
        }
      ]
    };

    await this.exportReport(exportData);
  }

  /**
   * Экспорт комплексного отчета команды
   */
  async exportTeamReport(teamData: any): Promise<void> {
    const exportData: ExportData = {
      title: teamData.title,
      subtitle: teamData.subtitle,
      generatedAt: teamData.createdAt,
      sections: [
        {
          title: 'Краткое изложение',
          type: 'text',
          content: teamData.summary
        },
        {
          title: 'Ключевые метрики',
          type: 'metrics',
          metrics: teamData.keyMetrics
        },
        {
          title: 'Детальный анализ',
          type: 'text',
          content: teamData.details
        },
        {
          title: 'Рекомендации',
          type: 'text',
          content: teamData.recommendations.join('\n\n')
        }
      ]
    };

    if (teamData.attachments && teamData.attachments.length > 0) {
      exportData.sections.push({
        title: 'Приложения',
        type: 'text',
        content: `Отчет содержит ${teamData.attachments.length} приложений. См. исходный отчет для доступа к файлам.`
      });
    }

    await this.exportReport(exportData);
  }
}

export default PDFExporter; 