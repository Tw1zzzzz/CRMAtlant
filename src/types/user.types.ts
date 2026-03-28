/**
 * РўРёРїС‹, СЃРІСЏР·Р°РЅРЅС‹Рµ СЃ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј
 */

/** Р РѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РІ СЃРёСЃС‚РµРјРµ */
export type UserRole = "player" | "staff";

/** РўРёРї РёРіСЂРѕРєР° */
export type PlayerType = "solo" | "team";

/** РћСЃРЅРѕРІРЅР°СЏ РјРѕРґРµР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ */
export type BaselineAxis = "tempo" | "communication" | "decisionStyle" | "pressureResponse";
export type BaselineRole = "IGL" | "AWPer" | "Entry" | "Support" | "Lurker" | "Anchor" | "Flex";
export type BaselineSidePreference = "T-side" | "CT-side" | "Balanced";
export type BaselineRoundStrength = "Openings" | "Mid-round" | "Clutches" | "Support protocols";

export interface BaselineAssessment {
  completedAt?: string;
  personality?: {
    answers: Array<{
      questionId: string;
      optionId: string;
    }>;
    summary: {
      archetype: string;
      headline: string;
      description: string;
      styleTags: string[];
      axes: Record<BaselineAxis, number>;
    };
  };
  cs2Role?: {
    primaryRole: BaselineRole;
    secondaryRole?: BaselineRole | "";
    sidePreference: BaselineSidePreference;
    roundStrength: BaselineRoundStrength;
  };
}

export interface UserSubscription {
  id: string;
  status: "pending" | "active" | "expired" | "cancelled";
  startedAt: string | null;
  expiresAt: string | null;
  planId: string | null;
  planName: string | null;
  periodDays: number | null;
}

export interface User {
  readonly id: string;
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  name: string;
  role: UserRole;
  playerType?: PlayerType;
  teamId?: string | null;
  teamName?: string;
  privilegeKey?: string;
  staffHasPrivilegeKey?: boolean;
  subscription?: UserSubscription | null;
  hasPerformanceCoachCrmAccess?: boolean;
  hasCorrelationAnalysisAccess?: boolean;
  hasGameStatsAccess?: boolean;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  baselineAssessmentCompleted?: boolean;
  baselineAssessment?: BaselineAssessment | null;
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
  teamCode?: string;
  teamName?: string;
}

/** Р”Р°РЅРЅС‹Рµ РґР»СЏ РІС…РѕРґР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ */
export interface LoginDto {
  email: string;
  password: string;
}

/** РћС‚РІРµС‚ РѕС‚ СЃРµСЂРІРµСЂР° РїСЂРё Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёРё */
export interface AuthResponse {
  token?: string;
  user?: User | null;
  message?: string;
  requiresEmailVerification?: boolean;
  emailDeliveryFailed?: boolean;
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetConfirmDto {
  token: string;
  password: string;
}

export interface EmailVerificationConfirmDto {
  token: string;
}

export interface EmailVerificationRequestDto {
  email: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  playerLimit: number;
  playerCount: number;
  staffCount: number;
  isActive: boolean;
  createdAt?: string;
  isCreator?: boolean;
}

/** Р”Р°РЅРЅС‹Рµ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРѕС„РёР»СЏ */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatar?: File;
} 
