import axios from 'axios';
import { API_URL } from '@/lib/constants';

/**
 * Интерфейс для записи активности
 */
export interface ActivityHistoryItem {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  };
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'test_complete' | 'mood_track' | 'file_upload' | 'balance_wheel';
  entityType: 'user' | 'mood' | 'test' | 'file' | 'balance_wheel' | 'system';
  entityId?: string;
  details?: any;
  timestamp: string;
}

/**
 * Интерфейс для пагинации
 */
export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Интерфейс для периода
 */
export interface PeriodData {
  start: string;
  end: string;
}

/**
 * Сервис для работы с историей активности
 */
const activityHistoryService = {
  /**
   * Создать запись активности
   */
  createActivity: async (
    action: ActivityHistoryItem['action'],
    entityType: ActivityHistoryItem['entityType'],
    entityId?: string,
    details?: any
  ): Promise<ActivityHistoryItem> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }

      const response = await axios.post(
        `${API_URL}/api/history`,
        { action, entityType, entityId, details },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.data.activity;
    } catch (error) {
      console.error('Ошибка при создании записи активности:', error);
      throw error;
    }
  },
  
  /**
   * Получить историю активности пользователя
   */
  getUserActivity: async (page = 1, limit = 20): Promise<{
    activities: ActivityHistoryItem[];
    pagination: PaginationData;
  }> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const response = await axios.get(
        `${API_URL}/api/history?page=${page}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return {
        activities: response.data.data.activities,
        pagination: response.data.data.pagination
      };
    } catch (error) {
      console.error('Ошибка при получении истории активности:', error);
      throw error;
    }
  },
  
  /**
   * Получить всю историю активности (для персонала)
   */
  getAllActivity: async (
    page = 1, 
    limit = 20, 
    userId?: string, 
    action?: ActivityHistoryItem['action'],
    entityType?: ActivityHistoryItem['entityType']
  ): Promise<{
    activities: ActivityHistoryItem[];
    users: any[];
    pagination: PaginationData;
  }> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      // Формируем параметры запроса
      const params: Record<string, string | number> = { page, limit };
      if (userId) params.userId = userId;
      if (action) params.action = action;
      if (entityType) params.entityType = entityType;
      
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      const response = await axios.get(
        `${API_URL}/api/history/all?${queryString}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return {
        activities: response.data.data.activities,
        users: response.data.data.users,
        pagination: response.data.data.pagination
      };
    } catch (error) {
      console.error('Ошибка при получении истории активности:', error);
      throw error;
    }
  },
  
  /**
   * Получить статистику активности (для персонала)
   */
  getActivityStats: async (): Promise<{
    actionStats: { _id: string; count: number }[];
    entityStats: { _id: string; count: number }[];
    userStats: any[];
  }> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const response = await axios.get(
        `${API_URL}/api/history/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при получении статистики активности:', error);
      throw error;
    }
  },
  
  /**
   * Получить месячную активность
   */
  getMonthlyActivity: async (): Promise<{
    activities: ActivityHistoryItem[];
    period: PeriodData;
  }> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      console.log('[History Service] Отправка запроса на получение месячной активности...');
      const response = await axios.get(
        `${API_URL}/api/history/monthly`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('[History Service] Получен ответ от API:', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataSize: JSON.stringify(response.data).length,
        dataStructure: response.data ? Object.keys(response.data) : 'нет данных'
      });
      
      // Детальный анализ ответа API
      if (response.data) {
        console.log('[History Service] Структура данных:', {
          status: response.data.status,
          hasDataField: !!response.data.data,
          activitiesCount: response.data.data?.activities?.length || 0,
          hasPeriod: !!response.data.data?.period
        });
      }
      
      // Проверяем, есть ли данные в ответе
      if (!response.data || !response.data.data) {
        console.warn('[History Service] API не вернул данные в ожидаемом формате:', response);
        
        // Создаем текущий период как запасной вариант
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        return {
          activities: [],
          period: {
            start: startOfMonth.toISOString(),
            end: endOfMonth.toISOString()
          }
        };
      }
      
      // Получаем данные из ответа
      const activities = response.data.data.activities || [];
      console.log(`[History Service] Получено ${activities.length} записей активности за месяц`);
      
      // Проверяем, есть ли записи о настроении (mood_track)
      const moodTrackActivities = activities.filter(a => a.action === 'mood_track');
      console.log(`[History Service] Найдено записей о настроении: ${moodTrackActivities.length}`);
      
      // Выводим первую запись для диагностики, если она есть
      if (activities.length > 0) {
        const firstActivity = activities[0];
        console.log('[History Service] Пример записи активности:', {
          id: firstActivity._id,
          user: typeof firstActivity.userId === 'object' 
            ? `${(firstActivity.userId as any)?.name || 'Нет имени'} (ID: ${(firstActivity.userId as any)?._id || 'Нет ID'})` 
            : `ID: ${String(firstActivity.userId)}`,
          action: firstActivity.action,
          entityType: firstActivity.entityType,
          timestamp: firstActivity.timestamp,
          details: firstActivity.details
        });
      } else {
        console.log('[History Service] Записи активности не найдены');
      }
      
      // Проверяем наличие данных о периоде или создаем их
      let period: PeriodData;
      if (response.data.data.period) {
        // Проверяем корректность формата дат
        let start = response.data.data.period.start;
        let end = response.data.data.period.end;
        
        // Проверка на валидность дат, преобразование ISO строки в объект Date и обратно
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Проверяем, что даты валидны
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn('[History Service] Получены некорректные даты периода:', start, end);
            throw new Error('Некорректные даты периода');
          }
          
          period = {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          };
        } catch (e) {
          console.error('[History Service] Ошибка при обработке дат периода:', e);
          
          // Если даты некорректны, используем текущий месяц
          const now = new Date();
          period = {
            start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
          };
        }
      } else {
        // Если период не указан, используем текущий месяц
        const now = new Date();
        period = {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
        };
      }
      
      return {
        activities,
        period
      };
    } catch (error) {
      console.error('[History Service] Ошибка при получении месячной активности:', error);
      
      // Возвращаем пустой массив и период текущего месяца в случае ошибки
      const now = new Date();
      return {
        activities: [],
        period: {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
        }
      };
    }
  },
  
  /**
   * Форматирование времени в удобный формат
   */
  formatTimestamp: (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  /**
   * Получение человекочитаемого названия действия
   */
  getActionName: (action: ActivityHistoryItem['action']): string => {
    const actionNames: Record<ActivityHistoryItem['action'], string> = {
      create: 'Создание',
      update: 'Обновление',
      delete: 'Удаление',
      login: 'Вход',
      logout: 'Выход',
      test_complete: 'Завершение теста',
      mood_track: 'Запись настроения',
      file_upload: 'Загрузка файла',
      balance_wheel: 'Обновление колеса баланса'
    };
    
    return actionNames[action] || action;
  },
  
  /**
   * Получение человекочитаемого названия типа сущности
   */
  getEntityTypeName: (entityType: ActivityHistoryItem['entityType']): string => {
    const entityTypeNames: Record<ActivityHistoryItem['entityType'], string> = {
      user: 'Пользователь',
      mood: 'Настроение',
      test: 'Тест',
      file: 'Файл',
      balance_wheel: 'Колесо баланса',
      system: 'Система'
    };
    
    return entityTypeNames[entityType] || entityType;
  },
  
  /**
   * Форматирование даты периода в человекочитаемый формат
   */
  formatPeriodDate: (date: Date | string): string => {
    if (!date) return '';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      if (isNaN(dateObj.getTime())) {
        return 'Некорректная дата';
      }
      
      return dateObj.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return 'Ошибка формата';
    }
  },
  
  /**
   * Форматирование периода в человекочитаемый формат
   */
  formatPeriodRange: (start: Date, end: Date): string => {
    return `${activityHistoryService.formatPeriodDate(start)} - ${activityHistoryService.formatPeriodDate(end)}`;
  }
};

export default activityHistoryService; 