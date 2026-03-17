const fs = require('fs');
const path = require('path');
const assert = require('assert');

const projectRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const assertContains = (source, fragment, message) => {
  assert(source.includes(fragment), message);
};

const assertNotContains = (source, fragment, message) => {
  assert(!source.includes(fragment), message);
};

const assertMatches = (source, pattern, message) => {
  assert(pattern.test(source), message);
};

const assertAnchorWindow = (source, anchor, assertion, message) => {
  const anchorIndex = source.indexOf(anchor);
  assert(anchorIndex >= 0, `Не найден якорь проверки: ${anchor}`);
  const start = Math.max(0, anchorIndex - 600);
  const end = Math.min(source.length, anchorIndex + 1800);
  assertion(source.slice(start, end), message);
};

const appSource = read('src/App.tsx');
const sidebarSource = read('src/lib/sidebarNavigation.ts');
const testTrackerSource = read('src/pages/TestTracker.tsx');
const statisticsSource = read('src/pages/Statistics.tsx');
const personalStatsSource = read('src/components/stats/PersonalStats.tsx');
const gameStatsPageSource = read('src/pages/GameStatsPage.tsx');
const correlationPageSource = read('src/pages/CorrelationAnalysisPage.tsx');
const profileSource = read('src/pages/Profile.tsx');
const playerCardSource = read('src/pages/PlayerCard.tsx');
const questionnairesRouteSource = read('src/server/routes/questionnaires.ts');
const correlationsRouteSource = read('src/server/routes/correlations.ts');
const authRouteSource = read('src/server/routes/auth.ts');
const authControllerSource = read('src/server/controllers/authController.ts');

// 1. На вкладке "Тесты" -> "Опросник" больше не должно быть отдельных полей
// "Настроение" и "Энергия", так как они заполняются в отдельной вкладке.
assertNotContains(
  testTrackerSource,
  'const [qMood',
  'TestTracker: в ежедневном опроснике не должно оставаться состояние qMood.'
);
assertNotContains(
  testTrackerSource,
  'const [qEnergy',
  'TestTracker: в ежедневном опроснике не должно оставаться состояние qEnergy.'
);
assertNotContains(
  testTrackerSource,
  'Настроение (1-10)',
  'TestTracker: поле "Настроение" должно быть убрано из подвкладки "Опросник".'
);
assertNotContains(
  testTrackerSource,
  'Энергия (1-10)',
  'TestTracker: поле "Энергия" должно быть убрано из подвкладки "Опросник".'
);
assertNotContains(
  testTrackerSource,
  'mood: parseOptionalNumber(qMood)',
  'TestTracker: ежедневный опросник больше не должен отправлять mood.'
);
assertNotContains(
  testTrackerSource,
  'energy: parseOptionalNumber(qEnergy)',
  'TestTracker: ежедневный опросник больше не должен отправлять energy.'
);

// 2. Сумма детализации экранного времени не должна превышать общее экранное время.
assertMatches(
  questionnairesRouteSource,
  /breakdownTotal\s*>\s*resolvedScreenTimeHours/,
  'Questionnaires route: сервер должен сравнивать сумму детализации экранного времени с общим временем.'
);
assertMatches(
  questionnairesRouteSource,
  /(throw\s+badRequest|return\s+res\.status\(400\))/,
  'Questionnaires route: при некорректной сумме экранного времени должна возвращаться ошибка.'
);

// 3. На вкладке "Статистика" данные из тестов должны продолжать попадать в графики и распределения.
assertContains(
  statisticsSource,
  'prepareTestDataByTimeRange(testEntries, timeRange)',
  'Statistics: данные тестов должны агрегироваться для графика по времени.'
);
assertContains(
  statisticsSource,
  'prepareTestDistribution(testEntries)',
  'Statistics: данные тестов должны агрегироваться для распределения.'
);
assertMatches(
  statisticsSource,
  /<PersonalStats[\s\S]*testData=\{testData\}[\s\S]*testDistribution=\{testDistribution\}[\s\S]*testEntries=\{testEntries\}/,
  'Statistics: PersonalStats должен получать testData, testDistribution и testEntries.'
);
assertContains(
  personalStatsSource,
  '<TestChart data={testData} height={300} />',
  'PersonalStats: вкладка статистики должна показывать график по данным тестов.'
);
assertContains(
  personalStatsSource,
  'TestDistributionChart',
  'PersonalStats: вкладка статистики должна показывать распределение тестов.'
);

// 4. Корреляционный анализ должен быть доступен и работать для одиночного игрока.
assertMatches(
  appSource,
  /path="\/correlation-analysis"[\s\S]*?<RouteGuard>([\s\S]*?)<CorrelationAnalysisPage \/>[\s\S]*?<\/RouteGuard>/,
  'App routes: страница корреляционного анализа не должна оставаться staff-only.'
);
assertNotContains(
  correlationsRouteSource,
  'router.use(isStaff);',
  'Correlations route: серверный роут корреляций не должен блокировать всех не-staff пользователей глобальным middleware.'
);
assertNotContains(
  correlationPageSource,
  'Корреляционный анализ доступен только персоналу',
  'CorrelationAnalysisPage: экран корреляций не должен показывать solo-игроку заглушку про доступ только для персонала.'
);
assertMatches(
  correlationPageSource,
  /useState<'team' \| 'individual'>\(\s*isSoloPlayer \? 'individual'/,
  'CorrelationAnalysisPage: для игрока должен быть сценарий переключения в индивидуальный режим.'
);
assertMatches(
  correlationPageSource,
  /setSelectedPlayerId\(user\.(id|_id)\)/,
  'CorrelationAnalysisPage: для игрока должен использоваться его собственный id в индивидуальном анализе.'
);

// 5. Над таблицей игровой статистики должна быть инструкция, а показатели должны
// попадать в корреляционный анализ не только по kills/deaths/assists.
assertContains(
  gameStatsPageSource,
  'вводите данные игрока ниже',
  'GameStatsPage: над таблицей должна быть заметка, как ей пользоваться.'
);
const advancedGameMetrics = [
  'adr',
  'kpr',
  'deathPerRound',
  'avgKr',
  'avgKd',
  'kast',
  'firstKills',
  'firstDeaths',
  'openingDuelDiff',
  'udr',
  'avgMultikills',
  'clutchesWon',
  'avgFlashTime',
  'roundWinRate'
];

assertAnchorWindow(
  correlationPageSource,
  'const buildCorrelationComparisonRows',
  (slice) => {
    advancedGameMetrics.forEach((metricKey) => {
      assert(
        slice.includes(`${metricKey}:`) || slice.includes(`${metricKey} ??`),
        `CorrelationAnalysisPage: показатель "${metricKey}" должен маппиться в объединенные строки корреляционного анализа.`
      );
    });
  },
  'CorrelationAnalysisPage: игровые показатели должны переноситься в объединенный датасет для корреляции.'
);

assertAnchorWindow(
  correlationPageSource,
  'const metricsConfig = {',
  (slice) => {
    advancedGameMetrics.forEach((metricKey) => {
      assert(
        slice.includes(`${metricKey}:`),
        `CorrelationAnalysisPage: показатель "${metricKey}" должен быть доступен в конфигурации метрик для отображения.`
      );
    });
  },
  'CorrelationAnalysisPage: расширенные игровые показатели должны быть доступны в конфигурации отображаемых метрик.'
);

assertAnchorWindow(
  sidebarSource,
  "title: 'Топ игроков'",
  (slice, message) => assert(/playerType\s*(===|!==)\s*["']solo["']/.test(slice), message),
  'Sidebar: пункт "Топ игроков" должен находиться под условием для solo-игроков.'
);
assertAnchorWindow(
  sidebarSource,
  "title: 'Управление игроками'",
  (slice, message) => assert(/playerType\s*(===|!==)\s*["']solo["']/.test(slice), message),
  'Sidebar: пункт "Управление игроками" должен находиться под условием для solo-игроков.'
);
assertAnchorWindow(
  sidebarSource,
  "title: 'Управление персоналом'",
  (slice, message) => assert(/playerType\s*(===|!==)\s*["']solo["']/.test(slice), message),
  'Sidebar: пункт "Управление персоналом" должен находиться под условием для solo-игроков.'
);

// 7. Вкладка карточек игроков должна получить отдельную логику для solo-игрока,
// а не оставаться полностью staff-only.
assertAnchorWindow(
  appSource,
  'path={ROUTES.PLAYER_CARD}',
  (slice, message) => assert(!slice.includes('requiredRole="staff"'), message),
  'App routes: базовый маршрут карточек игроков не должен оставаться staff-only.'
);
assertMatches(
  playerCardSource,
  /playerType\s*(===|!==)\s*["']solo["']/,
  'PlayerCard: в странице карточек игроков должна появиться отдельная логика для solo-игроков.'
);

// 8. В профиле игрок должен иметь возможность изменить ссылку Faceit.
assertMatches(
  profileSource,
  /Faceit|faceit/i,
  'Profile: в профиле должен появиться UI для просмотра/редактирования Faceit.'
);
assertMatches(
  authRouteSource,
  /router\.(put|patch)\('\/me'/,
  'Auth routes: должен появиться защищенный endpoint для обновления профиля.'
);
assertMatches(
  authControllerSource,
  /export const \w*update\w*.*[\s\S]*faceit/i,
  'Auth controller: логика обновления профиля должна уметь обрабатывать Faceit в update-обработчике.'
);

console.log('Programmer fixes regression tests passed');
