import axios from 'axios';

type TrendDirection = 'upward' | 'downward' | 'stable';
type CorrelationStrength = 'high' | 'medium' | 'low';
type CorrelationDirection = 'positive' | 'negative';
type FaceitMetricsStatus = 'ok' | 'partial' | 'unavailable';

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
  trend: TrendDirection;
  forecastNext7Days: number | null;
}

export interface CorrelationAssistantCorrelationPair {
  leftMetric: string;
  leftLabel: string;
  rightMetric: string;
  rightLabel: string;
  coefficient: number;
  sampleSize: number;
  strength: CorrelationStrength;
  direction: CorrelationDirection;
}

export interface CorrelationAssistantPayload {
  analysisMode: 'team' | 'individual';
  currentElo: number | null;
  dateFrom: string;
  dateTo: string;
  faceitMetricsStatus: FaceitMetricsStatus;
  playerName?: string;
  selectedMetrics: string[];
  summaryCards: CorrelationAssistantSummaryCard[];
  totalRows: number;
  metricSummaries: CorrelationAssistantMetricSummary[];
  strongestCorrelations: CorrelationAssistantCorrelationPair[];
}

interface CorrelationAssistantContext {
  payload: CorrelationAssistantPayload;
  comprehensive: {
    totalReportsAnalyzed: number;
    averageMoodImpact: number;
    mostEffectiveReportType: string;
    overallTrend: 'improving' | 'declining' | 'stable';
    recentPatterns: Array<{
      period: string;
      moodTrend: 'improving' | 'declining' | 'stable';
      reportsCount: number;
      avgMoodAfterReports: number;
    }>;
  };
}

export interface CorrelationAssistantInsight {
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

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/auto';

const toFixed = (value: number, digits = 1) => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return value.toFixed(digits);
};

const normalizeStringArray = (input: unknown, maxItems = 4) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
};

const extractJsonObject = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (_error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (_nestedError) {
      return null;
    }
  }
};

const buildFallbackInsight = ({
  payload,
  comprehensive,
}: CorrelationAssistantContext): CorrelationAssistantInsight => {
  const primaryMetric = payload.metricSummaries[0];
  const secondaryMetric = payload.metricSummaries[1];
  const primaryCorrelation = payload.strongestCorrelations[0];

  const upwardMetrics = payload.metricSummaries.filter((metric) => metric.trend === 'upward').length;
  const downwardMetrics = payload.metricSummaries.filter((metric) => metric.trend === 'downward').length;

  const trend = primaryMetric
    ? `Главная динамика периода смещена в сторону ${primaryMetric.label.toLowerCase()}: показатель ${primaryMetric.trend === 'upward' ? 'растёт' : primaryMetric.trend === 'downward' ? 'снижается' : 'остается стабильным'}, а общий фон по ${payload.analysisMode === 'team' ? 'команде' : 'игроку'} выглядит ${upwardMetrics >= downwardMetrics ? 'скорее поддерживающим' : 'напряжённым'}. Комплексный анализ отчётов дополнительно показывает тренд "${comprehensive.overallTrend}".`
    : `По собранным данным выраженной доминирующей метрики не обнаружено, поэтому тенденция оценивается как смешанная. Комплексный анализ отчётов указывает на состояние "${comprehensive.overallTrend}".`;

  const forecast = primaryMetric
    ? `Если текущий темп сохранится ещё 7 дней, ${primaryMetric.label.toLowerCase()} может выйти к уровню около ${toFixed(primaryMetric.forecastNext7Days ?? primaryMetric.lastValue, primaryMetric.label.includes('K/D') ? 2 : 1)}. ${secondaryMetric ? `Дополнительно стоит следить за метрикой "${secondaryMetric.label}", потому что её изменение сейчас идёт в том же аналитическом окне.` : ''}`
    : 'Прогноз на ближайшую неделю остаётся осторожным: данных достаточно для наблюдения, но мало для уверенного численного сценария.';

  const conclusion = primaryCorrelation
    ? `Самая сильная связь сейчас между "${primaryCorrelation.leftLabel}" и "${primaryCorrelation.rightLabel}" (${primaryCorrelation.direction === 'positive' ? 'положительная' : 'обратная'} корреляция ${toFixed(primaryCorrelation.coefficient, 2)}). Это значит, что именно на этой паре метрик стоит проверять гипотезы и управленческие решения в первую очередь.`
    : `Главный вывод периода: данных уже достаточно для мониторинга трендов, но сильные межметрические связи пока выражены умеренно. Лучше опираться на серию наблюдений и обновить анализ после накопления нового окна данных.`;

  const risks = [
    payload.faceitMetricsStatus !== 'ok'
      ? 'Часть FACEIT-метрик недоступна, поэтому игровые выводы могут быть неполными.'
      : '',
    primaryMetric && primaryMetric.trend === 'downward'
      ? `Ключевая метрика "${primaryMetric.label}" сейчас снижается и требует отдельной проверки причин.`
      : '',
    comprehensive.averageMoodImpact < 0
      ? 'Средний эффект отчётов на настроение отрицательный, значит формат коммуникации команды стоит пересмотреть.'
      : '',
  ].filter(Boolean);

  const recommendedFocus = [
    primaryCorrelation
      ? `Проверьте связку "${primaryCorrelation.leftLabel} <-> ${primaryCorrelation.rightLabel}" на уровне отдельных дней и событий.`
      : 'Соберите ещё 1-2 недели данных, чтобы усилить надёжность корреляций.',
    comprehensive.mostEffectiveReportType
      ? `Используйте формат отчёта "${comprehensive.mostEffectiveReportType}" как базовый при следующих коммуникациях.`
      : 'Сравните эффективность разных типов отчётов на следующем цикле наблюдений.',
    primaryMetric
      ? `Держите ${primaryMetric.label.toLowerCase()} как главную контрольную метрику ближайшей недели.`
      : 'Оставьте набор выбранных метрик неизменным ещё на один период для стабильного сравнения.',
  ].filter(Boolean);

  return {
    trend,
    forecast,
    conclusion,
    keySignals: [
      `${payload.totalRows} дневных срезов в анализе`,
      `${payload.metricSummaries.length} метрик с достаточной историей`,
      comprehensive.totalReportsAnalyzed > 0
        ? `${comprehensive.totalReportsAnalyzed} командных отчётов вошли в контекст`
        : 'Контекст отчётов ограничен',
    ],
    risks,
    recommendedFocus,
    confidence: Math.min(
      92,
      45
        + payload.metricSummaries.length * 3
        + payload.strongestCorrelations.length * 4
        + Math.min(payload.totalRows, 21),
    ),
    model: 'local-fallback',
    fallbackUsed: true,
    generatedAt: new Date().toISOString(),
  };
};

const buildPrompt = ({ payload, comprehensive }: CorrelationAssistantContext) => ({
  system: `Ты аналитический AI-ассистент для киберспортивной команды.
Отвечай только на русском языке.
Смотри на данные осторожно: не придумывай причин, если они не следуют из цифр.
Главный порядок анализа обязателен:
1. Сначала оцени состояние игрока или команды по внеигровым метрикам: настроение, энергия, сон, баланс жизни, экранное время, результаты тестов и другие wellbeing-сигналы.
2. Только после этого свяжи состояние с игровыми показателями: пракк-статистикой, FACEIT-метриками, ELO и боевыми результатами.
3. Если игровые и внеигровые сигналы расходятся, явно укажи это и не позволяй игровым метрикам вытеснить вывод о состоянии.
4. В разделах trend, forecast и conclusion сначала говори о состоянии, затем о влиянии на игру.
5. Не делай главным выводом игровой показатель, если есть выраженные изменения во внеигровых метриках.
6. Обязательно выдели закономерности между игровыми и внеигровыми данными: какие игровые метрики растут или падают вместе с настроением, энергией, балансом, экранным временем или результатами тестов.
7. Если находишь заметную связь между игровыми и внеигровыми метриками, называй её прямо и простым языком, например: "при росте энергии улучшается K/D" или "при ухудшении настроения падает винрейт".
8. Если убедительных закономерностей между игровыми и внеигровыми данными нет, тоже скажи это явно.
Нужно вернуть только JSON-объект без markdown и без дополнительного текста.
Формат ответа:
{
  "trend": "2-4 предложения о главной тенденции периода",
  "forecast": "2-4 предложения с аккуратным прогнозом на 7-14 дней",
  "conclusion": "2-4 предложения с итоговым выводом для штаба/игрока, включая главные закономерности между игровыми и внеигровыми метриками",
  "keySignals": ["короткий сигнал 1", "короткий сигнал 2"],
  "risks": ["короткий риск 1", "короткий риск 2"],
  "recommendedFocus": ["короткий фокус 1", "короткий фокус 2"],
  "confidence": 0-100
}
Если уверенность низкая, прямо укажи это в тексте. Не пиши ничего кроме JSON.`,
  user: JSON.stringify(
    {
      period: {
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
      },
      analysisMode: payload.analysisMode,
      playerName: payload.playerName || null,
      selectedMetrics: payload.selectedMetrics,
      analysisPriority: {
        primary: [
          'mood',
          'energy',
          'sleepHours',
          'balanceAvg',
          'screenTime',
          'brainPerformanceIndex',
        ],
        secondary: [
          'winRate',
          'kdRatio',
          'kills',
          'deaths',
          'assists',
          'adr',
          'kast',
          'currentElo',
          'faceitMatches',
          'faceitWinRate',
          'faceitKdRatio',
          'faceitAdr',
          'faceitKast',
          'faceitKr',
          'faceitHsPercent',
          'faceitKills',
          'faceitDeaths',
          'faceitAssists',
        ],
      },
      totalRows: payload.totalRows,
      faceitMetricsStatus: payload.faceitMetricsStatus,
      currentElo: payload.currentElo,
      summaryCards: payload.summaryCards,
      metricSummaries: payload.metricSummaries,
      strongestCorrelations: payload.strongestCorrelations,
      comprehensive,
    },
    null,
    2,
  ),
});

export const generateCorrelationAssistantInsight = async (
  context: CorrelationAssistantContext,
): Promise<CorrelationAssistantInsight> => {
  const apiKey = process.env.OPENROUTER_API_KEY || '';

  if (!apiKey) {
    return buildFallbackInsight(context);
  }

  const prompt = buildPrompt(context);

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: prompt.user,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'Esports Mood Tracker',
        },
        timeout: 30000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? extractJsonObject(content) : null;

    if (!parsed) {
      return buildFallbackInsight(context);
    }

    return {
      trend: String(parsed.trend || '').trim() || buildFallbackInsight(context).trend,
      forecast: String(parsed.forecast || '').trim() || buildFallbackInsight(context).forecast,
      conclusion: String(parsed.conclusion || '').trim() || buildFallbackInsight(context).conclusion,
      keySignals: normalizeStringArray(parsed.keySignals),
      risks: normalizeStringArray(parsed.risks),
      recommendedFocus: normalizeStringArray(parsed.recommendedFocus),
      confidence: Number.isFinite(parsed.confidence) ? Number(parsed.confidence) : buildFallbackInsight(context).confidence,
      model: response.data?.model || DEFAULT_MODEL,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[CorrelationAI] Ошибка запроса к OpenRouter:', error);
    return buildFallbackInsight(context);
  }
};
