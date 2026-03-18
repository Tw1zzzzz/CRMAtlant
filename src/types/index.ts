/**
 * Центральный файл для экспорта всех типов приложения
 */

// Реэкспорт типов пользователя
export * from './user.types';

// Реэкспорт типов настроения и тестов
export * from './mood.types';

// Реэкспорт типов колеса баланса
export * from './balance-wheel.types';

// Реэкспорт типов статистики
export * from './statistics.types';
export * from './brain.types';

// Дополнительные общие типы
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

