import User from '../models/User';

type MinimalUser = {
  _id?: unknown;
  id?: unknown;
  role?: string;
  playerType?: string;
  teamId?: unknown;
};

export const toObjectIdString = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value && 'toString' in value) {
    return String(value.toString());
  }

  return '';
};

export const isTeamStaffUser = (user: MinimalUser | null | undefined): boolean =>
  Boolean(user?.role === 'staff' && user?.playerType === 'team');

export const getScopedTeamId = (user: MinimalUser | null | undefined): string =>
  toObjectIdString(user?.teamId);

export const hasTeamScope = (user: MinimalUser | null | undefined): boolean =>
  isTeamStaffUser(user) && Boolean(getScopedTeamId(user));

export const buildVisiblePlayersFilter = (
  user: MinimalUser | null | undefined,
  extraFilter: Record<string, unknown> = {}
) => {
  if (hasTeamScope(user)) {
    return {
      ...extraFilter,
      role: 'player',
      playerType: 'team',
      teamId: getScopedTeamId(user),
    };
  }

  return {
    ...extraFilter,
    role: 'player',
  };
};

export const buildVisibleStaffFilter = (
  user: MinimalUser | null | undefined,
  extraFilter: Record<string, unknown> = {}
) => {
  if (hasTeamScope(user)) {
    return {
      ...extraFilter,
      role: 'staff',
      playerType: 'team',
      teamId: getScopedTeamId(user),
    };
  }

  return {
    ...extraFilter,
    role: 'staff',
  };
};

export const canAccessTargetUser = (
  requestUser: MinimalUser | null | undefined,
  targetUser: MinimalUser | null | undefined
): boolean => {
  if (!requestUser || requestUser.role !== 'staff' || !targetUser) {
    return false;
  }

  if (!hasTeamScope(requestUser)) {
    return true;
  }

  const requestTeamId = getScopedTeamId(requestUser);
  const targetTeamId = getScopedTeamId(targetUser);
  if (!requestTeamId || !targetTeamId || requestTeamId !== targetTeamId) {
    return false;
  }

  if (targetUser.role === 'player') {
    return targetUser.playerType === 'team';
  }

  return targetUser.role === 'staff';
};

export const findAccessiblePlayerById = async (
  requestUser: MinimalUser | null | undefined,
  playerId: string,
  select = ''
) => {
  return User.findOne({
    _id: playerId,
    ...buildVisiblePlayersFilter(requestUser),
  }).select(select);
};

export const findAccessibleStaffById = async (
  requestUser: MinimalUser | null | undefined,
  staffId: string,
  select = ''
) => {
  return User.findOne({
    _id: staffId,
    ...buildVisibleStaffFilter(requestUser),
  }).select(select);
};
