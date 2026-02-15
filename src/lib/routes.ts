// Константы для маршрутов в приложении
export const ROUTES = {
  // Публичные маршруты
  WELCOME: '/welcome',

  // Защищенные маршруты
  DASHBOARD: '/',
  MOOD_TRACKER: '/mood',
  TEST_TRACKER: '/tests',
  STATISTICS: '/stats',
  PROFILE: '/profile',
  TOP_PLAYERS: '/top-players',
  ANALYTICS: '/analytics',
  NEW_ANALYTICS: '/new-analytics',
  CS2_EXCEL_IMPORT: '/cs2-excel-import',
  FILE_STORAGE: '/file-storage',
  ACTIVITY_HISTORY: '/history',
  
  // Маршруты для игроков
  BALANCE_WHEEL: '/balance-wheel',
  
  // Маршруты для сотрудников
  STAFF_BALANCE_WHEEL: '/staff-balance-wheel',
  PLAYERS_MANAGEMENT: '/players',
  PLAYER_CARD: '/player-card',
  STAFF_ROSTER: '/staff-roster',
  STAFF_MANAGEMENT: '/staff-management',
  
  // Служебные маршруты
  NOT_FOUND: '*',
};

export const isProtectedRoute = (path: string): boolean => {
  return path !== ROUTES.WELCOME && path !== ROUTES.NOT_FOUND;
};

export const isStaffRoute = (path: string): boolean => {
  return [
    ROUTES.STAFF_BALANCE_WHEEL,
    ROUTES.PLAYERS_MANAGEMENT,
    ROUTES.PLAYER_CARD,
    ROUTES.STAFF_ROSTER,
    ROUTES.STAFF_MANAGEMENT,
    ROUTES.CS2_EXCEL_IMPORT,
    // ROUTES.ACTIVITY_HISTORY - временно отключено из-за технических проблем
  ].includes(path);
};

export const isPlayerRoute = (path: string): boolean => {
  return [
    ROUTES.BALANCE_WHEEL
  ].includes(path);
};

export default ROUTES; 