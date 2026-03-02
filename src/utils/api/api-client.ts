/**
 * Современный типизированный API клиент
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

// Типы для API ответов
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  details?: any;
  timestamp: string;
}

// Перечисление HTTP методов
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE'
}

// Конфигурация API клиента
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  onTokenExpired?: () => void;
}

/**
 * Класс для работы с API
 */
export class ApiClient {
  private client: AxiosInstance;
  private tokenKey = 'token';
  private onTokenExpired?: () => void;

  constructor(config: ApiClientConfig) {
    this.onTokenExpired = config.onTokenExpired;
    
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers
      },
      withCredentials: config.withCredentials || false
    });

    this.setupInterceptors();
  }

  /**
   * Настройка перехватчиков запросов и ответов
   */
  private setupInterceptors(): void {
    // Перехватчик запросов - добавляем токен авторизации
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Перехватчик ответов - обработка ошибок
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError = this.handleError(error);
        
        // Если токен истек, вызываем callback
        if (apiError.statusCode === 401) {
          this.removeAuthToken();
          this.onTokenExpired?.();
        }
        
        return Promise.reject(apiError);
      }
    );
  }

  /**
   * Обработка ошибок в единообразный формат
   */
  private handleError(error: AxiosError<any>): ApiError {
    const timestamp = new Date().toISOString();
    
    if (!error.response) {
      // Ошибка сети или таймаут
      return {
        message: error.request ? 'Сервер не отвечает' : 'Ошибка сети',
        statusCode: 0,
        timestamp,
        details: error.message
      };
    }

    const { status, data } = error.response;
    let message = data?.message || data?.error || 'Неизвестная ошибка';

    if (status === 503 && data?.code === 'DB_UNAVAILABLE') {
      message = 'Сервер не подключен к базе данных MongoDB. Проверьте запуск MongoDB и MONGODB_URI.';
    }

    // Обработка типовых статус-кодов с русскими сообщениями
    const statusMessages: Record<number, string> = {
      400: 'Некорректные данные',
      401: 'Необходима авторизация',
      403: 'Доступ запрещен',
      404: 'Ресурс не найден',
      409: 'Конфликт данных',
      422: 'Ошибка валидации',
      429: 'Слишком много запросов',
      500: 'Внутренняя ошибка сервера',
      502: 'Ошибка шлюза',
      503: 'Сервис недоступен'
    };

    if (!data?.message && statusMessages[status]) {
      message = statusMessages[status];
    }

    return {
      message,
      statusCode: status,
      timestamp,
      details: data
    };
  }

  /**
   * Методы для работы с токеном
   */
  public setAuthToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  public getAuthToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public removeAuthToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Универсальный метод для выполнения запросов
   */
  private async request<T>(
    method: HttpMethod,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.client.request<ApiResponse<T>>({
        method,
        url,
        data,
        ...config
      });
      
      return response.data.data || response.data as T;
    } catch (error) {
      throw error; // Ошибка уже обработана в interceptor
    }
  }

  /**
   * HTTP методы
   */
  public get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(HttpMethod.GET, url, undefined, config);
  }

  public post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(HttpMethod.POST, url, data, config);
  }

  public put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(HttpMethod.PUT, url, data, config);
  }

  public patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(HttpMethod.PATCH, url, data, config);
  }

  public delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>(HttpMethod.DELETE, url, undefined, config);
  }

  /**
   * Загрузка файлов
   */
  public async uploadFile<T>(
    url: string,
    file: File,
    fieldName = 'file',
    additionalData?: Record<string, any>
  ): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return this.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Скачивание файлов
   */
  public async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob'
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

/**
 * Создание и экспорт экземпляра API клиента
 */
const baseURL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : '/api';

export const apiClient = new ApiClient({
  baseURL,
  timeout: 15000,
  onTokenExpired: () => {
    // Перенаправление на страницу входа при истечении токена
    window.location.href = '/welcome';
  }
}); 
