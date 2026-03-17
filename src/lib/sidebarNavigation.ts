export type SidebarRole = 'player' | 'staff' | null;
export type SidebarPlayerType = 'solo' | 'team' | null;

export type SidebarIconKey =
  | 'home'
  | 'calendar'
  | 'tests'
  | 'stats'
  | 'correlation'
  | 'gameStats'
  | 'balanceWheel'
  | 'topPlayers'
  | 'players'
  | 'staff'
  | 'playerCard'
  | 'profile';

export interface SidebarNavItem {
  title: string;
  href: string;
  icon: SidebarIconKey;
}

const PATHS = {
  dashboard: '/',
  mood: '/mood',
  tests: '/tests',
  stats: '/stats',
  correlationAnalysis: '/correlation-analysis',
  gameStats: '/game-stats',
  balanceWheel: '/balance-wheel',
  staffBalanceWheel: '/staff-balance-wheel',
  topPlayers: '/top-players',
  playersManagement: '/players',
  staffRoster: '/staff-roster',
  playerCard: '/player-card',
  profile: '/profile',
} as const;

export function getSidebarNavItems(
  role: SidebarRole,
  playerType: SidebarPlayerType
): SidebarNavItem[] {
  const baseItems: SidebarNavItem[] = [
    {
      title: 'Обзор',
      href: PATHS.dashboard,
      icon: 'home',
    },
    {
      title: 'Настроение и Энергия',
      href: PATHS.mood,
      icon: 'calendar',
    },
    {
      title: 'Тесты',
      href: PATHS.tests,
      icon: 'tests',
    },
    {
      title: 'Статистика',
      href: PATHS.stats,
      icon: 'stats',
    },
    {
      title: 'Корреляционный анализ',
      href: PATHS.correlationAnalysis,
      icon: 'correlation',
    },
    {
      title: 'Игровая статистика',
      href: PATHS.gameStats,
      icon: 'gameStats',
    },
  ];

  if (role === 'player') {
    baseItems.push({
      title: 'Колесо баланса',
      href: PATHS.balanceWheel,
      icon: 'balanceWheel',
    });
  } else if (role === 'staff') {
    baseItems.push({
      title: 'Колесо баланса',
      href: PATHS.staffBalanceWheel,
      icon: 'balanceWheel',
    });
  }

  const isSoloPlayer = role === 'player' && playerType === 'solo';
  if (role && !isSoloPlayer) {
    baseItems.push(
      {
        title: 'Топ игроков',
        href: PATHS.topPlayers,
        icon: 'topPlayers',
      },
      {
        title: 'Управление игроками',
        href: PATHS.playersManagement,
        icon: 'players',
      },
      {
        title: 'Управление персоналом',
        href: PATHS.staffRoster,
        icon: 'staff',
      }
    );
  }

  if (role === 'staff' || isSoloPlayer) {
    baseItems.push({
      title: 'Моя карточка',
      href: PATHS.playerCard,
      icon: 'playerCard',
    });
  } else if (role && !isSoloPlayer) {
    baseItems.push({
      title: 'Карточки игроков',
      href: PATHS.playerCard,
      icon: 'playerCard',
    });
  }

  if (role) {
    baseItems.push({
      title: 'Профиль',
      href: PATHS.profile,
      icon: 'profile',
    });
  }

  return baseItems;
}
