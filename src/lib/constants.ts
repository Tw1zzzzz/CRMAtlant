/**
 * API URL для взаимодействия с сервером
 * В development режиме используется локальный сервер, в production - относительный путь
 */
export const API_URL = process.env.NODE_ENV === 'production' 
  ? '' 
  : '';

/**
 * Типы активности для истории 
 */
export const ACTIVITY_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  TEST_COMPLETE: 'test_complete',
  MOOD_TRACK: 'mood_track',
  FILE_UPLOAD: 'file_upload',
  BALANCE_WHEEL: 'balance_wheel'
};

/**
 * Типы сущностей для истории
 */
export const ENTITY_TYPES = {
  USER: 'user',
  MOOD: 'mood',
  TEST: 'test',
  FILE: 'file',
  BALANCE_WHEEL: 'balance_wheel',
  SYSTEM: 'system'
}; 
