import axios from 'axios';
import ROUTES from './routes';
import {
  buildTeamReportsPath,
  buildTestsStateImpactPath,
  extractPlayerId,
  normalizeBalanceWheelResponse
} from './apiHelpers';
import type {
  BaselineAssessment,
  BaselineAnswerInput,
  BaselineRole,
  BaselineRoundStrength,
  BaselineSidePreference,
  Plan
} from '@/types';

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Добавляем таймаут для выявления проблем с подключением
  timeout: 15000
});

// Функция для повторных попыток запроса
const retryRequest = async (fn: Function, maxRetries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Ждем перед следующей попыткой
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
};

// Добавление токена к запросам
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Обработка ответов и ошибок
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response) {
    // Обработка ошибок аутентификации
    if (error.response.status === 401 && window.location.pathname !== ROUTES.WELCOME) {
      localStorage.removeItem('token');
      window.location.href = `${ROUTES.WELCOME}?session=expired`;
    }
  }
  
  return Promise.reject(error);
});

// Типы данных для API
interface BalanceWheelData {
  date: Date;
  physical: number;
  emotional: number;
  intellectual: number;
  spiritual: number;
  occupational: number;
  social: number;
  environmental: number;
  financial: number;
}

interface MoodEntryData {
  date: string;
  timeOfDay: "morning" | "afternoon" | "evening";
  mood: number;
  energy: number;
  comment?: string;
}

interface TestEntryData {
  date: Date;
  name?: string;
  link?: string;
  screenshotUrl?: string;
  isWeeklyTest?: boolean;
  testType?: string;
  scoreNormalized?: number;
  rawScore?: number;
  unit?: string;
  durationSec?: number;
  attempts?: number;
  stateSnapshot?: {
    fatigue?: number;
    focus?: number;
    stress?: number;
    sleepHours?: number;
    mood?: number;
    energy?: number;
  };
  context?: {
    matchType?: string;
    map?: string;
    role?: string;
    source?: string;
    notes?: string;
  };
  measuredAt?: string | Date;
}

interface BrainAttemptStartPayload {
  testKey: string;
  batterySessionId?: string;
  clientMeta?: {
    viewport?: { width?: number; height?: number };
    userAgent?: string;
    deviceType?: string;
    refreshRate?: number;
  };
}

interface BrainAttemptCompletePayload {
  rawMetrics: Record<string, unknown>;
  clientMeta?: BrainAttemptStartPayload['clientMeta'];
  stateSnapshot?: TestEntryData['stateSnapshot'];
  context?: TestEntryData['context'];
}

interface PlayerStatusUpdate {
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
}

export interface DailyQuestionnairePayload {
  date?: string;
  mood?: number;
  energy?: number;
  sleepHours?: number;
  sleepStartTime?: string;
  sleepEndTime?: string;
  screenTimeHours?: number;
  screenBreakdown?: {
    entertainment?: number;
    communication?: number;
    browser?: number;
    study?: number;
  };
}

export interface BaselineAssessmentPayload {
  personalityAnswers: BaselineAnswerInput[];
  cs2Role: {
    primaryRole: BaselineRole;
    secondaryRole?: BaselineRole | '';
    sidePreference: BaselineSidePreference;
    roundStrength: BaselineRoundStrength;
  };
}

// Типы данных для API аналитики
interface AnalyticsMetricsData {
  mood: number;
  balanceWheel?: {
    health: number;
    social: number;
    skills: number;
    [key: string]: number;
  };
  matchId?: string;
}

// Вспомогательная функция для извлечения ID из объекта или строки
// API для работы с игроками (для staff)
export const getPlayers = () => retryRequest(() => api.get('/users/players'));
export const getPlayerStats = (playerId: string | any) => 
  retryRequest(() => api.get(`/users/players/${extractPlayerId(playerId)}/stats`));
export const deletePlayer = (playerId: string | any) => 
  retryRequest(() => api.delete(`/users/players/${extractPlayerId(playerId)}`));
export const deletePlayerComplete = (playerId: string | any) => 
  retryRequest(() => api.delete(`/users/players/${extractPlayerId(playerId)}/complete`));
export const updatePlayerStatus = (playerId: string | any, status: PlayerStatusUpdate) => 
  retryRequest(() => api.patch(`/users/players/${extractPlayerId(playerId)}/status`, status));

// API для работы с Колесом Баланса
export const saveBalanceWheel = (data: BalanceWheelData) => retryRequest(() => api.post('/balance-wheel', data));
export const getMyBalanceWheels = () => retryRequest(() => api.get('/balance-wheel/my'));
export const getMyLatestBalanceWheel = () => retryRequest(() => api.get('/balance-wheel/my/latest'));
export const getAllBalanceWheels = () => retryRequest(() => api.get('/balance-wheel/all'));

export const getPlayerBalanceWheels = async (playerId: string | any) => {
  const actualPlayerId = extractPlayerId(playerId);
  
  if (!actualPlayerId) {
    throw new Error('Не указан ID игрока');
  }
  
  try {
    console.log(`[API] Запрос данных колеса баланса для игрока: ${actualPlayerId}`);
    const response = await retryRequest(() => api.get(`/balance-wheel/player/${actualPlayerId}`));
    const normalized = normalizeBalanceWheelResponse(response.data);
    console.log(`[API] Получены данные колеса баланса (${normalized.data.length} записей)`);
    return normalized;
  } catch (error) {
    console.error(`[API] Ошибка при получении данных колеса баланса:`, error);
    
    // В случае 4xx ошибок, пробрасываем их дальше для обработки на уровне компонента
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      throw error;
    }
    
    // В случае 5xx ошибок, возвращаем пустой массив, чтобы UI мог показать запасные данные
    return { data: [] };
  }
};

// API для работы со статистикой
export const getMoodStats = () => retryRequest(() => api.get('/stats/mood'));
export const getSleepStats = () => retryRequest(() => api.get('/stats/sleep'));
export const getTestStats = () => retryRequest(() => api.get('/stats/tests'));
export const getAllPlayersMoodStats = () => retryRequest(() => api.get('/stats/players/mood'));
export const getAllPlayersSleepStats = () => retryRequest(() => api.get('/stats/players/sleep'));
export const getAllPlayersTestStats = () => retryRequest(() => api.get('/stats/players/tests'));
export const getAllPlayersBalanceWheelStats = () => retryRequest(() => api.get('/stats/players/balance-wheel'));
export const getPlayerMoodChartData = (playerId: string | any) => 
  retryRequest(() => api.get(`/stats/players/${extractPlayerId(playerId)}/mood/chart`));

// Получить агрегированные данные о настроении и энергии по дням для дашборда
export const getTeamMoodChartData = () => retryRequest(() => api.get('/stats/team/mood/chart'));

// API для работы с записями о настроении
export const createMoodEntry = (data: MoodEntryData) => retryRequest(() => api.post('/mood', data));
export const getMyMoodEntries = () => retryRequest(() => api.get('/mood/my'));
export const getAllMoodEntries = () => retryRequest(() => api.get('/mood/all'));
export const deleteMoodEntry = (entryId: string) => retryRequest(() => api.delete(`/mood/${entryId}`));
export const getPlayerMoodEntries = (playerId: string | any) => 
  retryRequest(() => api.get(`/mood/player/${extractPlayerId(playerId)}`));

// API для работы с тестами
export const createTestEntry = (data: TestEntryData) => retryRequest(() => api.post('/tests', data));
export const getMyTestEntries = () => retryRequest(() => api.get('/tests/my'));
export const deleteTestEntry = (entryId: string) => retryRequest(() => api.delete(`/tests/${entryId}`));
export const getPlayerTestEntries = (playerId: string | any) => 
  retryRequest(() => api.get(`/tests/player/${extractPlayerId(playerId)}`));

// Вспомогательные функции
export const getToken = () => localStorage.getItem('token');

// API для получения данных о настроении и энергии игроков с фильтрацией по дате
export const getPlayerMoodByDate = (playerId: string | any, date: string) => 
  retryRequest(() => api.get(`/mood/player/${extractPlayerId(playerId)}/by-date?date=${date}`));

// API для получения данных для графика с фильтрацией по дате
export const getPlayerMoodChartDataByDate = (playerId: string | any, date: string) => 
  retryRequest(() => api.get(`/stats/players/${extractPlayerId(playerId)}/mood/chart?date=${date}`));

// API для получения данных активности игрока (для мини-графика)
export const getPlayerActivityData = (playerId: string | any, days: number = 14) => 
  retryRequest(() => api.get(`/stats/players/${extractPlayerId(playerId)}/activity?days=${days}`));

// API для получения всех данных о настроении игроков с фильтрацией по дате
export const getAllPlayersMoodStatsByDate = (date: string) => 
  retryRequest(() => api.get(`/stats/players/mood?date=${date}`));

// API для работы с Faceit
export const initFaceitOAuth = () => retryRequest(() => api.get('/faceit/oauth/init'));
export const importFaceitMatches = () => retryRequest(() => api.post('/faceit/import-matches'));
export const checkFaceitStatus = () => retryRequest(() => api.get('/faceit/status'));

// API для работы с аналитикой
export const getAnalyticsStats = (fromDate?: string, toDate?: string, gameType?: string) => {
  let url = '/analytics/stats';
  const params = [];
  
  if (fromDate) params.push(`from=${fromDate}`);
  if (toDate) params.push(`to=${toDate}`);
  if (gameType) params.push(`type=${gameType}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  return retryRequest(() => api.get(url));
};

export const getAnalyticsMetrics = (limit?: number) => {
  let url = '/analytics/metrics';
  if (limit) url += `?limit=${limit}`;
  
  return retryRequest(() => api.get(url));
};

export const saveAnalyticsMetrics = (data: AnalyticsMetricsData) => 
  retryRequest(() => api.post('/analytics/metrics', data));

export const getRecentMatches = (limit?: number) => {
  let url = '/analytics/matches';
  if (limit) url += `?limit=${limit}`;
  
  return retryRequest(() => api.get(url));
};

export const refreshAnalyticsCache = () => retryRequest(() => api.post('/analytics/refresh-cache'));

// API для аналитики, доступные для всех пользователей
export const getAnalyticsMoodStats = () => retryRequest(() => api.get('/stats/analytics/mood'));
export const getAnalyticsTestStats = () => retryRequest(() => api.get('/stats/analytics/tests'));
export const getAnalyticsBalanceWheelStats = () => retryRequest(() => api.get('/stats/analytics/balance-wheel'));
export const getAnalyticsOverview = () => retryRequest(() => api.get('/stats/analytics/overview'));
export const getTestsStateImpact = (params?: {
  from?: string;
  to?: string;
  testType?: string;
  matchType?: string;
  map?: string;
  role?: string;
  source?: string;
}) => retryRequest(() => api.get(buildTestsStateImpactPath(params)));
export const getTeamTestSummary = (params?: { from?: string; to?: string }) => {
  const search = new URLSearchParams();
  if (params?.from) search.append('from', params.from);
  if (params?.to) search.append('to', params.to);
  const query = search.toString();
  return retryRequest(() => api.get(`/tests/team-summary${query ? `?${query}` : ''}`));
};

export const getNotifications = () => retryRequest(() => api.get('/notifications'));
export const submitDailyQuestionnaire = (data: DailyQuestionnairePayload) =>
  retryRequest(() => api.post('/questionnaires/daily', data));
export const getMyDailyQuestionnaire = (dateFrom: string, dateTo: string) =>
  retryRequest(() => api.get(`/questionnaires/daily/my?dateFrom=${dateFrom}&dateTo=${dateTo}`));
export const getMyBaselineAssessment = () =>
  retryRequest(() => api.get<{ success: true; data: BaselineAssessment | null; baselineAssessmentCompleted: boolean }>('/questionnaires/baseline/me'));
export const submitBaselineAssessment = (data: BaselineAssessmentPayload) =>
  retryRequest(() => api.post<{ success: true; data: BaselineAssessment; baselineAssessmentCompleted: boolean }>('/questionnaires/baseline', data));

export const getBrainTestsCatalog = () => retryRequest(() => api.get('/brain-tests/catalog'));
export const startBrainTestAttempt = (data: BrainAttemptStartPayload) =>
  retryRequest(() => api.post('/brain-tests/attempts/start', data));
export const completeBrainTestAttempt = (attemptId: string, data: BrainAttemptCompletePayload) =>
  retryRequest(() => api.post(`/brain-tests/attempts/${attemptId}/complete`, data));
export const getBrainPerformanceSummary = (window = 30) =>
  retryRequest(() => api.get(`/brain-tests/me/summary?window=${window}`));
export const getBrainTestsHistory = (testKey?: string) =>
  retryRequest(() => api.get(`/brain-tests/me/history${testKey ? `?testKey=${testKey}` : ''}`));

// API для управления ключом привилегий
// Update privilege key (for staff) with enhanced error handling
export const updatePrivilegeKey = async (privilegeKey: string) => {
  try {
    const response = await retryRequest(() => 
      api.post('/users/update-privilege-key', { privilegeKey })
    );
    return response.data;
  } catch (error: any) {
    console.error('API Error - updatePrivilegeKey:', error);
    throw new Error(error.response?.data?.message || 'Ошибка при обновлении ключа привилегий');
  }
};

export const checkStaffPrivilege = () => retryRequest(() => api.get('/users/check-privilege'));

export const getPlans = async (): Promise<Plan[]> => {
  const response = await retryRequest(() => api.get<Plan[]>('/payments/plans'));
  return response.data;
};

export const createInvoice = async (planId: string): Promise<{ paymentUrl: string }> => {
  const response = await retryRequest(() => api.post<{ paymentUrl: string }>('/payments/create-invoice', { planId }));
  return response.data;
};

export interface PaymentSuccessInfo {
  success: boolean;
  planId?: string;
  planName?: string;
  status?: 'pending' | 'active' | 'expired' | 'cancelled';
  hasAccess?: boolean;
  message?: string;
}

export const getPaymentSuccessInfo = async (params: {
  OutSum?: string | null;
  InvId?: string | null;
  SignatureValue?: string | null;
}): Promise<PaymentSuccessInfo> => {
  const query = new URLSearchParams();

  if (params.OutSum) {
    query.set('OutSum', params.OutSum);
  }

  if (params.InvId) {
    query.set('InvId', params.InvId);
  }

  if (params.SignatureValue) {
    query.set('SignatureValue', params.SignatureValue);
  }

  const endpoint = `/payments/success${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await retryRequest(() => api.get<PaymentSuccessInfo>(endpoint));
  return response.data;
};

// ====== TEAM REPORTS API ======

// Типы для отчетов команды
export interface TeamReportData {
  title: string;
  description?: string;
  content: {
    summary?: string;
    details?: string;
    recommendations?: string[];
    sections: Array<{
      title: string;
      content: string;
      order: number;
      type: 'text' | 'markdown' | 'chart' | 'table';
    }>;
    attachments?: Array<{
      filename: string;
      url: string;
      uploadedAt: Date;
    }>;
    tags?: string[];
  };
  type: 'weekly' | 'monthly' | 'custom' | 'match_analysis' | 'training_report';
  visibility: 'team' | 'staff' | 'public';
  assignedTo?: string[];
  viewableBy?: string[];
}

export interface TeamReportResponse {
  _id: string;
  title: string;
  description?: string;
  content: TeamReportData['content'];
  type: TeamReportData['type'];
  visibility: TeamReportData['visibility'];
  status: 'draft' | 'published' | 'archived';
  createdBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  assignedTo?: Array<{
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  }>;
  viewableBy?: Array<{
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamReportFilters {
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

// API функции для работы с отчетами команды
export const getTeamReports = (filters?: TeamReportFilters) => {
  return retryRequest(() => api.get(buildTeamReportsPath(filters)));
};

export const getTeamReportById = (reportId: string) => 
  retryRequest(() => api.get(`/team-reports/${reportId}`));

export const getTeamReportsStats = () => 
  retryRequest(() => api.get('/team-reports/stats'));

export const createTeamReport = (data: TeamReportData, files?: File[]) => {
  const formData = new FormData();
  
  // Добавляем данные отчета
  formData.append('title', data.title);
  if (data.description) formData.append('description', data.description);
  formData.append('content', JSON.stringify(data.content));
  formData.append('type', data.type);
  formData.append('visibility', data.visibility);
  
  if (data.assignedTo && data.assignedTo.length > 0) {
    formData.append('assignedTo', JSON.stringify(data.assignedTo));
  }
  
  if (data.viewableBy && data.viewableBy.length > 0) {
    formData.append('viewableBy', JSON.stringify(data.viewableBy));
  }
  
  // Добавляем файлы если они есть
  if (files && files.length > 0) {
    files.forEach((file) => {
      formData.append('attachments', file);
    });
  }
  
  return retryRequest(() => api.post('/team-reports', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }));
};

export const updateTeamReport = (reportId: string, data: Partial<TeamReportData>) =>
  retryRequest(() => api.put(`/team-reports/${reportId}`, data));

export const updateTeamReportStatus = (reportId: string, status: 'draft' | 'published' | 'archived') =>
  retryRequest(() => api.patch(`/team-reports/${reportId}/status`, { status }));

export const deleteTeamReport = (reportId: string) =>
  retryRequest(() => api.delete(`/team-reports/${reportId}`));

// ============ КОРРЕЛЯЦИОННЫЙ АНАЛИЗ ============

// Интерфейсы для корреляционного анализа
export interface CorrelationResult {
  correlation: number;
  pValue?: number;
  significance: 'high' | 'medium' | 'low' | 'none';
  sampleSize: number;
  confidence: number;
}

export interface ReportMoodCorrelation {
  reportId: string;
  reportTitle: string;
  reportType: string;
  reportDate: string;
  correlations: {
    beforeAfter: {
      moodBefore: number;
      moodAfter: number;
      change: number;
      changePercent: number;
    };
    timeWindow: {
      weekBefore: number[];
      weekAfter: number[];
      correlation: CorrelationResult;
    };
  };
}

export interface TeamPerformancePattern {
  period: string;
  reportsCount: number;
  avgMoodBeforeReports: number;
  avgMoodAfterReports: number;
  moodTrend: 'improving' | 'declining' | 'stable';
  reportTypes: Array<{
    type: string;
    count: number;
    avgMoodImpact: number;
  }>;
}

export interface BalanceWheelReportCorrelation {
  reportId: string;
  reportTitle: string;
  balanceAreas: Array<{
    area: string;
    beforeReport: number;
    afterReport: number;
    change: number;
    correlation: CorrelationResult;
  }>;
  overallBalance: {
    before: number;
    after: number;
    improvement: number;
  };
}

export interface ComprehensiveCorrelationAnalysis {
  moodCorrelations: ReportMoodCorrelation[];
  performancePatterns: TeamPerformancePattern[];
  balanceCorrelations: BalanceWheelReportCorrelation[];
  insights: {
    totalReportsAnalyzed: number;
    averageMoodImpact: number;
    mostEffectiveReportType: string;
    overallTrend: 'improving' | 'declining' | 'stable';
  };
  generatedAt: string;
}

export interface CorrelationStats {
  totalReportsAnalyzed: number;
  avgMoodImpact: number;
  positiveImpactReports: number;
  negativeImpactReports: number;
  highCorrelations: number;
  currentTrend: 'improving' | 'declining' | 'stable';
  lastAnalysisDate: string;
}

export interface CorrelationAssistantSummaryCard {
  title: string;
  value: string;
}

export interface CorrelationAssistantMetricSummary {
  metric: string;
  label: string;
  points: number;
  average: number;
  min: number;
  max: number;
  firstValue: number;
  lastValue: number;
  absoluteChange: number;
  percentChange: number | null;
  trend: 'upward' | 'downward' | 'stable';
  forecastNext7Days: number | null;
}

export interface CorrelationAssistantCorrelationPair {
  leftMetric: string;
  leftLabel: string;
  rightMetric: string;
  rightLabel: string;
  coefficient: number;
  sampleSize: number;
  strength: 'high' | 'medium' | 'low';
  direction: 'positive' | 'negative';
}

export interface CorrelationAssistantRequest {
  analysisMode: 'team' | 'individual';
  currentElo: number | null;
  dateFrom: string;
  dateTo: string;
  faceitMetricsStatus: 'ok' | 'partial' | 'unavailable';
  playerName?: string;
  selectedMetrics: string[];
  summaryCards: CorrelationAssistantSummaryCard[];
  totalRows: number;
  metricSummaries: CorrelationAssistantMetricSummary[];
  strongestCorrelations: CorrelationAssistantCorrelationPair[];
}

export interface CorrelationAssistantResponse {
  trend: string;
  forecast: string;
  conclusion: string;
  keySignals: string[];
  risks: string[];
  recommendedFocus: string[];
  confidence: number;
  model: string;
  fallbackUsed?: boolean;
  generatedAt: string;
}

// API функции для корреляционного анализа

/**
 * Получить корреляции между отчетами команды и настроением игроков
 */
export const getMoodReportsCorrelations = async (params?: {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
}): Promise<{ data: ReportMoodCorrelation[]; meta: any }> => {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);
  if (params?.teamId) searchParams.append('teamId', params.teamId);

  const queryString = searchParams.toString();
  const url = `/correlations/mood-reports${queryString ? `?${queryString}` : ''}`;

  const response = await retryRequest(() => api.get(url));
  return response.data;
};

/**
 * Получить паттерны производительности команды
 */
export const getPerformancePatterns = async (monthsBack: number = 6): Promise<{ data: TeamPerformancePattern[]; meta: any }> => {
  const response = await retryRequest(() => api.get(`/correlations/performance-patterns?monthsBack=${monthsBack}`));
  return response.data;
};

/**
 * Получить корреляции между отчетами и колесом баланса
 */
export const getBalanceWheelReportsCorrelations = async (params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: BalanceWheelReportCorrelation[]; meta: any }> => {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

  const queryString = searchParams.toString();
  const url = `/correlations/balance-wheel-reports${queryString ? `?${queryString}` : ''}`;

  const response = await retryRequest(() => api.get(url));
  return response.data;
};

/**
 * Получить комплексный корреляционный анализ
 */
export const getComprehensiveCorrelationAnalysis = async (params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: ComprehensiveCorrelationAnalysis; meta: any }> => {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

  const queryString = searchParams.toString();
  const url = `/correlations/comprehensive${queryString ? `?${queryString}` : ''}`;

  const response = await retryRequest(() => api.get(url));
  return response.data;
};

/**
 * Получить статистику корреляционного анализа
 */
export const getCorrelationStats = async (): Promise<{ data: CorrelationStats; meta: any }> => {
  const response = await retryRequest(() => api.get('/correlations/stats'));
  return response.data;
};

export const getCorrelationAssistantInsight = async (
  payload: CorrelationAssistantRequest,
): Promise<{ data: CorrelationAssistantResponse; meta: any }> => {
  const response = await retryRequest(() => api.post('/correlations/ai-assistant', payload));
  return response.data;
};

// ============ РАСШИРЕННАЯ АНАЛИТИКА ============

// Интерфейсы для расширенной аналитики
export interface SentimentAnalysis {
  reportId: string;
  reportTitle: string;
  overallSentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  emotionalTone: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    confidence: number;
    surprise: number;
  };
  keyPhrases: string[];
  recommendedActions: string[];
}

export interface PlayerCluster {
  clusterId: number;
  clusterName: string;
  playerIds: string[];
  characteristics: {
    avgMoodScore: number;
    responsiveness: 'high' | 'medium' | 'low';
    preferredReportTypes: string[];
    optimalReportTiming: string;
    strengths: string[];
    improvementAreas: string[];
  };
  recommendedStrategies: string[];
}

export interface TimeSeriesPattern {
  metric: string;
  pattern: 'seasonal' | 'cyclical' | 'trending' | 'random';
  seasonality?: {
    period: string;
    amplitude: number;
    phase: number;
  };
  trend?: {
    direction: 'upward' | 'downward' | 'stable';
    strength: number;
    acceleration: number;
  };
  forecast: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
}

export interface PredictiveInsight {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'improving' | 'declining' | 'stable';
  timeframe: string;
  factors: string[];
}

export interface TeamPerformanceProfile {
  profileId: string;
  profileName: string;
  activePlayersCount: number;
  overallHealthScore: number;
  strengthAreas: string[];
  riskAreas: string[];
  recommendedInterventions: {
    priority: 'high' | 'medium' | 'low';
    intervention: string;
    expectedImpact: number;
    timeframe: string;
  }[];
  nextReviewDate: string;
}

export interface AdvancedAnalyticsReport {
  generatedAt: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  executiveSummary: {
    overallScore: number;
    keyFindings: string[];
    criticalAlerts: string[];
    successMetrics: string[];
  };
  predictiveInsights: PredictiveInsight[];
  sentimentAnalysis: SentimentAnalysis[];
  playerClusters: PlayerCluster[];
  timeSeriesPatterns: TimeSeriesPattern[];
  teamProfile: TeamPerformanceProfile;
  actionPlan: {
    immediateActions: string[];
    shortTermGoals: string[];
    longTermStrategies: string[];
  };
}

// API функции для расширенной аналитики

/**
 * Получить анализ сентимента отчетов команды
 */
export const getSentimentAnalysis = async (params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: SentimentAnalysis[]; meta: any }> => {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

  const queryString = searchParams.toString();
  const url = `/advanced-analytics/sentiment${queryString ? `?${queryString}` : ''}`;

  const response = await retryRequest(() => api.get(url));
  return response.data;
};

/**
 * Получить кластерный анализ игроков
 */
export const getPlayerClustering = async (): Promise<{ data: PlayerCluster[]; meta: any }> => {
  const response = await retryRequest(() => api.get('/advanced-analytics/clustering'));
  return response.data;
};

/**
 * Получить анализ временных рядов
 */
export const getTimeSeriesAnalysis = async (params: {
  metric: 'mood' | 'balance' | 'activity';
  daysBack?: number;
}): Promise<{ data: TimeSeriesPattern[]; meta: any }> => {
  const searchParams = new URLSearchParams();
  searchParams.append('metric', params.metric);
  if (params.daysBack) searchParams.append('daysBack', params.daysBack.toString());

  const response = await retryRequest(() => api.get(`/advanced-analytics/time-series?${searchParams.toString()}`));
  return response.data;
};

/**
 * Получить прогнозные инсайты
 */
export const getPredictiveInsights = async (): Promise<{ data: PredictiveInsight[]; meta: any }> => {
  const response = await retryRequest(() => api.get('/advanced-analytics/predictions'));
  return response.data;
};

/**
 * Получить профиль производительности команды
 */
export const getTeamPerformanceProfile = async (): Promise<{ data: TeamPerformanceProfile; meta: any }> => {
  const response = await retryRequest(() => api.get('/advanced-analytics/team-profile'));
  return response.data;
};

/**
 * Получить комплексный расширенный аналитический отчет
 */
export const getAdvancedAnalyticsReport = async (params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: AdvancedAnalyticsReport; meta: any }> => {
  const searchParams = new URLSearchParams();
  if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
  if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

  const queryString = searchParams.toString();
  const url = `/advanced-analytics/comprehensive-report${queryString ? `?${queryString}` : ''}`;

  const response = await retryRequest(() => api.get(url));
  return response.data;
};

/**
 * Получить быструю статистику расширенной аналитики
 */
export const getAdvancedAnalyticsStats = async (): Promise<{ data: any; meta: any }> => {
  const response = await retryRequest(() => api.get('/advanced-analytics/stats'));
  return response.data;
};

// ============ СОСТОЯНИЕ ИГРОКА ============

import type { PlayerStateReport } from '@/types/playerState.types';

/**
 * Получить AI-анализ состояния текущего пользователя
 */
const validatePlayerStateReport = (data: unknown): PlayerStateReport => {
  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as PlayerStateReport).report !== 'string' ||
    typeof (data as PlayerStateReport).zones !== 'object' ||
    !(data as PlayerStateReport).zones
  ) {
    throw new Error('Некорректный формат ответа от сервера');
  }
  return data as PlayerStateReport;
};

export const getPlayerStateAnalysis = async (): Promise<PlayerStateReport> => {
  const response = await retryRequest(() => api.get('/player-state/analyze'));
  return validatePlayerStateReport(response.data.data);
};

/**
 * Получить AI-анализ состояния конкретного игрока (только для staff)
 */
export const getPlayerStateAnalysisForPlayer = async (
  playerId: string,
): Promise<PlayerStateReport> => {
  const response = await retryRequest(() =>
    api.get(`/player-state/analyze/${playerId}`),
  );
  return validatePlayerStateReport(response.data.data);
};

export default api;
