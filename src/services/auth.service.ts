/**
 * Сервис для работы с аутентификацией
 */

import { apiClient, ApiError } from '@/utils/api/api-client';
import { 
  User, 
  LoginDto, 
  CreateUserDto, 
  AuthResponse 
} from '@/types';

/**
 * Результат операции аутентификации
 */
export interface AuthResult {
  success: boolean;
  user?: User | null;
  error?: string;
}

/**
 * Класс сервиса аутентификации
 */
export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  /**
   * Получение единственного экземпляра сервиса (Singleton)
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Вход пользователя в систему
   */
  public async login(credentials: LoginDto): Promise<AuthResult> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      
      if (!response.token || !response.user) {
        return {
          success: false,
          error: 'Неверный ответ от сервера'
        };
      }

      // Сохраняем токен
      apiClient.setAuthToken(response.token);
      
      return {
        success: true,
        user: response.user
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  /**
   * Регистрация нового пользователя
   */
  public async register(userData: CreateUserDto): Promise<AuthResult> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', userData);
      
      if (!response.token || !response.user) {
        return {
          success: false,
          error: 'Неверный ответ от сервера'
        };
      }

      // Сохраняем токен
      apiClient.setAuthToken(response.token);
      
      return {
        success: true,
        user: response.user
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  /**
   * Получение текущего пользователя
   */
  public async getCurrentUser(): Promise<User | null> {
    try {
      const token = apiClient.getAuthToken();
      if (!token) {
        return null;
      }

      const user = await apiClient.get<User>('/auth/me');
      return user;
    } catch (error) {
      // Если произошла ошибка (например, токен недействителен)
      apiClient.removeAuthToken();
      return null;
    }
  }

  /**
   * Выход из системы
   */
  public logout(): void {
    apiClient.removeAuthToken();
  }

  /**
   * Обновление аватара пользователя
   */
  public async updateAvatar(file: File): Promise<AuthResult> {
    try {
      const response = await apiClient.uploadFile<{ avatar: string; user?: User }>(
        '/auth/avatar',
        file,
        'avatar'
      );

      if (!response.avatar) {
        return {
          success: false,
          error: 'Сервер не вернул путь к аватару'
        };
      }

      return {
        success: true,
        user: response.user || null
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  /**
   * Удаление аккаунта
   */
  public async deleteAccount(): Promise<void> {
    try {
      await apiClient.delete('/auth/me');
      this.logout();
    } catch (error) {
      const apiError = error as ApiError;
      throw new Error(apiError.message);
    }
  }

  /**
   * Проверка валидности токена
   */
  public async verifyToken(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  /**
   * Обновление токена (если поддерживается сервером)
   */
  public async refreshToken(): Promise<string | null> {
    try {
      const response = await apiClient.post<{ token: string }>('/auth/refresh');
      if (response.token) {
        apiClient.setAuthToken(response.token);
        return response.token;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Экспорт экземпляра сервиса
export const authService = AuthService.getInstance(); 