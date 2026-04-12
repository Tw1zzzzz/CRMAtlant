/**
 * Типы, связанные с пользователем
 */

/** Роли пользователей в системе */
export type UserRole = "player" | "staff";

/** Тип игрока */
export type PlayerType = "solo" | "team";

/** Основная модель пользователя */
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

export interface AccountProfile {
  key: string;
  label: string;
  role: UserRole;
  playerType: PlayerType;
  teamId: string | null;
  teamName: string;
  teamLogo?: string;
  privilegeKey?: string;
}

export interface User {
  readonly id: string;
  email: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  deactivatedAt?: string | null;
  deactivatedReason?: string | null;
  name: string;
  role: UserRole;
  playerType?: PlayerType;
  teamId?: string | null;
  teamName?: string;
  teamLogo?: string;
  privilegeKey?: string;
  staffHasPrivilegeKey?: boolean;
  availableProfiles?: AccountProfile[];
  activeProfileKey?: string | null;
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

/** Данные для создания нового пользователя */
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

export interface CreatePlayerProfileDto {
  playerType: PlayerType;
  faceitUrl: string;
  nickname?: string;
}

export interface LinkTeamProfileDto {
  teamCode: string;
  confirmRelink?: boolean;
}

export interface TeamLinkSummary {
  id: string;
  name: string;
  logo?: string;
}

export interface LinkTeamProfileResponse {
  status: "linked" | "confirmation_required";
  message?: string;
  user?: User | null;
  targetProfileKey?: string;
  team?: TeamLinkSummary;
  currentTeam?: TeamLinkSummary;
  nextTeam?: TeamLinkSummary;
}

/** Данные для входа пользователя */
export interface LoginDto {
  email: string;
  password: string;
}

/** Ответ от сервера при аутентификации */
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
  logo?: string;
  playerLimit: number;
  playerCount: number;
  staffCount: number;
  isActive: boolean;
  createdAt?: string;
  isCreator?: boolean;
}

/** Данные для обновления профиля */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatar?: File;
} 
