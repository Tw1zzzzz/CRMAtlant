/**
 * Сервис для работы с аутентификацией
 */

import { apiClient, ApiError } from '@/utils/api/api-client';
import { 
  AccountProfile,
  User, 
  UserSubscription,
  LoginDto, 
  CreateUserDto, 
  CreatePlayerProfileDto,
  AuthResponse,
  ChangePasswordDto,
  EmailVerificationConfirmDto,
  EmailVerificationRequestDto,
  LinkTeamProfileDto,
  LinkTeamProfileResponse,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  TeamLinkSummary,
} from '@/types';

/**
 * Результат операции аутентификации
 */
export interface AuthResult {
  success: boolean;
  user?: User | null;
  error?: string;
  message?: string;
  code?: string;
  requiresEmailVerification?: boolean;
  emailDeliveryFailed?: boolean;
}

export interface TeamLinkResult {
  success: boolean;
  status?: 'linked' | 'confirmation_required';
  user?: User | null;
  error?: string;
  message?: string;
  targetProfileKey?: string;
  team?: TeamLinkSummary;
  currentTeam?: TeamLinkSummary;
  nextTeam?: TeamLinkSummary;
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

  private normalizeUser(rawUser: unknown): User | null {
    if (!rawUser) {
      return null;
    }

    const normalizedRawUser =
      typeof rawUser === 'object' && rawUser !== null
        ? (rawUser as Record<string, unknown>)
        : null;

    if (!normalizedRawUser) {
      return null;
    }

    const normalizedRole = normalizedRawUser.role === 'staff' ? 'staff' : 'player';
    // Сохраняем playerType из ответа сервера и для staff/team: rawUser.playerType === 'solo' || rawUser.playerType === 'team'
    const normalizedPlayerType =
      normalizedRawUser.playerType === 'solo' || normalizedRawUser.playerType === 'team'
        ? normalizedRawUser.playerType
        : normalizedRole === 'player'
          ? 'team'
          : undefined;
    const id = String(normalizedRawUser.id || normalizedRawUser._id || '');

    if (!id) {
      return null;
    }

    const normalizedProfiles = Array.isArray(normalizedRawUser.availableProfiles)
      ? normalizedRawUser.availableProfiles
          .map((profile) => {
            const profileRole = profile?.role === 'staff' ? 'staff' : 'player';
            const profilePlayerType =
              profile?.playerType === 'solo' || profile?.playerType === 'team'
                ? profile.playerType
                : 'team';
            const profileKey = String(profile?.key || '').trim();

            if (!profileKey) {
              return null;
            }

            return {
              key: profileKey,
              label:
                typeof profile?.label === 'string' && profile.label.trim()
                  ? profile.label
                  : profileRole === 'staff'
                    ? 'Стафф / Team'
                    : profilePlayerType === 'solo'
                      ? 'Игрок / Solo'
                      : 'Игрок / Team',
              role: profileRole,
              playerType: profilePlayerType,
              teamId: profile?.teamId ? String(profile.teamId) : null,
              teamName: typeof profile?.teamName === 'string' ? profile.teamName : '',
              teamLogo: typeof profile?.teamLogo === 'string' ? profile.teamLogo : '',
              privilegeKey: typeof profile?.privilegeKey === 'string' ? profile.privilegeKey : '',
            } as AccountProfile;
          })
          .filter(Boolean)
      : [];

    const fallbackProfiles =
      normalizedProfiles.length > 0
        ? normalizedProfiles
        : id
          ? [{
              key: `${normalizedRole}_${normalizedPlayerType || 'team'}`,
              label:
                normalizedRole === 'staff'
                  ? 'Стафф / Team'
                  : normalizedPlayerType === 'solo'
                    ? 'Игрок / Solo'
                    : 'Игрок / Team',
              role: normalizedRole,
              playerType: normalizedPlayerType || 'team',
              teamId: normalizedRawUser.teamId ? String(normalizedRawUser.teamId) : null,
              teamName: typeof normalizedRawUser.teamName === 'string' ? normalizedRawUser.teamName : '',
              teamLogo: typeof normalizedRawUser.teamLogo === 'string' ? normalizedRawUser.teamLogo : '',
              privilegeKey: typeof normalizedRawUser.privilegeKey === 'string' ? normalizedRawUser.privilegeKey : '',
            } as AccountProfile]
          : [];

    const normalizedSubscription =
      normalizedRawUser.subscription && typeof normalizedRawUser.subscription === 'object'
        ? ({
            id: String(
              (normalizedRawUser.subscription as Record<string, unknown>).id ||
                (normalizedRawUser.subscription as Record<string, unknown>)._id ||
                ''
            ),
            status: (normalizedRawUser.subscription as Record<string, unknown>).status,
            startedAt: (normalizedRawUser.subscription as Record<string, unknown>).startedAt || null,
            expiresAt: (normalizedRawUser.subscription as Record<string, unknown>).expiresAt || null,
            planId: (normalizedRawUser.subscription as Record<string, unknown>).planId
              ? String((normalizedRawUser.subscription as Record<string, unknown>).planId)
              : null,
            planName:
              typeof (normalizedRawUser.subscription as Record<string, unknown>).planName === 'string'
                ? ((normalizedRawUser.subscription as Record<string, unknown>).planName as string)
                : null,
            periodDays:
              typeof (normalizedRawUser.subscription as Record<string, unknown>).periodDays === 'number'
                ? ((normalizedRawUser.subscription as Record<string, unknown>).periodDays as number)
                : null,
          } as UserSubscription)
        : null;

    return {
      ...normalizedRawUser,
      id,
      emailVerified: typeof normalizedRawUser.emailVerified === 'boolean' ? normalizedRawUser.emailVerified : true,
      emailVerifiedAt: normalizedRawUser.emailVerifiedAt || null,
      isSuperAdmin: typeof normalizedRawUser.isSuperAdmin === 'boolean' ? normalizedRawUser.isSuperAdmin : false,
      isActive: typeof normalizedRawUser.isActive === 'boolean' ? normalizedRawUser.isActive : true,
      deactivatedAt:
        typeof normalizedRawUser.deactivatedAt === 'string' || normalizedRawUser.deactivatedAt === null
          ? normalizedRawUser.deactivatedAt
          : null,
      deactivatedReason:
        typeof normalizedRawUser.deactivatedReason === 'string' || normalizedRawUser.deactivatedReason === null
          ? normalizedRawUser.deactivatedReason
          : null,
      role: normalizedRole,
      playerType: normalizedPlayerType || fallbackProfiles[0]?.playerType,
      teamId: normalizedRawUser.teamId ? String(normalizedRawUser.teamId) : null,
      teamName: typeof normalizedRawUser.teamName === 'string' ? normalizedRawUser.teamName : '',
      teamLogo: typeof normalizedRawUser.teamLogo === 'string' ? normalizedRawUser.teamLogo : '',
      availableProfiles: fallbackProfiles,
      activeProfileKey:
        typeof normalizedRawUser.activeProfileKey === 'string' && normalizedRawUser.activeProfileKey.trim()
          ? normalizedRawUser.activeProfileKey
          : fallbackProfiles[0]?.key || null,
      subscription: normalizedSubscription,
      hasPerformanceCoachCrmAccess:
        typeof normalizedRawUser.hasPerformanceCoachCrmAccess === 'boolean'
          ? normalizedRawUser.hasPerformanceCoachCrmAccess
          : false,
      hasCorrelationAnalysisAccess:
        typeof normalizedRawUser.hasCorrelationAnalysisAccess === 'boolean'
          ? normalizedRawUser.hasCorrelationAnalysisAccess
          : false,
      hasGameStatsAccess:
        typeof normalizedRawUser.hasGameStatsAccess === 'boolean'
          ? normalizedRawUser.hasGameStatsAccess
          : false,
      staffHasPrivilegeKey:
        typeof normalizedRawUser.staffHasPrivilegeKey === 'boolean'
          ? normalizedRawUser.staffHasPrivilegeKey
          : Boolean(
              normalizedRole === 'staff' &&
                typeof normalizedRawUser.privilegeKey === 'string' &&
                normalizedRawUser.privilegeKey.trim()
            )
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
        user: normalizedUser,
        message: response.message
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message,
        code: apiError.details?.code
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
      if (response.token && normalizedUser) {
        apiClient.setAuthToken(response.token);

        return {
          success: true,
          user: normalizedUser,
          message: response.message,
          requiresEmailVerification: response.requiresEmailVerification,
          emailDeliveryFailed: response.emailDeliveryFailed
        };
      }

      if (response.requiresEmailVerification || response.message) {
        return {
          success: true,
          message: response.message,
          requiresEmailVerification: response.requiresEmailVerification,
          emailDeliveryFailed: response.emailDeliveryFailed
        };
      }

      return {
        success: false,
        error: 'Неверный ответ от сервера'
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message,
        code: apiError.details?.code
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

  public async resendVerificationEmail(
    payload: EmailVerificationRequestDto
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/auth/resend-verification', payload);
      return { success: true, message: response.message };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async verifyEmail(
    payload: EmailVerificationConfirmDto
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/auth/verify-email', payload);
      return { success: true, message: response.message };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async changePassword(
    payload: ChangePasswordDto
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const response = await apiClient.post<{ message: string }>('/auth/change-password', payload);
      return { success: true, message: response.message };
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

  public async createPlayerProfile(payload: CreatePlayerProfileDto): Promise<AuthResult> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/profiles/player', payload);
      const normalizedUser = this.normalizeUser(response.user);

      return {
        success: true,
        user: normalizedUser,
        message: response.message
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async switchProfile(profileKey: string): Promise<AuthResult> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/switch-profile', { profileKey });
      const normalizedUser = this.normalizeUser(response.user);

      return {
        success: true,
        user: normalizedUser,
        message: response.message
      };
    } catch (error) {
      const apiError = error as ApiError;
      return {
        success: false,
        error: apiError.message
      };
    }
  }

  public async linkTeamProfile(payload: LinkTeamProfileDto): Promise<TeamLinkResult> {
    try {
      const response = await apiClient.post<LinkTeamProfileResponse>('/auth/team-link', payload);
      const normalizedUser = this.normalizeUser(response.user);

      return {
        success: true,
        status: response.status,
        user: normalizedUser,
        message: response.message,
        targetProfileKey: response.targetProfileKey,
        team: response.team,
        currentTeam: response.currentTeam,
        nextTeam: response.nextTeam
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
