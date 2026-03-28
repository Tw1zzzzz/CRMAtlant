/**
 * Сервис для работы с аутентификацией
 */

import { apiClient, ApiError } from '@/utils/api/api-client';
import { 
  User, 
  UserSubscription,
  LoginDto, 
  CreateUserDto, 
  AuthResponse,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
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

  private normalizeUser(rawUser: any): User | null {
    if (!rawUser) {
      return null;
    }

    const normalizedRole = rawUser.role === 'staff' ? 'staff' : 'player';
    const normalizedPlayerType =
      normalizedRole === 'player' && (rawUser.playerType === 'solo' || rawUser.playerType === 'team')
        ? rawUser.playerType
        : normalizedRole === 'player'
          ? 'team'
          : undefined;
    const id = String(rawUser.id || rawUser._id || '');

    if (!id) {
      return null;
    }

    const normalizedSubscription =
      rawUser.subscription && typeof rawUser.subscription === 'object'
        ? ({
            id: String(rawUser.subscription.id || rawUser.subscription._id || ''),
            status: rawUser.subscription.status,
            startedAt: rawUser.subscription.startedAt || null,
            expiresAt: rawUser.subscription.expiresAt || null,
            planId: rawUser.subscription.planId ? String(rawUser.subscription.planId) : null,
            planName: typeof rawUser.subscription.planName === 'string' ? rawUser.subscription.planName : null,
            periodDays: typeof rawUser.subscription.periodDays === 'number' ? rawUser.subscription.periodDays : null,
          } as UserSubscription)
        : null;

    return {
      ...rawUser,
      id,
      role: normalizedRole,
      playerType: normalizedPlayerType,
      teamId: rawUser.teamId ? String(rawUser.teamId) : null,
      teamName: typeof rawUser.teamName === 'string' ? rawUser.teamName : '',
      subscription: normalizedSubscription,
      hasPerformanceCoachCrmAccess:
        typeof rawUser.hasPerformanceCoachCrmAccess === 'boolean'
          ? rawUser.hasPerformanceCoachCrmAccess
          : false,
      hasCorrelationAnalysisAccess:
        typeof rawUser.hasCorrelationAnalysisAccess === 'boolean'
          ? rawUser.hasCorrelationAnalysisAccess
          : false,
      hasGameStatsAccess:
        typeof rawUser.hasGameStatsAccess === 'boolean'
          ? rawUser.hasGameStatsAccess
          : false,
      staffHasPrivilegeKey:
        typeof rawUser.staffHasPrivilegeKey === 'boolean'
          ? rawUser.staffHasPrivilegeKey
          : Boolean(normalizedRole === 'staff' && typeof rawUser.privilegeKey === 'string' && rawUser.privilegeKey.trim())
    } as User;
  }

  /**
   * Вход пользователя в систему
   */
  public async login(credentials: LoginDto): Promise<AuthResult> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      
      const normalizedUser = this.normalizeUser(response.user);
      if (!response.token || !normalizedUser) {
        return {
          success: false,
          error: 'Неверный ответ от сервера'
        };
      }

      // Сохраняем токен
      apiClient.setAuthToken(response.token);
      
      return {
        success: true,
        user: normalizedUser
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
      
      const normalizedUser = this.normalizeUser(response.user);
      if (!response.token || !normalizedUser) {
        return {
          success: false,
          error: 'Неверный ответ от сервера'
        };
      }

      // Сохраняем токен
      apiClient.setAuthToken(response.token);
      
      return {
        success: true,
        user: normalizedUser
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async requestPasswordReset(payload: PasswordResetRequestDto): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post<{ message: string }>('/auth/forgot-password', payload);
      return { success: true };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async resetPassword(payload: PasswordResetConfirmDto): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.post<{ message: string }>('/auth/reset-password', payload);
      return { success: true };
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
      return this.normalizeUser(user);
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

      const normalizedUser = this.normalizeUser(response.user);
      return {
        success: true,
        user: normalizedUser
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
