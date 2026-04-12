export type CrmUpdateType = 'release' | 'improvement' | 'fix' | 'analytics';

export type CrmUpdate = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: CrmUpdateType;
  version?: string;
  area?: string;
};

const crmUpdates: CrmUpdate[] = [
  {
    id: 'crm-update-2026-04-12-guide-launch',
    title: 'Добавили встроенный гайд по CRM',
    description:
      'Внутри CRM появилась отдельная вкладка с быстрым стартом, картой разделов, role-specific блоками для player и staff и понятным FAQ по рабочим сценариям.',
    createdAt: '2026-04-12T15:45:00.000Z',
    type: 'release',
    version: 'v2.9.0',
    area: 'Онбординг'
  },
  {
    id: 'crm-update-2026-04-12-guide-navigation',
    title: 'Вынесли гайд в отдельный раздел «Помощь»',
    description:
      'Новая вкладка в sidebar больше не теряется среди рабочих модулей: гайд открывается как самостоятельный раздел и помогает быстрее провести нового пользователя по CRM.',
    createdAt: '2026-04-12T15:30:00.000Z',
    type: 'improvement',
    version: 'v2.9.0',
    area: 'Навигация'
  },
  {
    id: 'crm-update-2026-04-12-guide-visuals',
    title: 'Собрали визуальный walkthrough по ключевым модулям',
    description:
      'В гайде появились визуальные блоки по обзору, календарю, опроснику, тестам, аналитике и карточке игрока, чтобы структура CRM считывалась быстрее без длинного онбординга.',
    createdAt: '2026-04-12T15:15:00.000Z',
    type: 'improvement',
    version: 'v2.9.0',
    area: 'Интерфейс'
  },
  {
    id: 'crm-update-2026-04-05-calendar-launch',
    title: 'Запустили личный и командный календарь',
    description:
      'В CRM появился новый календарь в стиле planner: личные события доступны каждому, а командный календарь видит вся команда.',
    createdAt: '2026-04-05T08:30:00.000Z',
    type: 'release',
    version: 'v2.8.0',
    area: 'Календарь'
  },
  {
    id: 'crm-update-2026-04-05-team-calendar-access',
    title: 'Настроили права для командного календаря',
    description:
      'Участники команды теперь видят общий календарь в режиме просмотра, а staff может создавать и редактировать события внутри своей команды.',
    createdAt: '2026-04-05T08:10:00.000Z',
    type: 'improvement',
    version: 'v2.8.0',
    area: 'Календарь'
  },
  {
    id: 'crm-update-2026-04-05-header-polish',
    title: 'Обновили хедер и ближайшее событие',
    description:
      'Сделали верхнюю панель чище: переработали сервисную зону, добавили быстрый переход к ближайшему событию и аккуратный solo-статус.',
    createdAt: '2026-04-05T07:45:00.000Z',
    type: 'improvement',
    version: 'v2.7.9',
    area: 'Интерфейс'
  },
  {
    id: 'crm-update-2026-03-29-notification-feed',
    title: 'Лента обновлений теперь доступна в колокольчике',
    description:
      'В уведомлениях появилась отдельная лента изменений CRM, чтобы команда сразу видела новые релизы, улучшения и исправления.',
    createdAt: '2026-03-29T10:00:00.000Z',
    type: 'release',
    version: 'v2.7.0',
    area: 'Уведомления'
  },
  {
    id: 'crm-update-2026-03-27-player-card-updates',
    title: 'Улучшили карточку игрока и быстрые действия',
    description:
      'Оптимизировали работу с данными игрока, сделали сценарии обновления понятнее и сократили количество лишних переходов внутри CRM.',
    createdAt: '2026-03-27T12:30:00.000Z',
    type: 'improvement',
    version: 'v2.6.4',
    area: 'Карточка игрока'
  },
  {
    id: 'crm-update-2026-03-24-team-reports',
    title: 'Доработали отчёты по команде',
    description:
      'Добавили более удобный доступ к сводным данным по составу и улучшили отображение ключевых метрик для staff-ролей.',
    createdAt: '2026-03-24T09:15:00.000Z',
    type: 'analytics',
    version: 'v2.6.0',
    area: 'Отчёты'
  },
  {
    id: 'crm-update-2026-03-21-sync-stability',
    title: 'Повысили стабильность синхронизации',
    description:
      'Убрали часть ложных состояний загрузки и сделали отображение статуса синхронизации заметно надёжнее в повседневной работе.',
    createdAt: '2026-03-21T08:45:00.000Z',
    type: 'fix',
    version: 'v2.5.8',
    area: 'Синхронизация'
  },
  {
    id: 'crm-update-2026-03-18-dashboard-refresh',
    title: 'Освежили аналитику на дашборде',
    description:
      'Подготовили более понятную подачу ключевых блоков аналитики, чтобы изменения по команде и игрокам считывались быстрее.',
    createdAt: '2026-03-18T14:00:00.000Z',
    type: 'analytics',
    version: 'v2.5.3',
    area: 'Дашборд'
  }
];

export const getCrmUpdates = (): CrmUpdate[] =>
  [...crmUpdates].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
