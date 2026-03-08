/**
 * РўРёРїС‹, СЃРІСЏР·Р°РЅРЅС‹Рµ СЃ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј
 */

/** Р РѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РІ СЃРёСЃС‚РµРјРµ */
export type UserRole = "player" | "staff";

/** РўРёРї РёРіСЂРѕРєР° */
export type PlayerType = "solo" | "team";

/** РћСЃРЅРѕРІРЅР°СЏ РјРѕРґРµР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ */
export interface User {
  readonly id: string;
  email: string;
  name: string;
  role: UserRole;
  playerType?: PlayerType;
  privilegeKey?: string;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  createdAt?: string;
  avatar?: string;
  _updateTimestamp?: number;
}

/** Р”Р°РЅРЅС‹Рµ РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РЅРѕРІРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ */
export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  playerType?: PlayerType;
  faceitUrl?: string;
  nickname?: string;
}

/** Р”Р°РЅРЅС‹Рµ РґР»СЏ РІС…РѕРґР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ */
export interface LoginDto {
  email: string;
  password: string;
}

/** РћС‚РІРµС‚ РѕС‚ СЃРµСЂРІРµСЂР° РїСЂРё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё */
export interface AuthResponse {
  token: string;
  user: User;
}

/** Р”Р°РЅРЅС‹Рµ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРѕС„РёР»СЏ */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatar?: File;
} 

