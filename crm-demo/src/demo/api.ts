/**
 * Демо API: все вызовы возвращают мок-данные, бэкенд не требуется.
 */
interface TeamReportFilters {
  type?: string;
  status?: string;
  visibility?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TeamReportData {
  title: string;
  description?: string;
  content: { summary?: string; details?: string; recommendations?: string[]; sections: unknown[]; attachments?: unknown[]; tags?: string[] };
  type: "weekly" | "monthly" | "custom" | "match_analysis" | "training_report";
  visibility: "team" | "staff" | "public";
  assignedTo?: string[];
  viewableBy?: string[];
}

export interface TeamReportResponse {
  _id: string;
  title: string;
  description?: string;
  content: TeamReportData["content"];
  type: TeamReportData["type"];
  visibility: TeamReportData["visibility"];
  status: "draft" | "published" | "archived";
  createdBy: { _id: string; name: string; email: string; avatar?: string };
  assignedTo?: unknown[];
  viewableBy?: unknown[];
  createdAt: string;
  updatedAt: string;
}

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

const mockRes = <T>(data: T) => delay().then(() => ({ data }));

const DEMO_PLAYERS = [
  { _id: "p1", name: "Player_Kirov", email: "kirov@demo.local", role: "player" },
  { _id: "p2", name: "PixelStorm", email: "pixel@demo.local", role: "player" },
  { _id: "p3", name: "Sn1perAlek", email: "sniper@demo.local", role: "player" },
];

const DEMO_CHART_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((date, i) => ({
  date,
  mood: 60 + i * 3 + Math.random() * 10,
  energy: 55 + i * 2 + Math.random() * 8,
}));

// ——— Игроки ———
export const getPlayers = () => mockRes(DEMO_PLAYERS);
export const getPlayerStats = (_id: string) => mockRes({ mood: 78, energy: 72, testsCompleted: 12 });
export const deletePlayer = (_id: string) => mockRes({});
export const deletePlayerComplete = (_id: string) => mockRes({});
export const updatePlayerStatus = (_id: string, _status: unknown) => mockRes({});

// ——— Колесо баланса ———
export const saveBalanceWheel = (_data: unknown) => mockRes({});
export const getMyBalanceWheels = () => mockRes([]);
export const getMyLatestBalanceWheel = () => mockRes(null);
export const getAllBalanceWheels = () => mockRes([]);
export const getPlayerBalanceWheels = (_id: string) => mockRes({ data: [] });

// ——— Статистика ———
export const getMoodStats = () => mockRes({ avgMood: 76, avgEnergy: 71, entries: [] });
export const getTestStats = () => mockRes({ completed: 24, total: 30 });
export const getAllPlayersMoodStats = () => mockRes(DEMO_PLAYERS.map((p) => ({ ...p, mood: 75, energy: 70, chartData: DEMO_CHART_DAYS })));
export const getAllPlayersTestStats = () => mockRes(DEMO_PLAYERS.map((p) => ({ ...p, completed: 10, total: 12 })));
export const getAllPlayersBalanceWheelStats = () => mockRes([]);
export const getPlayerMoodChartData = (_id: string) => mockRes(DEMO_CHART_DAYS);
export const getTeamMoodChartData = () => mockRes(DEMO_CHART_DAYS);

// ——— Настроение ———
export const createMoodEntry = (_data: unknown) => mockRes({});
export const getMyMoodEntries = () => mockRes([]);
export const deleteMoodEntry = (_id: string) => mockRes({});
export const getPlayerMoodEntries = (_id: string) => mockRes([]);

// ——— Тесты ———
export const createTestEntry = (_data: unknown) => mockRes({});
export const getMyTestEntries = () => mockRes([]);
export const deleteTestEntry = (_id: string) => mockRes({});
export const getPlayerTestEntries = (_id: string) => mockRes([]);

export const getToken = () => localStorage.getItem("token");
export const getPlayerMoodByDate = (_id: string, _date: string) => mockRes({});
export const getPlayerMoodChartDataByDate = (_id: string, _date: string) => mockRes(DEMO_CHART_DAYS);
export const getPlayerActivityData = (_id: string, _days?: number) => mockRes([]);
export const getAllPlayersMoodStatsByDate = (_date: string) => mockRes([]);

// ——— Faceit ———
export const initFaceitOAuth = () => mockRes({ url: "#" });
export const importFaceitMatches = () => mockRes({});
export const checkFaceitStatus = () => mockRes({ linked: false });

// ——— Аналитика ———
export const getAnalyticsStats = (_a?: string, _b?: string, _c?: string) => mockRes({});
export const getAnalyticsMetrics = (_n?: number) => mockRes([]);
export const saveAnalyticsMetrics = (_data: unknown) => mockRes({});
export const getRecentMatches = (_n?: number) => mockRes([]);
export const refreshAnalyticsCache = () => mockRes({});

export const getAnalyticsMoodStats = () =>
  mockRes([{ userId: "demo", name: "Демо", chartData: DEMO_CHART_DAYS }]);
export const getAnalyticsTestStats = () => mockRes([{ userId: "demo", completed: 10, total: 12 }]);
export const getAnalyticsBalanceWheelStats = () => mockRes([]);
export const getAnalyticsOverview = () =>
  mockRes({ totalPlayers: 3, avgMood: 76, avgEnergy: 71, testsCompleted: 24 });
export const getTestsStateImpact = (_params?: unknown) => mockRes([]);

export const getNotifications = () => mockRes([]);
export const updatePrivilegeKey = async (_key: string) => ({});
export const checkStaffPrivilege = () => mockRes({ hasPrivilege: true });

// ——— Team reports ———
export type { TeamReportFilters };
export const getTeamReports = (_f?: TeamReportFilters) => mockRes({ data: [], total: 0 });
export const getTeamReportById = (_id: string) => mockRes(null);
export const getTeamReportsStats = () => mockRes({ total: 0, published: 0 });
export const createTeamReport = (_data: TeamReportData, _files?: File[]) => mockRes({});
export const updateTeamReport = (_id: string, _data: Partial<TeamReportData>) => mockRes({});
export const updateTeamReportStatus = (_id: string, _status: "draft" | "published" | "archived") => mockRes({});
export const deleteTeamReport = (_id: string) => mockRes({});

// ——— Корреляции и расширенная аналитика: заглушки ———
export const getMoodReportsCorrelations = (_params?: unknown) => Promise.resolve({ data: [], meta: {} });
export const getPerformancePatterns = (_months = 6) => Promise.resolve({ data: [], meta: {} });
export const getBalanceWheelReportsCorrelations = (_params?: unknown) => Promise.resolve({ data: [], meta: {} });
export const getComprehensiveCorrelationAnalysis = (_params?: unknown) =>
  Promise.resolve({
    data: {
      moodCorrelations: [],
      performancePatterns: [],
      balanceCorrelations: [],
      insights: { totalReportsAnalyzed: 0, averageMoodImpact: 0, mostEffectiveReportType: "", overallTrend: "stable" as const },
      generatedAt: new Date().toISOString(),
    },
    meta: {},
  });
export const getCorrelationStats = () => Promise.resolve({ data: {}, meta: {} });

export const getSentimentAnalysis = (_params?: unknown) => Promise.resolve({ data: [], meta: {} });
export const getPlayerClustering = () => Promise.resolve({ data: [], meta: {} });
export const getTimeSeriesAnalysis = (_params: unknown) => Promise.resolve({ data: [], meta: {} });
export const getPredictiveInsights = () => Promise.resolve({ data: [], meta: {} });
export const getTeamPerformanceProfile = () => Promise.resolve({ data: {} as any, meta: {} });
export const getAdvancedAnalyticsReport = (_params?: unknown) => Promise.resolve({ data: {} as any, meta: {} });
export const getAdvancedAnalyticsStats = () => Promise.resolve({ data: {}, meta: {} });

// Имитация axios для компонентов, использующих api.get/post
const noop = () => Promise.resolve({ data: {} });
const api = {
  get: noop,
  post: noop,
  put: noop,
  patch: noop,
  delete: noop,
};
export default api;
