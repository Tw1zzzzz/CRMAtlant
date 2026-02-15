# Интеграция системы отчетов команды в Analytics

## Цель
Интегрировать функциональность создания и просмотра отчетов по команде в существующую вкладку "Аналитики", следуя логике: **аналитик заносит данные → игроки смотрят**.

## Анализ текущей системы

### Существующая архитектура Analytics
- **Frontend**: `src/pages/Analytics.tsx` - сложная система с вкладками (overview, heatmaps, training, detailedStats)
- **Backend**: 
  - Controller: `src/server/controllers/analyticsController.ts`
  - Routes: `src/server/routes/analyticsRoutes.ts`
  - Service: `src/server/services/analyticsService.ts`
- **API endpoints**: метрики пользователей, статистика, матчи
- **Роли**: различает игроков (`player`) и персонал (`staff`)

### Текущие возможности
- Просмотр статистики команды и игроков
- Загрузка изображений (heatmaps)
- Переключение между представлениями (команда/личная статистика)
- Различные вкладки аналитики

### Существующие данные для сравнения
- **MoodEntry**: настроение (1-10), энергия (1-10), время дня, комментарии
- **BalanceWheel**: 8 сфер жизни (физическая, эмоциональная, интеллектуальная, духовная, профессиональная, социальная, экологическая, финансовая)
- **TestEntry**: результаты тестов, скриншоты, еженедельные тесты
- **Match**: данные матчей Faceit (если подключены)

## Поэтапный план интеграции

### Этап 1: Модель данных отчетов
Создать модель `TeamReport` для хранения отчетов:

```typescript
interface TeamReport {
  id: string;
  title: string;
  createdBy: string; // ID аналитика
  createdAt: Date;
  updatedAt: Date;
  reportData: {
    // Структура данных отчета
    teamOverview: TeamOverviewData;
    playerAnalysis: PlayerAnalysisData[];
    recommendations: string[];
    attachments: string[]; // URLs файлов
  };
  status: 'draft' | 'published' | 'archived';
  visibility: 'team' | 'staff' | 'public';
  // НОВОЕ: Связи с существующими данными
  correlationData?: {
    dateRange: { from: Date; to: Date };
    includedMetrics: MetricType[];
    correlationResults: CorrelationResult[];
  };
}

interface CorrelationResult {
  metric: MetricType;
  correlation: number; // -1 to 1
  significance: number; // p-value
  description: string;
  visualData: ChartDataPoint[];
}

type MetricType = 'mood' | 'energy' | 'balanceWheel' | 'tests' | 'matches';
```

### Этап 2: Backend расширение
1. **Новый контроллер**: `teamReportsController.ts`
   - `createReport()` - создание отчета (только staff)
   - `updateReport()` - обновление отчета (только staff)
   - `getReports()` - получение списка отчетов
   - `getReport()` - получение конкретного отчета
   - `deleteReport()` - удаление отчета (только staff)
   - **НОВОЕ**: `getReportCorrelations()` - анализ корреляций с метриками
   - **НОВОЕ**: `generateCorrelationReport()` - автогенерация отчета с корреляциями

2. **Новые API routes**: `/api/analytics/reports/*`
   - `POST /reports` - создание отчета
   - `GET /reports` - список отчетов
   - `GET /reports/:id` - конкретный отчет
   - `PUT /reports/:id` - обновление отчета
   - `DELETE /reports/:id` - удаление отчета
   - **НОВОЕ**: `GET /reports/:id/correlations` - корреляции отчета
   - **НОВОЕ**: `POST /reports/generate-correlation` - генерация отчета с корреляциями

3. **Middleware авторизации**: проверка роли для создания/редактирования

4. **НОВОЕ: Сервис корреляций**: `correlationService.ts`
   ```typescript
   class CorrelationService {
     // Расчет корреляции между отчетом и настроением
     async calculateMoodCorrelation(reportDate: Date, playerId?: string): Promise<CorrelationResult>
     
     // Расчет корреляции с колесом баланса
     async calculateBalanceWheelCorrelation(reportDate: Date, playerId?: string): Promise<CorrelationResult>
     
     // Расчет корреляции с результатами тестов
     async calculateTestCorrelation(reportDate: Date, playerId?: string): Promise<CorrelationResult>
     
     // Комплексный анализ всех метрик
     async generateFullCorrelationReport(reportId: string): Promise<CorrelationResult[]>
   }
   ```

### Этап 3: Frontend интеграция
1. **Новая вкладка** в Analytics: `reports`
2. **Компоненты**:
   - `ReportsOverview` - список отчетов
   - `ReportViewer` - просмотр отчета
   - `ReportEditor` - создание/редактирование (только staff)
   - `ReportTemplate` - шаблон отчета
   - **НОВОЕ**: `CorrelationAnalysis` - анализ корреляций
   - **НОВОЕ**: `MetricsComparison` - сравнение с метриками
   - **НОВОЕ**: `CorrelationChart` - визуализация корреляций

### Этап 4: Разграничение доступа
- **Аналитики (staff)**: 
  - Создание отчетов
  - Редактирование отчетов
  - Управление видимостью
  - Загрузка файлов/изображений
  - **НОВОЕ**: Анализ корреляций с всеми метриками
  - **НОВОЕ**: Настройка периодов сравнения
  
- **Игроки (players)**:
  - Просмотр опубликованных отчетов
  - Комментирование (опционально)
  - Экспорт отчетов
  - **НОВОЕ**: Просмотр корреляций своих личных метрик
  - **НОВОЕ**: Сравнение с командными показателями

### Этап 5: UI/UX интеграция
1. **Адаптация существующего интерфейса Analytics**
2. **Использование существующих компонентов**:
   - Карточки статистики
   - Загрузка изображений
   - Переключатели вкладок
3. **Новый функционал**:
   - Редактор отчетов (WYSIWYG)
   - Система шаблонов
   - Экспорт в PDF
   - **НОВОЕ**: Интерактивные графики корреляций
   - **НОВОЕ**: Дашборд сравнения метрик
   - **НОВОЕ**: Временные интервалы для анализа

## НОВОЕ: Функциональность сравнения данных

### Архитектура сравнения
```typescript
interface ComparisonConfig {
  reportId: string;
  metrics: MetricType[];
  dateRange: { from: Date; to: Date };
  players?: string[]; // Если не указано - вся команда
  comparisonType: 'correlation' | 'trend' | 'distribution';
}

interface MetricComparison {
  metric: MetricType;
  reportValue: number | object;
  userValues: { userId: string; value: number | object; }[];
  teamAverage: number | object;
  correlation: {
    coefficient: number;
    pValue: number;
    strength: 'weak' | 'moderate' | 'strong';
    direction: 'positive' | 'negative' | 'none';
  };
  insights: string[];
}
```

### Типы анализа данных

1. **Корреляционный анализ**
   - Связь между результатами отчета и настроением игроков
   - Влияние колеса баланса на показатели отчета
   - Корреляция с результатами тестов

2. **Временной анализ**
   - Динамика изменений до/после отчета
   - Тренды в метриках относительно отчетов
   - Сезонность и цикличность

3. **Сравнительный анализ**
   - Игроки vs команда
   - До vs после внедрения рекомендаций
   - Различные периоды времени

### Визуализация данных

1. **Графики корреляций**
   - Scatter plots для показа связей
   - Heatmaps для множественных корреляций
   - Временные ряды для трендов

2. **Дашборды сравнения**
   - Side-by-side сравнения метрик
   - Overlay графики разных показателей
   - Интерактивные фильтры по времени/игрокам

3. **Сводные отчеты**
   - Автоматические инсайты на основе данных
   - Рекомендации по улучшению
   - Прогнозы на основе исторических данных

## Техническая реализация

### Схема интеграции в Analytics.tsx
```typescript
// Добавление новой вкладки
const [activeTab, setActiveTab] = useState<'overview' | 'heatmaps' | 'training' | 'detailedStats' | 'reports'>('overview');

// Новые состояния для отчетов
const [reports, setReports] = useState<TeamReport[]>([]);
const [selectedReport, setSelectedReport] = useState<TeamReport | null>(null);
const [isEditing, setIsEditing] = useState<boolean>(false);

// НОВОЕ: Состояния для сравнения данных
const [comparisonConfig, setComparisonConfig] = useState<ComparisonConfig | null>(null);
const [correlationResults, setCorrelationResults] = useState<CorrelationResult[]>([]);
const [showComparison, setShowComparison] = useState<boolean>(false);
```

### API интеграция
Расширение существующего `analyticsService.ts`:
```typescript
export const getTeamReports = async (): Promise<TeamReport[]> => {
  // Получение списка отчетов
};

export const createTeamReport = async (reportData: Partial<TeamReport>): Promise<TeamReport> => {
  // Создание нового отчета
};

// НОВОЕ: Функции сравнения данных
export const getReportCorrelations = async (reportId: string, config: ComparisonConfig): Promise<CorrelationResult[]> => {
  // Получение корреляций отчета с метриками
};

export const generateCorrelationReport = async (config: ComparisonConfig): Promise<TeamReport> => {
  // Автогенерация отчета с анализом корреляций
};

export const getMetricComparison = async (reportId: string, metrics: MetricType[]): Promise<MetricComparison[]> => {
  // Сравнение конкретных метрик с отчетом
};
```

## Преимущества данного подхода

1. **Минимальные изменения**: интеграция в существующую систему
2. **Переиспользование кода**: используем существующие компоненты
3. **Ролевая модель**: уже реализованная система разграничения доступа
4. **Масштабируемость**: легко добавлять новые типы отчетов
5. **Консистентность**: единый стиль с остальным приложением
6. **НОВОЕ: Глубокая аналитика**: корреляции и сравнения повышают ценность отчетов
7. **НОВОЕ: Предиктивная аналитика**: возможность прогнозов на основе данных

## План развития

### Фаза 1 (MVP): Базовая функциональность
- Создание/просмотр простых текстовых отчетов
- Загрузка изображений
- Базовое разграничение доступа
- **НОВОЕ**: Простые корреляции с настроением

### Фаза 2: Расширенные возможности
- Шаблоны отчетов
- Интерактивные графики
- Комментарии и обратная связь
- **НОВОЕ**: Полный корреляционный анализ
- **НОВОЕ**: Сравнение с колесом баланса и тестами

### Фаза 3: Аналитика отчетов
- Метрики просмотра отчетов
- A/B тестирование шаблонов
- Автоматическая генерация отчетов
- **НОВОЕ**: Машинное обучение для предсказаний
- **НОВОЕ**: Автоматические инсайты и рекомендации

## НОВЫЕ компоненты для сравнения

### CorrelationDashboard.tsx
```typescript
interface Props {
  reportId: string;
  dateRange: { from: Date; to: Date };
}

const CorrelationDashboard: React.FC<Props> = ({ reportId, dateRange }) => {
  // Показывает корреляции отчета со всеми метриками
  // Интерактивные графики и фильтры
};
```

### MetricsComparisonChart.tsx
```typescript
interface Props {
  reportData: any;
  moodData: MoodEntry[];
  balanceWheelData: BalanceWheel[];
  testData: TestEntry[];
}

const MetricsComparisonChart: React.FC<Props> = ({ reportData, moodData, balanceWheelData, testData }) => {
  // Overlay графики разных метрик для сравнения
};
```

## Следующие шаги

1. Создать модель `TeamReport` в MongoDB
2. Расширить backend API для работы с отчетами
3. Добавить новую вкладку в Analytics
4. Реализовать базовые CRUD операции
5. Настроить разграничение доступа по ролям
6. **НОВОЕ**: Реализовать сервис корреляций
7. **НОВОЕ**: Создать компоненты сравнения данных
8. **НОВОЕ**: Интегрировать визуализацию корреляций 