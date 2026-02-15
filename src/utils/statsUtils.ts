/**
 * Утилиты для работы со статистикой и аналитикой
 */

import { 
  MoodEntry, 
  TestEntry, 
  StatsData, 
  WeeklyData,
  TimePeriod,
  TIME_PERIOD_METADATA,
  ChartDataPoint,
  AggregatedStats,
  TestType,
  TEST_TYPE_METADATA
} from "@/types";
import { 
  format, 
  subDays, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isAfter,
  isBefore,
  parseISO,
  differenceInDays
} from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Константы для статистических расчетов
 */
export const STATS_CONSTANTS = {
  WEEKDAYS: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
  SHORT_WEEKDAYS: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  MIN_ENTRIES_FOR_TREND: 3,
  CONSISTENCY_THRESHOLD: 0.7, // 70% дней с записями считается хорошей консистентностью
} as const;

/**
 * Вспомогательные функции для работы с датами
 */
export const dateHelpers = {
  /**
   * Получает начальную дату для временного периода
   */
  getStartDate: (period: TimePeriod, baseDate = new Date()): Date => {
    switch (period) {
      case TimePeriod.WEEK:
        return subDays(baseDate, 7);
      case TimePeriod.MONTH:
        return subDays(baseDate, 30);
      case TimePeriod.THREE_MONTHS:
        return subMonths(baseDate, 3);
      case TimePeriod.YEAR:
        return subMonths(baseDate, 12);
      case TimePeriod.ALL_TIME:
        return new Date(2020, 0, 1); // Дата запуска системы
      default:
        return subDays(baseDate, 7);
    }
  },

  /**
   * Проверяет, находится ли дата в заданном периоде
   */
  isDateInPeriod: (date: Date | string, period: TimePeriod, baseDate = new Date()): boolean => {
    const targetDate = typeof date === 'string' ? parseISO(date) : date;
    const startDate = dateHelpers.getStartDate(period, baseDate);
    
    return isAfter(targetDate, startDate) && isBefore(targetDate, baseDate) || 
           targetDate.getTime() === baseDate.getTime();
  },

  /**
   * Конвертирует индекс дня недели JS в русский формат
   */
  convertDayIndex: (jsIndex: number): number => {
    return jsIndex === 0 ? 6 : jsIndex - 1;
  }
};

/**
 * Возвращает количество дней в зависимости от выбранного периода времени
 */
export const daysInPeriod = (timeRange: TimePeriod): number => {
  return TIME_PERIOD_METADATA[timeRange]?.days || 7;
};

/**
 * Возвращает метку для выбранного периода времени
 */
export const timeRangeLabel = (timeRange: TimePeriod): string => {
  return TIME_PERIOD_METADATA[timeRange]?.label || "Неделя";
};

/**
 * Возвращает данные о настроении по дням недели с улучшенной обработкой
 */
export const getMoodByDayOfWeek = (entries: MoodEntry[]): ChartDataPoint[] => {
  if (!entries.length) return [];

  // Инициализация массива с нулевыми значениями для каждого дня
  const result = STATS_CONSTANTS.WEEKDAYS.map(day => ({
    name: day,
    mood: 0,
    energy: 0,
    count: 0,
  }));
  
  // Агрегация данных по дням недели
  entries.forEach(entry => {
    try {
      const date = new Date(entry.date);
      const dayIndex = dateHelpers.convertDayIndex(date.getDay());
      
      if (dayIndex >= 0 && dayIndex < result.length) {
        result[dayIndex].mood += entry.mood;
        result[dayIndex].energy += entry.energy;
        result[dayIndex].count += 1;
      }
    } catch (error) {
      console.warn('Некорректная дата в записи настроения:', entry.date);
    }
  });
  
  // Рассчитываем средние значения
  return result.map(item => ({
    name: item.name,
    mood: item.count ? Number((item.mood / item.count).toFixed(1)) : 0,
    energy: item.count ? Number((item.energy / item.count).toFixed(1)) : 0,
  }));
};

/**
 * Возвращает данные о тестах по дням недели с поддержкой типов тестов
 */
export const getTestsByDayOfWeek = (entries: TestEntry[]): ChartDataPoint[] => {
  if (!entries.length) return [];

  const testsByDay = STATS_CONSTANTS.WEEKDAYS.map(day => ({
    name: day,
    count: 0,
    average: 0,
    total: 0,
    byType: {} as Record<string, { count: number; total: number }>
  }));
  
  entries.forEach(entry => {
    try {
      const date = new Date(entry.date);
      const dayIndex = dateHelpers.convertDayIndex(date.getDay());
      
      if (dayIndex >= 0 && dayIndex < testsByDay.length) {
        const dayData = testsByDay[dayIndex];
        
        dayData.count += 1;
        dayData.total += entry.score;
        
        // Группировка по типам тестов
        if (!dayData.byType[entry.type]) {
          dayData.byType[entry.type] = { count: 0, total: 0 };
        }
        dayData.byType[entry.type].count += 1;
        dayData.byType[entry.type].total += entry.score;
      }
    } catch (error) {
      console.warn('Некорректная дата в записи теста:', entry.date);
    }
  });
  
  return testsByDay.map(item => ({
    name: item.name,
    count: item.count,
    average: item.count ? Number((item.total / item.count).toFixed(1)) : 0,
    ...Object.entries(item.byType).reduce((acc, [type, data]) => {
      acc[type] = Number((data.total / data.count).toFixed(1));
      return acc;
    }, {} as Record<string, number>)
  }));
};

/**
 * Возвращает данные для графика в необходимом формате
 */
export const getChartData = (entries: MoodEntry[]): ChartDataPoint[] => {
  if (!entries.length) return [];

  return entries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(entry => {
      try {
        const date = new Date(entry.date);
        return {
          name: STATS_CONSTANTS.SHORT_WEEKDAYS[date.getDay()],
          date: format(date, 'dd.MM.yyyy'),
          mood: entry.mood,
          energy: entry.energy
        };
      } catch (error) {
        console.warn('Некорректная дата в записи:', entry.date);
        return {
          name: 'N/A',
          date: entry.date,
          mood: entry.mood,
          energy: entry.energy
        };
      }
    });
};

/**
 * Возвращает данные об активности игрока для графика
 */
export const getPlayerActivityChartData = (playerData: any): ChartDataPoint[] => {
  if (!playerData?.weeklyStats?.length) return [];
  
  return playerData.weeklyStats.map((stat: WeeklyData) => ({
    name: stat.week || 'N/A',
    mood: stat.moodAvg || 0,
    energy: stat.energyAvg || 0,
    tests: stat.testsCompleted || 0
  }));
};

/**
 * Подготавливает данные о настроении для графиков на основе временного периода
 */
export const prepareMoodDataByTimeRange = (
  entries: MoodEntry[], 
  timeRange: TimePeriod
): StatsData[] => {
  if (!entries.length) return [];
  
  const now = new Date();
  const startDate = dateHelpers.getStartDate(timeRange, now);
  const dateFormat = TIME_PERIOD_METADATA[timeRange]?.dateFormat || 'dd.MM';
  
  // Создаем массив дат для выбранного периода
  const dates = eachDayOfInterval({ start: startDate, end: now });
  
  // Инициализируем данные для каждой даты
  const initialData = dates.map(date => ({
    date: format(date, dateFormat, { locale: ru }),
    fullDate: format(date, 'yyyy-MM-dd'),
    mood: 0,
    energy: 0,
    count: 0
  }));
  
  // Фильтруем записи для выбранного периода
  const filteredEntries = entries.filter(entry => 
    dateHelpers.isDateInPeriod(entry.date, timeRange, now)
  );
  
  // Агрегируем данные по датам
  filteredEntries.forEach(entry => {
    try {
      const entryDate = new Date(entry.date);
      const dateString = format(entryDate, dateFormat, { locale: ru });
      
      const dataIndex = initialData.findIndex(item => item.date === dateString);
      if (dataIndex !== -1) {
        initialData[dataIndex].mood += entry.mood;
        initialData[dataIndex].energy += entry.energy;
        initialData[dataIndex].count += 1;
      }
    } catch (error) {
      console.warn('Ошибка обработки записи настроения:', entry);
    }
  });
  
  // Рассчитываем средние значения
  return initialData.map(item => ({
    date: item.date,
    mood: item.count ? Number((item.mood / item.count).toFixed(1)) : 0,
    energy: item.count ? Number((item.energy / item.count).toFixed(1)) : 0
  }));
};

/**
 * Подготавливает данные о тестах для графиков на основе временного периода
 */
export const prepareTestDataByTimeRange = (
  entries: TestEntry[], 
  timeRange: TimePeriod
): ChartDataPoint[] => {
  if (!entries.length) return [];
  
  const now = new Date();
  const startDate = dateHelpers.getStartDate(timeRange, now);
  const dateFormat = TIME_PERIOD_METADATA[timeRange]?.dateFormat || 'dd.MM';
  
  // Фильтруем записи для выбранного периода
  const filteredEntries = entries.filter(entry => 
    dateHelpers.isDateInPeriod(entry.date, timeRange, now)
  );
  
  // Группируем результаты тестов по типу и дате
  const groupedTests: Record<string, Record<string, { total: number; count: number }>> = {};
  
  filteredEntries.forEach(entry => {
    try {
      const entryDate = new Date(entry.date);
      const dateString = format(entryDate, dateFormat, { locale: ru });
      
      if (!groupedTests[dateString]) {
        groupedTests[dateString] = {};
      }
      
      if (!groupedTests[dateString][entry.type]) {
        groupedTests[dateString][entry.type] = { total: 0, count: 0 };
      }
      
      groupedTests[dateString][entry.type].total += entry.score;
      groupedTests[dateString][entry.type].count += 1;
    } catch (error) {
      console.warn('Ошибка обработки записи теста:', entry);
    }
  });
  
  // Получаем все типы тестов
  const testTypes = [...new Set(filteredEntries.map(entry => entry.type))];
  
  // Преобразуем данные в формат для графика
  return Object.keys(groupedTests)
    .sort()
    .map(date => {
      const result: ChartDataPoint = { name: date, date };
      
      testTypes.forEach(type => {
        const typeData = groupedTests[date]?.[type];
        if (typeData) {
          result[type] = Number((typeData.total / typeData.count).toFixed(1));
        } else {
          result[type] = 0;
        }
      });
      
      return result;
    });
};

/**
 * Подготавливает данные о распределении типов тестов для круговой диаграммы
 */
export const prepareTestDistribution = (entries: TestEntry[]): ChartDataPoint[] => {
  if (!entries.length) return [];
  
  const testCounts: Record<string, number> = {};
  
  entries.forEach(entry => {
    const testType = entry.type as TestType;
    const label = TEST_TYPE_METADATA[testType]?.label || entry.type;
    
    if (!testCounts[label]) {
      testCounts[label] = 0;
    }
    testCounts[label] += 1;
  });
  
  return Object.entries(testCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Вычисляет агрегированную статистику для набора записей настроения
 */
export const calculateAggregatedStats = (
  entries: MoodEntry[],
  period: TimePeriod
): AggregatedStats => {
  if (!entries.length) {
    return {
      period,
      averageMood: 0,
      averageEnergy: 0,
      totalEntries: 0,
      moodTrend: 'stable',
      energyTrend: 'stable',
      bestDay: 'N/A',
      worstDay: 'N/A',
      consistency: 0
    };
  }

  const now = new Date();
  const startDate = dateHelpers.getStartDate(period, now);
  const totalDays = differenceInDays(now, startDate);
  
  // Фильтруем записи по периоду
  const filteredEntries = entries.filter(entry => 
    dateHelpers.isDateInPeriod(entry.date, period, now)
  );

  // Базовые метрики
  const totalMood = filteredEntries.reduce((sum, entry) => sum + entry.mood, 0);
  const totalEnergy = filteredEntries.reduce((sum, entry) => sum + entry.energy, 0);
  const averageMood = Number((totalMood / filteredEntries.length).toFixed(1));
  const averageEnergy = Number((totalEnergy / filteredEntries.length).toFixed(1));

  // Поиск лучшего и худшего дня
  const sortedByMood = [...filteredEntries].sort((a, b) => {
    const scoreA = (a.mood + a.energy) / 2;
    const scoreB = (b.mood + b.energy) / 2;
    return scoreB - scoreA;
  });
  
  const bestDay = sortedByMood[0] ? format(new Date(sortedByMood[0].date), 'dd.MM.yyyy') : 'N/A';
  const worstDay = sortedByMood[sortedByMood.length - 1] ? 
    format(new Date(sortedByMood[sortedByMood.length - 1].date), 'dd.MM.yyyy') : 'N/A';

  // Расчет трендов (требует минимум 3 записи)
  let moodTrend: 'up' | 'down' | 'stable' = 'stable';
  let energyTrend: 'up' | 'down' | 'stable' = 'stable';

  if (filteredEntries.length >= STATS_CONSTANTS.MIN_ENTRIES_FOR_TREND) {
    const sortedEntries = [...filteredEntries].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const firstThird = sortedEntries.slice(0, Math.floor(sortedEntries.length / 3));
    const lastThird = sortedEntries.slice(-Math.floor(sortedEntries.length / 3));
    
    const firstMoodAvg = firstThird.reduce((sum, e) => sum + e.mood, 0) / firstThird.length;
    const lastMoodAvg = lastThird.reduce((sum, e) => sum + e.mood, 0) / lastThird.length;
    const firstEnergyAvg = firstThird.reduce((sum, e) => sum + e.energy, 0) / firstThird.length;
    const lastEnergyAvg = lastThird.reduce((sum, e) => sum + e.energy, 0) / lastThird.length;
    
    moodTrend = lastMoodAvg > firstMoodAvg + 0.5 ? 'up' : 
                lastMoodAvg < firstMoodAvg - 0.5 ? 'down' : 'stable';
    energyTrend = lastEnergyAvg > firstEnergyAvg + 0.5 ? 'up' : 
                  lastEnergyAvg < firstEnergyAvg - 0.5 ? 'down' : 'stable';
  }

  // Расчет консистентности (процент дней с записями)
  const uniqueDays = new Set(filteredEntries.map(entry => 
    format(new Date(entry.date), 'yyyy-MM-dd')
  )).size;
  const consistency = Number((uniqueDays / totalDays).toFixed(2));

  return {
    period,
    averageMood,
    averageEnergy,
    totalEntries: filteredEntries.length,
    moodTrend,
    energyTrend,
    bestDay,
    worstDay,
    consistency
  };
}; 