// Константы для маршрутов в приложении
export const ROUTES = {
  // Публичные маршруты
  WELCOME: '/welcome',
  RESET_PASSWORD: '/reset-password',

  // Защищенные маршруты
  DASHBOARD: '/',
  MOOD_TRACKER: '/mood',
  TEST_TRACKER: '/tests',
  STATISTICS: '/stats',
  GAME_STATS: '/game-stats',
  PROFILE: '/profile',
  PRICING: '/pricing',
  PAYMENT_SUCCESS: '/payment/success',
  PAYMENT_FAIL: '/payment/fail',
  TOP_PLAYERS: '/top-players',
  ANALYTICS: '/analytics',
  NEW_ANALYTICS: '/new-analytics',
  CS2_EXCEL_IMPORT: '/cs2-excel-import',
  ACTIVITY_HISTORY: '/history',
  
  // Состояние игрока
  PLAYER_STATE: '/state',

  // Маршруты для игроков
  BALANCE_WHEEL: '/balance-wheel',
  
  // Маршруты для сотрудников
  STAFF_BALANCE_WHEEL: '/staff-balance-wheel',
  PLAYERS_MANAGEMENT: '/players',
  PLAYER_CARD: '/player-card',
  STAFF_ROSTER: '/staff-roster',
  STAFF_MANAGEMENT: '/staff-management',
  TEAM_MANAGEMENT: '/teams',
  
  // Служебные маршруты
  NOT_FOUND: '*',
};

export const isProtectedRoute = (path: string): boolean => {
  return path !== ROUTES.WELCOME && path !== ROUTES.RESET_PASSWORD && path !== ROUTES.NOT_FOUND;
};

export const isStaffRoute = (path: string): boolean => {
  return [
    ROUTES.STAFF_BALANCE_WHEEL,
    ROUTES.PLAYERS_MANAGEMENT,
    ROUTES.PLAYER_CARD,
    ROUTES.STAFF_ROSTER,
    ROUTES.STAFF_MANAGEMENT,
    ROUTES.TEAM_MANAGEMENT,
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
