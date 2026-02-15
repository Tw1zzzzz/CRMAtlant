/**
 * Типы, связанные с пользователем
 */

/** Роли пользователей в системе */
export type UserRole = "player" | "staff";

/** Основная модель пользователя */
export interface User {
  readonly id: string;
  email: string;
  name: string;
  role: UserRole;
  privilegeKey?: string;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  createdAt?: string;
  avatar?: string;
  _updateTimestamp?: number;
}

/** Данные для создания нового пользователя */
export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

/** Данные для входа пользователя */
export interface LoginDto {
  email: string;
  password: string;
}

/** Ответ от сервера при аутентификации */
export interface AuthResponse {
  token: string;
  user: User;
}

/** Данные для обновления профиля */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatar?: File;
} 