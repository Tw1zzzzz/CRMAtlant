/**
 * Типы, связанные с отслеживанием настроения и тестов
 */

/** Минимальное и максимальное значение для оценок */
export const MOOD_SCALE = {
  MIN: 1,
  MAX: 10
} as const;

/** Запись о настроении */
export interface MoodEntry {
  readonly id: string;
  date: string;
  mood: number;
  energy: number;
  notes?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Данные для создания записи о настроении */
export interface CreateMoodEntryDto {
  date: string;
  mood: number;
  energy: number;
  notes?: string;
}

/** Запись о тесте */
export interface TestEntry {
  readonly id: string;
  date: string | Date;
  name?: string;
  link?: string;
  screenshotUrl?: string;
  isWeeklyTest?: boolean;
  type?: string;
  score?: number;
  testType?: string;
  scoreNormalized?: number;
  rawScore?: number;
  unit?: string;
  durationSec?: number;
  attempts?: number;
  stateSnapshot?: {
    fatigue?: number;
    focus?: number;
    stress?: number;
    sleepHours?: number;
    mood?: number;
    energy?: number;
  };
  context?: {
    matchType?: string;
    map?: string;
    role?: string;
    source?: string;
    notes?: string;
  };
  measuredAt?: string | Date;
  notes?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Данные для создания записи о тесте */
export interface CreateTestEntryDto {
  date: string | Date;
  type?: string;
  score?: number;
  name?: string;
  link?: string;
  testType?: string;
  scoreNormalized?: number;
  rawScore?: number;
  notes?: string;
}

/** Типы тестов */
export enum TestType {
  COGNITIVE = 'cognitive',
  REACTION = 'reaction',
  ACCURACY = 'accuracy',
  STRATEGY = 'strategy',
  TEAMWORK = 'teamwork'
}

/** Метаданные для типов тестов */
export const TEST_TYPE_METADATA: Record<TestType, { label: string; description: string }> = {
  [TestType.COGNITIVE]: {
    label: 'Когнитивный',
    description: 'Тест на когнитивные способности'
  },
  [TestType.REACTION]: {
    label: 'Реакция',
    description: 'Тест на скорость реакции'
  },
  [TestType.ACCURACY]: {
    label: 'Точность',
    description: 'Тест на точность действий'
  },
  [TestType.STRATEGY]: {
    label: 'Стратегия',
    description: 'Тест на стратегическое мышление'
  },
  [TestType.TEAMWORK]: {
    label: 'Командная работа',
    description: 'Тест на командное взаимодействие'
  }
}; 
