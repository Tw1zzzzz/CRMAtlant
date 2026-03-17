/**
 * Типы для статистики и аналитики
 */

/** Временные периоды для статистики */
export enum TimePeriod {
  WEEK = 'week',
  MONTH = 'month',
  THREE_MONTHS = '3months',
  YEAR = 'year',
  ALL_TIME = 'all'
}

/** Метаданные временных периодов */
export const TIME_PERIOD_METADATA: Record<TimePeriod, { 
  label: string; 
  days: number;
  dateFormat: string;
}> = {
  [TimePeriod.WEEK]: {
    label: 'Неделя',
    days: 7,
    dateFormat: 'dd.MM'
  },
  [TimePeriod.MONTH]: {
    label: 'Месяц', 
    days: 30,
    dateFormat: 'dd.MM'
  },
  [TimePeriod.THREE_MONTHS]: {
    label: '3 месяца',
    days: 90,
    dateFormat: 'MM.yyyy'
  },
  [TimePeriod.YEAR]: {
    label: 'Год',
    days: 365,
    dateFormat: 'MM.yyyy'
  },
  [TimePeriod.ALL_TIME]: {
    label: 'Все время',
    days: -1,
    dateFormat: 'yyyy'
  }
};

/** Данные статистики */
export interface StatsData {
  date: string;
  mood: number;
  energy: number;
  sleepHours?: number;
}

/** Данные за неделю */
export interface WeeklyData {
  date?: string;
  week?: string;
  mood?: number;
  energy?: number;
  moodAvg?: number;
  energyAvg?: number;
  testsCompleted?: number;
}

/** Агрегированная статистика */
export interface AggregatedStats {
  period: TimePeriod;
  averageMood: number;
  averageEnergy: number;
  totalEntries: number;
  moodTrend: 'up' | 'down' | 'stable';
  energyTrend: 'up' | 'down' | 'stable';
  bestDay: string;
  worstDay: string;
  consistency: number; // Процент дней с записями
}

/** Статистика игрока */
export interface PlayerStats {
  userId: string;
  playerName: string;
  joinDate: string;
  totalMoodEntries: number;
  totalTestEntries: number;
  averageMood: number;
  averageEnergy: number;
  lastActive: string;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
}

/** Сравнительная статистика */
export interface ComparativeStats {
  playerId: string;
  playerName: string;
  metric: 'mood' | 'energy' | 'tests' | 'balance';
  value: number;
  teamAverage: number;
  percentile: number;
  rank: number;
  totalPlayers: number;
}

/** Данные для графиков */
export interface ChartDataPoint {
  name: string;
  date?: string;
  mood?: number;
  energy?: number;
  tests?: number;
  [key: string]: any;
}

/** Конфигурация графика */
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'radar' | 'area';
  dataKey: string[];
  colors: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  yAxisDomain?: [number, number];
} 
