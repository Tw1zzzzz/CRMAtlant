import axios from 'axios';
import ROUTES from './routes';

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api',
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
  name: string;
  link: string;
  screenshotUrl?: string;
  isWeeklyTest?: boolean;
}

interface PlayerStatusUpdate {
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
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
const extractPlayerId = (playerId: string | any): string => {
  // Логгируем входные данные для отладки
  console.log('[API] extractPlayerId получил:', typeof playerId, playerId);
  
  // Случай 1: Объект игрока
  if (typeof playerId === 'object' && playerId !== null) {
    // Если объект содержит ObjectId, извлекаем из него строку
    if (playerId._id && typeof playerId._id === 'object' && playerId._id.toString) {
      const id = playerId._id.toString();
      console.log(`[API] Извлечено ID из объекта с ObjectId:`, id);
      return id;
    }
    // Иначе ищем ID в других свойствах объекта
    const id = playerId._id || playerId.userId || playerId.id;
    if (id) {
      console.log(`[API] Извлечено ID из объекта:`, id);
      return id;
    }
  }
  
  // Случай 2: Строка, которая может содержать объект
  if (typeof playerId === 'string') {
    // Пытаемся найти ID в формате MongoDB ObjectId
    // Например: new ObjectId("67e857c1c92acc6a7c9bfe5e")
    const objectIdMatch = playerId.match(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/);
    if (objectIdMatch && objectIdMatch[1]) {
      console.log('[API] Извлечено ID из ObjectId строки:', objectIdMatch[1]);
      return objectIdMatch[1];
    }
    
    // Пытаемся найти ID в формате JSON с _id полем
    const jsonIdMatch = playerId.match(/_id['":\s]+(['"])([0-9a-fA-F]{24})(['"])/);
    if (jsonIdMatch && jsonIdMatch[2]) {
      console.log('[API] Извлечено ID из JSON строки:', jsonIdMatch[2]);
      return jsonIdMatch[2];
    }
    
    // Если строка сама является валидным MongoDB ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(playerId)) {
      return playerId;
    }
    
    // Попытка разобрать JSON
    try {
      if (playerId.includes('{') && playerId.includes('}')) {
        const jsonObj = JSON.parse(playerId.replace(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/g, '"$1"'));
        if (jsonObj && jsonObj._id) {
          console.log('[API] Извлечено ID из разобранного JSON:', jsonObj._id);
          return jsonObj._id;
        }
      }
    } catch (error) {
      console.error('[API] Ошибка при разборе JSON строки:', error);
    }
  }
  
  // Возвращаем исходное значение, если не удалось извлечь ID
  return playerId;
};

// API для работы с игроками (для staff)
export const getPlayers = () => retryRequest(() => api.get('/users/players?debug=true'));
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
    
    // Проверяем и нормализуем формат данных
    if (response.data && typeof response.data === 'object') {
      // Если ответ в формате { data: [...] }
      if (Array.isArray(response.data.data)) {
        console.log(`[API] Получены данные колеса баланса (${response.data.data.length} записей) в формате data.data`);
        return { data: response.data.data };
      } 
      // Если ответ сам является массивом
      else if (Array.isArray(response.data)) {
        console.log(`[API] Получены данные колеса баланса (${response.data.length} записей) в формате data`);
        return { data: response.data };
      } 
      // Если ответ в другом формате - преобразуем в массив из одного элемента
      else {
        console.log(`[API] Получены данные колеса баланса в нестандартном формате, преобразуем`);
        const normalizedData = response.data.wheels || response.data.data || [response.data];
        return { data: Array.isArray(normalizedData) ? normalizedData : [normalizedData] };
      }
    }
    
    // Если данных нет или неверный формат, возвращаем пустой массив
    console.log(`[API] Получен пустой или некорректный ответ, возвращаем пустой массив`);
    return { data: [] };
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
export const getTestStats = () => retryRequest(() => api.get('/stats/tests'));
export const getAllPlayersMoodStats = () => retryRequest(() => api.get('/stats/players/mood'));
export const getAllPlayersTestStats = () => retryRequest(() => api.get('/stats/players/tests'));
export const getAllPlayersBalanceWheelStats = () => retryRequest(() => api.get('/stats/players/balance-wheel'));
export const getPlayerMoodChartData = (playerId: string | any) => 
  retryRequest(() => api.get(`/stats/players/${extractPlayerId(playerId)}/mood/chart`));

// Получить агрегированные данные о настроении и энергии по дням для дашборда
export const getTeamMoodChartData = () => retryRequest(() => api.get('/stats/team/mood/chart'));

// API для работы с записями о настроении
export const createMoodEntry = (data: MoodEntryData) => retryRequest(() => api.post('/mood', data));
export const getMyMoodEntries = () => retryRequest(() => api.get('/mood/my'));
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
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });
  }
  const queryString = params.toString();
  return retryRequest(() => api.get(`/team-reports${queryString ? `?${queryString}` : ''}`));
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

export default api; 