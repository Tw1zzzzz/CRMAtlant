import mongoose from 'mongoose';

type RawProfile = {
  key?: unknown;
  label?: unknown;
  role?: unknown;
  playerType?: unknown;
  teamId?: unknown;
  teamName?: unknown;
  teamLogo?: unknown;
  privilegeKey?: unknown;
};

type MinimalUser = {
  role?: unknown;
  playerType?: unknown;
  teamId?: unknown;
  teamName?: unknown;
  teamLogo?: unknown;
  privilegeKey?: unknown;
  profiles?: RawProfile[] | unknown;
  activeProfileKey?: unknown;
  set?: (path: string, value: unknown) => void;
};

export type UserProfileSnapshot = {
  key: string;
  label: string;
  role: 'player' | 'staff';
  playerType: 'solo' | 'team';
  teamId: mongoose.Types.ObjectId | string | null;
  teamName: string;
  teamLogo: string;
  privilegeKey: string;
};

const normalizeRole = (value: unknown): 'player' | 'staff' =>
  value === 'staff' ? 'staff' : 'player';

const normalizePlayerType = (value: unknown, role: 'player' | 'staff'): 'solo' | 'team' => {
  if (value === 'solo' || value === 'team') {
    return value;
  }

  return role === 'player' ? 'team' : 'team';
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeObjectIdLike = (value: unknown): mongoose.Types.ObjectId | string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'object' && value && 'toString' in value) {
    const normalized = String(value.toString()).trim();
    return normalized || null;
  }

  return null;
};

const buildProfileKey = (role: 'player' | 'staff', playerType: 'solo' | 'team'): string =>
  `${role}_${playerType}`;

const buildProfileLabel = (role: 'player' | 'staff', playerType: 'solo' | 'team'): string => {
  if (role === 'staff' && playerType === 'team') {
    return 'Стафф / Team';
  }

  if (role === 'player' && playerType === 'team') {
    return 'Игрок / Team';
  }

  return 'Игрок / Solo';
};

export const sanitizeProfile = (rawProfile: RawProfile, fallbackIndex = 0): UserProfileSnapshot => {
  const role = normalizeRole(rawProfile?.role);
  const playerType = normalizePlayerType(rawProfile?.playerType, role);
  const key = normalizeText(rawProfile?.key) || `${buildProfileKey(role, playerType)}_${fallbackIndex}`;

  return {
    key,
    label: normalizeText(rawProfile?.label) || buildProfileLabel(role, playerType),
    role,
    playerType,
    teamId: normalizeObjectIdLike(rawProfile?.teamId),
    teamName: normalizeText(rawProfile?.teamName),
    teamLogo: normalizeText(rawProfile?.teamLogo),
    privilegeKey: normalizeText(rawProfile?.privilegeKey),
  };
};

export const buildLegacyProfile = (user: MinimalUser): UserProfileSnapshot => {
  const role = normalizeRole(user?.role);
  const playerType = normalizePlayerType(user?.playerType, role);

  return {
    key: buildProfileKey(role, playerType),
    label: buildProfileLabel(role, playerType),
    role,
    playerType,
    teamId: normalizeObjectIdLike(user?.teamId),
    teamName: normalizeText(user?.teamName),
    teamLogo: normalizeText(user?.teamLogo),
    privilegeKey: normalizeText(user?.privilegeKey),
  };
};

export const getUserProfiles = (user: MinimalUser): UserProfileSnapshot[] => {
  if (Array.isArray(user?.profiles) && user.profiles.length > 0) {
    return user.profiles.map((profile, index) => sanitizeProfile(profile, index));
  }

  return [buildLegacyProfile(user)];
};

export const getActiveProfile = (user: MinimalUser): UserProfileSnapshot => {
  const profiles = getUserProfiles(user);
  const activeProfileKey = normalizeText(user?.activeProfileKey);
  return profiles.find((profile) => profile.key === activeProfileKey) || profiles[0];
};

export const applyActiveProfileProjection = <T extends MinimalUser>(user: T): T => {
  const activeProfile = getActiveProfile(user);
  const profiles = getUserProfiles(user);

  if (typeof user.set === 'function') {
    user.set('profiles', profiles);
    user.set('activeProfileKey', activeProfile.key);
    user.set('role', activeProfile.role);
    user.set('playerType', activeProfile.playerType);
    user.set('teamId', activeProfile.teamId);
    user.set('teamName', activeProfile.teamName);
    user.set('teamLogo', activeProfile.teamLogo);
    user.set('privilegeKey', activeProfile.privilegeKey);
  } else {
    (user as T & Record<string, unknown>).profiles = profiles;
    (user as T & Record<string, unknown>).activeProfileKey = activeProfile.key;
    (user as T & Record<string, unknown>).role = activeProfile.role;
    (user as T & Record<string, unknown>).playerType = activeProfile.playerType;
    (user as T & Record<string, unknown>).teamId = activeProfile.teamId;
    (user as T & Record<string, unknown>).teamName = activeProfile.teamName;
    (user as T & Record<string, unknown>).teamLogo = activeProfile.teamLogo;
    (user as T & Record<string, unknown>).privilegeKey = activeProfile.privilegeKey;
  }

  return user;
};

export const upsertUserProfile = (
  user: MinimalUser,
  nextProfileInput: Partial<UserProfileSnapshot> & Pick<UserProfileSnapshot, 'role' | 'playerType'>
): UserProfileSnapshot[] => {
  const currentProfiles = getUserProfiles(user);
  const nextRole = normalizeRole(nextProfileInput.role);
  const nextPlayerType = normalizePlayerType(nextProfileInput.playerType, nextRole);
  const nextKey = normalizeText(nextProfileInput.key) || buildProfileKey(nextRole, nextPlayerType);

  const nextProfile = sanitizeProfile(
    {
      key: nextKey,
      label: nextProfileInput.label,
      role: nextRole,
      playerType: nextPlayerType,
      teamId: nextProfileInput.teamId,
      teamName: nextProfileInput.teamName,
      teamLogo: nextProfileInput.teamLogo,
      privilegeKey: nextProfileInput.privilegeKey,
    },
    currentProfiles.length
  );

  const existingIndex = currentProfiles.findIndex((profile) => profile.key === nextProfile.key);
  if (existingIndex >= 0) {
    currentProfiles[existingIndex] = nextProfile;
  } else {
    currentProfiles.push(nextProfile);
  }

  return currentProfiles;
};

export const serializeProfilesForResponse = (user: MinimalUser) =>
  getUserProfiles(user).map((profile) => ({
    ...profile,
    teamId: profile.teamId ? String(profile.teamId) : null,
    teamLogo: profile.teamLogo || '',
  }));
