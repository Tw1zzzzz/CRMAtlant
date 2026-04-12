export type SidebarRole = 'player' | 'staff' | null;
export type SidebarPlayerType = 'solo' | 'team' | null;

export type SidebarIconKey =
  | 'home'
  | 'calendar'
  | 'planner'
  | 'guide'
  | 'tests'
  | 'stats'
  | 'correlation'
  | 'gameStats'
  | 'balanceWheel'
  | 'playerState'
  | 'topPlayers'
  | 'players'
  | 'staff'
  | 'teams'
  | 'superadmin'
  | 'playerCard'
  | 'profile'
  | 'pricing';

export interface SidebarNavItem {
  title: string;
  href: string;
  icon: SidebarIconKey;
}

export interface SidebarNavSection {
  title: string;
  items: SidebarNavItem[];
}

const PATHS = {
  dashboard: '/',
  calendar: '/calendar',
  guide: '/guide',
  dailyQuestionnaire: '/daily-questionnaire',
  mood: '/mood',
  tests: '/tests',
  stats: '/stats',
  correlationAnalysis: '/correlation-analysis',
  gameStats: '/game-stats',
  balanceWheel: '/balance-wheel',
  staffBalanceWheel: '/staff-balance-wheel',
  playerState: '/state',
  topPlayers: '/top-players',
  playersManagement: '/players',
  staffRoster: '/staff-roster',
  teamManagement: '/teams',
  superadmin: '/superadmin',
  playerCard: '/player-card',
  profile: '/profile',
  pricing: '/pricing',
} as const;

export function getSidebarNavItems(
  role: SidebarRole,
  playerType: SidebarPlayerType,
  isSuperAdmin = false
): SidebarNavSection[] {
  const isSoloPlayer = role === 'player' && playerType === 'solo';
  const isTeamStaff = role === 'staff' && playerType === 'team';

  if (role === 'staff') {
    if (isTeamStaff) {
      const sections: SidebarNavSection[] = [
        {
          title: 'Команда',
          items: [
            { title: 'Обзор команды', href: PATHS.dashboard, icon: 'home' },
            { title: 'Топ игроков', href: PATHS.topPlayers, icon: 'topPlayers' },
            { title: 'Состав игроков', href: PATHS.playersManagement, icon: 'players' },
            { title: 'Состав staff', href: PATHS.staffRoster, icon: 'staff' },
            { title: 'Карточки игроков', href: PATHS.playerCard, icon: 'playerCard' },
          ],
        },
        {
          title: 'Игровое',
          items: [
            { title: 'Статистика', href: PATHS.stats, icon: 'stats' },
            { title: 'Корреляционный анализ', href: PATHS.correlationAnalysis, icon: 'correlation' },
            { title: 'Игровая статистика', href: PATHS.gameStats, icon: 'gameStats' },
            { title: 'Колесо баланса', href: PATHS.staffBalanceWheel, icon: 'balanceWheel' },
          ],
        },
        {
          title: 'Настройки и доступ',
          items: [
            { title: 'Тарифы', href: PATHS.pricing, icon: 'pricing' },
            { title: 'Профиль', href: PATHS.profile, icon: 'profile' },
            { title: 'Гайд по CRM', href: PATHS.guide, icon: 'guide' },
          ],
        },
      ];

      if (isSuperAdmin) {
        sections.push({
          title: 'Системное управление',
          items: [{ title: 'Админка CRM', href: PATHS.superadmin, icon: 'superadmin' }],
        });
      }

      return sections;
    }

    const sections: SidebarNavSection[] = [
      {
        title: 'Команда',
        items: [
          { title: 'Обзор команды', href: PATHS.dashboard, icon: 'home' },
          { title: 'Календарь', href: PATHS.calendar, icon: 'planner' },
          { title: 'Топ игроков', href: PATHS.topPlayers, icon: 'topPlayers' },
          { title: 'Состав игроков', href: PATHS.playersManagement, icon: 'players' },
          { title: 'Состав staff', href: PATHS.staffRoster, icon: 'staff' },
          { title: 'Карточки игроков', href: PATHS.playerCard, icon: 'playerCard' },
        ],
      },
      {
        title: 'Моя форма',
        items: [
          { title: 'Статистика', href: PATHS.stats, icon: 'stats' },
          { title: 'Корреляционный анализ', href: PATHS.correlationAnalysis, icon: 'correlation' },
          { title: 'Игровая статистика', href: PATHS.gameStats, icon: 'gameStats' },
          { title: 'Колесо баланса', href: PATHS.staffBalanceWheel, icon: 'balanceWheel' },
        ],
      },
      {
        title: 'Аккаунт и доступ',
        items: [
          { title: 'Тарифы', href: PATHS.pricing, icon: 'pricing' },
          { title: 'Профиль', href: PATHS.profile, icon: 'profile' },
        ],
      },
      {
        title: 'Помощь',
        items: [{ title: 'Гайд по CRM', href: PATHS.guide, icon: 'guide' }],
      },
    ];

    if (isSuperAdmin) {
      sections.push({
        title: 'Системное управление',
        items: [{ title: 'Админка CRM', href: PATHS.superadmin, icon: 'superadmin' }],
      });
    }

    return sections;
  }

  if (role === 'player') {
    const teamItems: SidebarNavItem[] = [];

    if (!isSoloPlayer) {
      teamItems.push({ title: 'Топ игроков', href: PATHS.topPlayers, icon: 'topPlayers' });
    }

    teamItems.push({
      title: isSoloPlayer ? 'Моя карточка' : 'Карточка игрока',
      href: PATHS.playerCard,
      icon: 'playerCard',
    });

    const sections: SidebarNavSection[] = [
      {
        title: 'Моё состояние',
        items: [
          { title: 'Обзор', href: PATHS.dashboard, icon: 'home' },
          { title: 'Календарь', href: PATHS.calendar, icon: 'planner' },
          { title: 'Ежедневный опросник', href: PATHS.dailyQuestionnaire, icon: 'calendar' },
          { title: 'Настроение и энергия', href: PATHS.mood, icon: 'calendar' },
          // Временно скрыто из прод-навигации до доработки экрана.
        ],
      },
      {
        title: 'Моя форма',
        items: [
          { title: 'Тесты и ритм', href: PATHS.tests, icon: 'tests' },
          { title: 'Статистика', href: PATHS.stats, icon: 'stats' },
          { title: 'Корреляционный анализ', href: PATHS.correlationAnalysis, icon: 'correlation' },
          { title: 'Игровая статистика', href: PATHS.gameStats, icon: 'gameStats' },
          { title: 'Колесо баланса', href: PATHS.balanceWheel, icon: 'balanceWheel' },
        ],
      },
      ...(teamItems.length
        ? [
            {
              title: 'Команда',
              items: teamItems,
            },
          ]
        : []),
      {
        title: 'Аккаунт и доступ',
        items: [
          { title: 'Тарифы', href: PATHS.pricing, icon: 'pricing' },
          { title: 'Профиль', href: PATHS.profile, icon: 'profile' },
        ],
      },
      {
        title: 'Помощь',
        items: [{ title: 'Гайд по CRM', href: PATHS.guide, icon: 'guide' }],
      },
    ];

    if (isSuperAdmin) {
      sections.push({
        title: 'Системное управление',
        items: [{ title: 'Админка CRM', href: PATHS.superadmin, icon: 'superadmin' }],
      });
    }

    return sections;
  }

  return [];
}
