import axios from "axios";

// Задаем базовый URL для API
const baseUrl = process.env.NODE_ENV === 'production' ? '' : '';

/**
 * Универсальная функция для обработки ошибок API
 * @param error - Объект ошибки от axios
 * @param defaultMessage - Сообщение по умолчанию, если ошибка не имеет стандартного формата
 * @returns Сообщение об ошибке в читаемом формате
 */
export const handleApiError = (error: any, defaultMessage: string): string => {
  console.error('[API] Ошибка:', error);
  
  if (!error.response) {
    return error.request ? 'Сервер не отвечает' : defaultMessage;
  }
  
  if (error.response.data?.message) {
    return error.response.data.message;
  }
  
  // Обработка типовых статус-кодов
  switch (error.response.status) {
    case 400: return 'Некорректные данные';
    case 401: return 'Неверные учетные данные или истек токен авторизации';
    case 403: return 'Доступ запрещен';
    case 409: return 'Пользователь с таким email уже существует';
    case 404: return 'Ресурс не найден';
    case 500: return 'Внутренняя ошибка сервера';
    default: return defaultMessage;
  }
};

/**
 * Функция для выполнения авторизованных запросов к API
 * @param method - HTTP метод запроса
 * @param endpoint - Конечная точка API (без базового URL и /api)
 * @param data - Данные для отправки (для POST, PUT)
 * @returns Промис с данными ответа, типизированный с помощью generic параметра T
 */
export const makeAuthRequest = async <T,>(
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  data?: any
): Promise<T> => {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const config = {
      method,
      url: `${baseUrl}/api${endpoint}`,
      headers,
      data,
      timeout: 15000
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error: any) {
    // Если токен устарел или недействителен, очищаем его из localStorage
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
    }
    throw error;
  }
};

/**
 * Функция для выполнения запросов к API без авторизации
 * @param method - HTTP метод запроса 
 * @param endpoint - Конечная точка API (без базового URL и /api)
 * @param data - Данные для отправки (для POST, PUT)
 * @returns Промис с данными ответа, типизированный с помощью generic параметра T
 */
export const makeApiRequest = async <T,>(
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  data?: any
): Promise<T> => {
  const config = {
    method,
    url: `${baseUrl}/api${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    data,
    timeout: 15000
  };
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw error;
  }
}; 
