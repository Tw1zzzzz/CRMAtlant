# Поэтапная реализация системы отчетов с корреляционным анализом

## Цель
Разделить реализацию функции отчетов команды с возможностью сравнения данных на управляемые этапы для упрощения разработки.

## Обзор этапов

### Этап 1: Базовая инфраструктура (Foundation) 🟢
**Цель**: Создать основу для работы с отчетами  
**Время**: 1-2 дня  
**Context7**: `/mongodb/docs`, `/expressjs/express`

### Этап 2: CRUD операции для отчетов (Basic Reports) 🟡
**Цель**: Реализовать создание, чтение, обновление и удаление отчетов  
**Время**: 2-3 дня  
**Context7**: `/express-validator/express-validator`, `/automattic/mongoose`

### Этап 3: Интеграция в Analytics UI (Frontend Integration) 🟡
**Цель**: Добавить интерфейс для работы с отчетами в Analytics  
**Время**: 2-3 дня  
**Context7**: React docs, TailwindCSS

### Этап 4: Базовый корреляционный анализ (Basic Correlations) 🟠
**Цель**: Реализовать простые корреляции с настроением  
**Время**: 3-4 дня  
**Context7**: Статистические библиотеки

### Этап 5: Расширенный анализ данных (Advanced Analytics) 🟠
**Цель**: Добавить корреляции с колесом баланса и тестами  
**Время**: 3-4 дня  
**Context7**: ML библиотеки

### Этап 6: Визуализация и дашборды (Visualization) 🔵
**Цель**: Создать интерактивные графики и дашборды  
**Время**: 2-3 дня  
**Context7**: Recharts, D3.js

---

## 🟢 ЭТАП 1: Базовая инфраструктура (Foundation)

### Задачи:
1. ✅ Создать модель `TeamReport` в MongoDB
2. ✅ Настроить базовые API routes
3. ✅ Создать контроллер отчетов
4. ✅ Добавить middleware авторизации

### Файлы для создания/изменения:
- `src/server/models/TeamReport.ts` (новый)
- `src/server/controllers/teamReportsController.ts` (новый)
- `src/server/routes/teamReports.ts` (новый)
- `src/server/types/index.ts` (расширить)

### Context7 документация для получения:
```bash
# MongoDB схемы и валидация
/mongodb/docs

# Express роутинг и middleware
/expressjs/express
```

### Структура модели TeamReport:
```typescript
interface TeamReport {
  _id: ObjectId;
  title: string;
  createdBy: ObjectId; // ref: User
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  visibility: 'team' | 'staff' | 'public';
  content: {
    summary: string;
    details: string;
    recommendations: string[];
    attachments: string[];
  };
  // Поля для будущих этапов
  correlationData?: {
    dateRange: { from: Date; to: Date };
    includedMetrics: string[];
  };
}
```

### API endpoints (Этап 1):
- `POST /api/analytics/reports` - создание отчета
- `GET /api/analytics/reports` - список отчетов
- `GET /api/analytics/reports/:id` - получение отчета
- `PUT /api/analytics/reports/:id` - обновление отчета
- `DELETE /api/analytics/reports/:id` - удаление отчета

### Критерии завершения Этапа 1:
- [ ] Модель TeamReport создана и работает
- [ ] Базовые API routes настроены
- [ ] Middleware авторизации функционирует
- [ ] Можно создать/получить/обновить/удалить отчет через API
- [ ] Unit тесты для модели написаны

---

## 🟡 ЭТАП 2: CRUD операции для отчетов (Basic Reports)

### Задачи:
1. ✅ Реализовать создание отчетов (только staff)
2. ✅ Реализовать получение списка отчетов с фильтрацией
3. ✅ Реализовать получение конкретного отчета
4. ✅ Реализовать обновление отчетов (только автор)
5. ✅ Реализовать удаление отчетов (только автор)
6. ✅ Добавить валидацию данных
7. ✅ Добавить загрузку файлов

### Context7 документация для получения:
```bash
# Валидация запросов
/express-validator/express-validator

# Работа с Mongoose
/automattic/mongoose
```

### Функции контроллера:
```typescript
// teamReportsController.ts
export const createReport = async (req: AuthRequest, res: Response) => {
  // Только staff может создавать отчеты
  // Валидация входных данных
  // Сохранение в БД
};

export const getReports = async (req: AuthRequest, res: Response) => {
  // Фильтрация по роли пользователя
  // Пагинация
  // Поиск по названию
};

export const getReport = async (req: AuthRequest, res: Response) => {
  // Проверка доступа к отчету
  // Возврат данных отчета
};

export const updateReport = async (req: AuthRequest, res: Response) => {
  // Только автор или admin может редактировать
  // Валидация изменений
  // Обновление в БД
};

export const deleteReport = async (req: AuthRequest, res: Response) => {
  // Только автор или admin может удалять
  // Мягкое удаление (архивирование)
};
```

### API функции для frontend (lib/api.ts):
```typescript
export const createTeamReport = (data: Partial<TeamReport>) => 
  retryRequest(() => api.post('/analytics/reports', data));

export const getTeamReports = (filters?: ReportFilters) => 
  retryRequest(() => api.get('/analytics/reports', { params: filters }));

export const getTeamReport = (id: string) => 
  retryRequest(() => api.get(`/analytics/reports/${id}`));

export const updateTeamReport = (id: string, data: Partial<TeamReport>) => 
  retryRequest(() => api.put(`/analytics/reports/${id}`, data));

export const deleteTeamReport = (id: string) => 
  retryRequest(() => api.delete(`/analytics/reports/${id}`));
```

### Критерии завершения Этапа 2:
- [ ] Все CRUD операции работают
- [ ] Валидация данных реализована
- [ ] Проверка ролей функционирует
- [ ] Загрузка файлов работает
- [ ] Integration тесты написаны
- [ ] API документация обновлена

---

## 🟡 ЭТАП 3: Интеграция в Analytics UI (Frontend Integration)

### Задачи:
1. ✅ Добавить новую вкладку "Reports" в Analytics
2. ✅ Создать компонент `ReportsOverview`
3. ✅ Создать компонент `ReportViewer`
4. ✅ Создать компонент `ReportEditor` (только для staff)
5. ✅ Интегрировать с существующим UI дизайном
6. ✅ Добавить состояния загрузки и ошибок

### Файлы для создания/изменения:
- `src/pages/Analytics.tsx` (добавить вкладку reports)
- `src/components/reports/ReportsOverview.tsx` (новый)
- `src/components/reports/ReportViewer.tsx` (новый)
- `src/components/reports/ReportEditor.tsx` (новый)
- `src/types/reports.types.ts` (новый)

### Структура компонентов:
```typescript
// ReportsOverview - список отчетов
interface ReportsOverviewProps {
  reports: TeamReport[];
  onSelectReport: (report: TeamReport) => void;
  onCreateReport?: () => void; // только для staff
  isLoading: boolean;
  error?: string;
}

// ReportViewer - просмотр отчета
interface ReportViewerProps {
  report: TeamReport;
  onEdit?: () => void; // только для автора
  onBack: () => void;
  onDelete?: () => void;
}

// ReportEditor - создание/редактирование
interface ReportEditorProps {
  report?: TeamReport; // undefined для создания
  onSave: (report: Partial<TeamReport>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}
```

### Интеграция в Analytics.tsx:
```typescript
// Добавление новой вкладки в существующий enum
const [activeTab, setActiveTab] = useState<
  'overview' | 'heatmaps' | 'training' | 'detailedStats' | 'reports'
>('overview');

// Новые состояния для отчетов
const [reports, setReports] = useState<TeamReport[]>([]);
const [selectedReport, setSelectedReport] = useState<TeamReport | null>(null);
const [showReportEditor, setShowReportEditor] = useState<boolean>(false);
const [reportsLoading, setReportsLoading] = useState<boolean>(false);
```

### Критерии завершения Этапа 3:
- [ ] Вкладка Reports добавлена в Analytics
- [ ] Все компоненты созданы и работают
- [ ] UI соответствует дизайн-системе
- [ ] Обработка ошибок реализована
- [ ] Component тесты написаны
- [ ] Responsive дизайн работает

---

## 🟠 ЭТАП 4: Базовый корреляционный анализ (Basic Correlations)

### Задачи:
1. ✅ Создать сервис корреляций
2. ✅ Реализовать корреляцию с настроением команды
3. ✅ Добавить API для получения корреляций
4. ✅ Создать базовый компонент визуализации
5. ✅ Интегрировать в просмотр отчетов

### Файлы для создания:
- `src/server/services/correlationService.ts` (новый)
- `src/server/controllers/correlationController.ts` (новый)
- `src/components/reports/CorrelationChart.tsx` (новый)
- `src/types/correlation.types.ts` (новый)

### Context7 документация:
```bash
# Статистические расчеты
# Поиск библиотек для корреляционного анализа

# MongoDB агрегационные запросы
/mongodb/docs
```

### Структура сервиса корреляций:
```typescript
class CorrelationService {
  // Расчет корреляции между датой отчета и настроением команды
  async calculateMoodCorrelation(
    reportDate: Date, 
    teamId?: string
  ): Promise<CorrelationResult> {
    // 1. Получить данные настроения за период ±7 дней от отчета
    // 2. Рассчитать корреляцию Пирсона
    // 3. Определить статистическую значимость
    // 4. Сформировать результат с визуальными данными
  }

  // Анализ изменений настроения до/после отчета
  async analyzeMoodTrends(
    reportDate: Date, 
    teamId?: string
  ): Promise<TrendAnalysis> {
    // 1. Сравнить средние значения до и после отчета
    // 2. Рассчитать процентное изменение
    // 3. Определить статистическую значимость изменений
  }
}
```

### Типы данных корреляций:
```typescript
interface CorrelationResult {
  metric: 'mood' | 'energy' | 'balanceWheel' | 'tests';
  correlation: number; // -1 to 1
  pValue: number; // статистическая значимость
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative' | 'none';
  description: string;
  visualData: ChartDataPoint[];
  sampleSize: number;
}

interface TrendAnalysis {
  beforeReport: {
    average: number;
    count: number;
    dates: string[];
  };
  afterReport: {
    average: number;
    count: number;
    dates: string[];
  };
  change: {
    absolute: number;
    percentage: number;
    isSignificant: boolean;
  };
}
```

### API endpoints (Этап 4):
- `GET /api/analytics/reports/:id/correlations/mood` - корреляции с настроением
- `GET /api/analytics/reports/:id/trends/mood` - анализ трендов настроения

### Компонент визуализации:
```typescript
interface CorrelationChartProps {
  correlationData: CorrelationResult;
  type: 'scatter' | 'line' | 'bar';
  height?: number;
  showDetails?: boolean;
}

const CorrelationChart: React.FC<CorrelationChartProps> = ({ 
  correlationData, 
  type, 
  height = 300,
  showDetails = true 
}) => {
  // Использовать Recharts для визуализации
  // Показать силу корреляции, значимость, тренды
  // Интерактивные элементы для детального просмотра
};
```

### Критерии завершения Этапа 4:
- [ ] Сервис корреляций реализован
- [ ] API корреляций работает
- [ ] Базовая визуализация создана
- [ ] Интеграция в ReportViewer выполнена
- [ ] Статистические расчеты точны
- [ ] Unit тесты для корреляций написаны

---

## 🟠 ЭТАП 5: Расширенный анализ данных (Advanced Analytics)

### Задачи:
1. ✅ Добавить корреляции с колесом баланса (8 сфер)
2. ✅ Добавить корреляции с результатами тестов
3. ✅ Реализовать комплексный анализ всех метрик
4. ✅ Добавить автоматические инсайты
5. ✅ Создать систему рекомендаций

### Расширение сервиса корреляций:
```typescript
// Корреляция с колесом баланса
async calculateBalanceWheelCorrelation(
  reportDate: Date, 
  teamId?: string
): Promise<CorrelationResult[]> {
  // Анализ корреляций по каждой из 8 сфер:
  // physical, emotional, intellectual, spiritual, 
  // occupational, social, environmental, financial
  // Возврат массива результатов для каждой сферы
}

// Корреляция с результатами тестов
async calculateTestCorrelation(
  reportDate: Date, 
  teamId?: string
): Promise<CorrelationResult> {
  // Анализ связи между отчетами и производительностью в тестах
  // Учет еженедельных тестов vs обычных
}

// Комплексный анализ всех метрик
async generateFullAnalysis(reportId: string): Promise<FullAnalysisResult> {
  // Объединение всех типов корреляций
  // Поиск паттернов и взаимосвязей между метриками
  // Определение наиболее влиятельных факторов
  // Генерация общих выводов
}
```

### Сервис инсайтов:
```typescript
class InsightsService {
  // Автоматическая генерация выводов на основе корреляций
  async generateInsights(correlations: CorrelationResult[]): Promise<Insight[]> {
    // Анализ силы и направления корреляций
    // Выявление значимых изменений
    // Формирование понятных выводов
  }

  // Генерация рекомендаций
  async generateRecommendations(
    analysis: FullAnalysisResult
  ): Promise<Recommendation[]> {
    // На основе корреляций предложить действия
    // Приоритизация рекомендаций по важности
    // Связывание с конкретными метриками
  }

  // Определение критических областей для внимания
  async identifyCriticalAreas(
    teamData: TeamMetrics
  ): Promise<CriticalArea[]> {
    // Выявление метрик требующих внимания
    // Предупреждения о негативных трендах
  }
}
```

### Новые типы данных:
```typescript
interface FullAnalysisResult {
  reportId: string;
  generatedAt: Date;
  correlations: {
    mood: CorrelationResult;
    energy: CorrelationResult;
    balanceWheel: CorrelationResult[];
    tests: CorrelationResult;
  };
  insights: Insight[];
  recommendations: Recommendation[];
  criticalAreas: CriticalArea[];
  overallScore: number; // 0-100
}

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  confidence: number; // 0-1
  relatedMetrics: string[];
  supportingData: any;
}

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'training' | 'wellness' | 'performance' | 'team-building';
  title: string;
  description: string;
  expectedImpact: string;
  timeframe: string;
  relatedInsights: string[];
}
```

### API endpoints (Этап 5):
- `GET /api/analytics/reports/:id/correlations/balance-wheel`
- `GET /api/analytics/reports/:id/correlations/tests`
- `GET /api/analytics/reports/:id/analysis/full`
- `GET /api/analytics/reports/:id/insights`
- `GET /api/analytics/reports/:id/recommendations`

### Критерии завершения Этапа 5:
- [ ] Все типы корреляций реализованы
- [ ] Комплексный анализ работает
- [ ] Автоматические инсайты генерируются
- [ ] Система рекомендаций функционирует
- [ ] API полного анализа готово
- [ ] Integration тесты пройдены

---

## 🔵 ЭТАП 6: Визуализация и дашборды (Visualization)

### Задачи:
1. ✅ Создать интерактивные графики корреляций
2. ✅ Реализовать дашборд сравнения метрик
3. ✅ Добавить фильтры по времени и игрокам
4. ✅ Создать экспорт отчетов в PDF
5. ✅ Добавить анимации и интерактивность

### Context7 документация:
```bash
# Библиотеки для графиков
# Recharts или подобные

# PDF генерация
# jsPDF
```

### Интерактивные компоненты:
```typescript
// Интерактивный график корреляций
interface InteractiveCorrelationChartProps {
  data: CorrelationResult[];
  onPointClick: (point: DataPoint) => void;
  filters: ChartFilters;
  onFiltersChange: (filters: ChartFilters) => void;
  allowZoom?: boolean;
  showTooltips?: boolean;
}

// Дашборд метрик
interface MetricsDashboardProps {
  reportId: string;
  dateRange: { from: Date; to: Date };
  selectedMetrics: MetricType[];
  onMetricToggle: (metric: MetricType) => void;
  teamMembers: string[];
  selectedMembers: string[];
  onMembersChange: (members: string[]) => void;
}

// Панель экспорта
interface ExportPanelProps {
  report: TeamReport;
  correlations: CorrelationResult[];
  insights: Insight[];
  recommendations: Recommendation[];
  onExport: (format: 'pdf' | 'excel' | 'csv') => Promise<void>;
  isExporting: boolean;
}
```

### Фильтры и настройки:
```typescript
interface ChartFilters {
  dateRange: { from: Date; to: Date };
  metrics: MetricType[];
  players: string[];
  correlationThreshold: number; // минимальная сила корреляции для отображения
  showOnlySignificant: boolean; // только статистически значимые
}

interface DashboardSettings {
  chartType: 'line' | 'scatter' | 'heatmap' | 'radar';
  aggregation: 'daily' | 'weekly' | 'monthly';
  smoothing: boolean;
  showTrendLines: boolean;
  showConfidenceIntervals: boolean;
}
```

### Экспорт функциональность:
```typescript
class ExportService {
  // Экспорт отчета в PDF
  async exportToPDF(
    report: TeamReport, 
    analysis: FullAnalysisResult,
    charts: ChartData[]
  ): Promise<Blob> {
    // Генерация PDF с отчетом, графиками и анализом
    // Сохранение графиков как изображений
    // Форматирование текста и данных
  }

  // Экспорт данных в Excel
  async exportToExcel(
    report: TeamReport,
    rawData: any[]
  ): Promise<Blob> {
    // Экспорт исходных данных для дальнейшего анализа
    // Несколько листов: отчет, корреляции, рекомендации
  }

  // Экспорт в CSV
  async exportToCSV(data: any[]): Promise<Blob> {
    // Простой экспорт табличных данных
  }
}
```

### Критерии завершения Этапа 6:
- [ ] Интерактивные графики созданы
- [ ] Дашборд метрик работает
- [ ] Фильтры и настройки функционируют
- [ ] Экспорт в разные форматы реализован
- [ ] Анимации и переходы добавлены
- [ ] Performance оптимизирован
- [ ] Responsive дизайн готов

---

## Технические требования к каждому этапу

### Общие зависимости:
```json
{
  "backend": [
    "mongoose", "express", "jsonwebtoken", 
    "express-validator", "multer", "simple-statistics"
  ],
  "frontend": [
    "react", "react-router-dom", "tailwindcss", 
    "recharts", "jspdf", "html2canvas"
  ]
}
```

### Testing Strategy:
- **Unit Tests**: Jest для функций и утилит
- **Integration Tests**: Supertest для API
- **Component Tests**: React Testing Library
- **E2E Tests**: Cypress для критических путей

### Performance Requirements:
- API response time < 2s для базовых операций
- Корреляционный анализ < 5s для стандартного датасета
- UI render time < 500ms для графиков
- PDF export < 10s для полного отчета

---

## Context7 Integration Points

### Для каждого этапа используем:

**Этап 1-2 (Backend)**:
```bash
# MongoDB документация
/mongodb/docs

# Mongoose ODM
/automattic/mongoose

# Express.js framework
/expressjs/express

# Express валидация
/express-validator/express-validator
```

**Этап 3 (Frontend)**:
```bash
# React documentation
# TailwindCSS для стилизации
# TypeScript для типобезопасности
```

**Этап 4-5 (Analytics)**:
```bash
# Статистические библиотеки для корреляций
# ML библиотеки для анализа данных (если потребуется)
```

**Этап 6 (Visualization)**:
```bash
# Recharts для графиков
# D3.js для сложных визуализаций (если потребуется)
# jsPDF для экспорта
```

---

## Критерии готовности каждого этапа

### ✅ Этап считается завершенным когда:
1. Все функции работают без ошибок
2. Написаны и проходят unit/integration тесты
3. Код покрыт документацией
4. Проведена проверка безопасности (для backend)
5. UI/UX проверен и соответствует дизайн-системе
6. Performance оптимизирован

### 📋 Checklist для каждого этапа:
- [ ] Функциональность реализована
- [ ] Тесты написаны и проходят
- [ ] Документация обновлена
- [ ] Code review пройден
- [ ] Безопасность проверена
- [ ] Performance приемлемый
- [ ] UI/UX соответствует стандартам

---

## Следующие шаги

1. **Выбрать этап для начала** (рекомендую Этап 1)
2. **Получить Context7 документацию** для выбранных технологий
3. **Начать реализацию** с создания модели TeamReport
4. **Итеративно добавлять функциональность** по этапам
5. **Тестировать каждый этап** перед переходом к следующему

**С какого этапа хотите начать?** 🚀 