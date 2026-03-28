import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, AlertCircle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import BodyVisualization from '@/components/body/BodyVisualization';
import ZoneDetailCard from '@/components/body/ZoneDetailCard';
import LifestyleRadar from '@/components/body/LifestyleRadar';
import { getPlayerStateAnalysis } from '@/lib/api';
import type { BodyZone, PlayerStateReport } from '@/types/playerState.types';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: PlayerStateReport;
  timestamp: number;
}

const ZONES_ORDER: BodyZone[] = ['head', 'eyes', 'chest', 'arms', 'back', 'legs'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the first numeric value from a dataBreakdown string like "K/D: 1.42" */
const extractNumeric = (str: string): number | null => {
  const match = str.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

/** Find a breakdown item whose label matches a keyword (case-insensitive) */
const findBreakdown = (items: string[], ...keywords: string[]): string | undefined =>
  items.find((item) =>
    keywords.some((kw) => item.toLowerCase().includes(kw.toLowerCase())),
  );

// ─── Loading skeletons ────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span>AI анализирует ваши данные...</span>
    </div>
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-4/5" />
    <div className="pt-2 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const SkeletonCards = () => (
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
    {Array.from({ length: 6 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Metric group cards ───────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricRow = ({ label, value, sub, trend }: MetricRowProps) => (
  <div className="flex items-center justify-between py-1.5 border-b last:border-0 border-border/50">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
      {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
      {trend === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
      <span className="text-xs font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  </div>
);

interface MetricCardProps {
  title: string;
  metrics: MetricRowProps[];
  badge?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
}

const MetricCard = ({ title, metrics, badge }: MetricCardProps) => (
  <Card>
    <CardHeader className="pb-2 pt-3 px-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {badge && (
          <Badge variant={badge.variant} className="text-xs font-normal">
            {badge.label}
          </Badge>
        )}
      </div>
    </CardHeader>
    <CardContent className="px-4 pb-3">
      {metrics.map((m, i) => (
        <MetricRow key={i} {...m} />
      ))}
    </CardContent>
  </Card>
);

// ─── Build metric cards from report data ─────────────────────────────────────

const buildCognitionMetrics = (report: PlayerStateReport): MetricRowProps[] => {
  const bd = report.zones.head.dataBreakdown;
  const metrics: MetricRowProps[] = [];
  const attention = findBreakdown(bd, 'Внимание', 'attention');
  if (attention) {
    const val = extractNumeric(attention);
    metrics.push({ label: 'Внимание', value: val !== null ? `${val}/100` : '—', trend: val !== null ? (val >= 75 ? 'up' : val >= 50 ? 'neutral' : 'down') : 'neutral' });
  }
  const memory = findBreakdown(bd, 'Рабочая память', 'memory');
  if (memory) {
    const val = extractNumeric(memory);
    metrics.push({ label: 'Рабочая память', value: val !== null ? `${val}/100` : '—', trend: val !== null ? (val >= 75 ? 'up' : val >= 50 ? 'neutral' : 'down') : 'neutral' });
  }
  const reaction = findBreakdown(report.zones.eyes.dataBreakdown, 'Go/No-Go', 'Реакция', 'reaction');
  if (!reaction) {
    const reactionHead = findBreakdown(bd, 'Реакция');
    if (reactionHead) {
      const val = extractNumeric(reactionHead);
      metrics.push({ label: 'Реакция', value: val !== null ? `${val}/100` : '—', trend: val !== null ? (val >= 75 ? 'up' : val >= 50 ? 'neutral' : 'down') : 'neutral' });
    }
  }
  const flex = findBreakdown(report.zones.eyes.dataBreakdown, 'Гибкость', 'flexibility');
  if (flex) {
    const val = extractNumeric(flex);
    metrics.push({ label: 'Когнитивная гибкость', value: val !== null ? `${val}/100` : '—', trend: val !== null ? (val >= 75 ? 'up' : val >= 50 ? 'neutral' : 'down') : 'neutral' });
  }
  if (metrics.length === 0) {
    metrics.push({ label: 'Когнитивный балл', value: `${report.zones.head.score}/100` });
  }
  return metrics;
};

const buildPsychologyMetrics = (report: PlayerStateReport): MetricRowProps[] => {
  const bd = report.zones.chest.dataBreakdown;
  const metrics: MetricRowProps[] = [];
  const mood = findBreakdown(bd, 'Настроение');
  if (mood) {
    const val = extractNumeric(mood);
    metrics.push({ label: 'Настроение (ср. 14д)', value: val !== null ? `${val}/10` : '—', trend: val !== null ? (val >= 7 ? 'up' : val >= 5 ? 'neutral' : 'down') : 'neutral' });
  }
  const energy = findBreakdown(report.zones.back.dataBreakdown, 'Энергия');
  if (energy) {
    const val = extractNumeric(energy);
    metrics.push({ label: 'Энергия', value: val !== null ? `${val}/10` : '—', trend: val !== null ? (val >= 7 ? 'up' : val >= 5 ? 'neutral' : 'down') : 'neutral' });
  }
  const stress = findBreakdown(bd, 'Стресс');
  if (stress) {
    const val = extractNumeric(stress);
    metrics.push({ label: 'Стресс', value: val !== null ? `${val}/10` : '—', trend: val !== null ? (val <= 4 ? 'up' : val <= 6 ? 'neutral' : 'down') : 'neutral' });
  }
  const emotional = findBreakdown(bd, 'Эмоции');
  if (emotional) {
    const val = extractNumeric(emotional);
    metrics.push({ label: 'Эмоц. баланс (колесо)', value: val !== null ? `${val}/100` : '—' });
  }
  if (metrics.length === 0) {
    metrics.push({ label: 'Психологический балл', value: `${report.zones.chest.score}/100` });
  }
  return metrics;
};

const buildLifestyleMetrics = (report: PlayerStateReport): MetricRowProps[] => {
  const eyesBd = report.zones.eyes.dataBreakdown;
  const legsBd = report.zones.legs.dataBreakdown;
  const metrics: MetricRowProps[] = [];
  const screenTime = findBreakdown(eyesBd, 'Экранное время');
  if (screenTime) {
    const val = extractNumeric(screenTime);
    metrics.push({ label: 'Экранное время', value: val !== null ? `${val} ч/день` : '—', trend: val !== null ? (val <= 6 ? 'up' : val <= 9 ? 'neutral' : 'down') : 'neutral' });
  }
  const entertainment = findBreakdown(eyesBd, 'Развлечения');
  if (entertainment) {
    const val = extractNumeric(entertainment);
    metrics.push({ label: 'Развлечения', value: val !== null ? `${val} ч/день` : '—' });
  }
  // Balance wheel avg from legs breakdown
  const bwScores = legsBd
    .map((item) => extractNumeric(item))
    .filter((v): v is number => v !== null);
  if (bwScores.length > 0) {
    const avgBw = Math.round(bwScores.reduce((a, b) => a + b, 0) / bwScores.length);
    metrics.push({ label: 'Колесо баланса (ср.)', value: `${avgBw}/100`, trend: avgBw >= 75 ? 'up' : avgBw >= 50 ? 'neutral' : 'down' });
  }
  if (metrics.length === 0) {
    metrics.push({ label: 'Образ жизни', value: `${report.zones.legs.score}/100` });
  }
  return metrics;
};

const buildGameMetrics = (report: PlayerStateReport): MetricRowProps[] => {
  const bd = report.zones.arms.dataBreakdown;
  const metrics: MetricRowProps[] = [];
  const kd = findBreakdown(bd, 'K/D');
  if (kd) {
    const val = extractNumeric(kd);
    metrics.push({ label: 'K/D', value: val !== null ? val.toFixed(2) : 'нет данных', trend: val !== null ? (val >= 1.5 ? 'up' : val >= 1.0 ? 'neutral' : 'down') : 'neutral' });
  }
  const winRate = findBreakdown(bd, 'Win Rate', 'Win');
  if (winRate) {
    const val = extractNumeric(winRate);
    metrics.push({ label: 'Win Rate', value: val !== null ? `${val.toFixed(1)}%` : 'нет данных', trend: val !== null ? (val >= 55 ? 'up' : val >= 45 ? 'neutral' : 'down') : 'neutral' });
  }
  const matches = findBreakdown(bd, 'Матч');
  if (matches) {
    const val = extractNumeric(matches);
    metrics.push({ label: 'Матчей (30д)', value: val !== null ? `${Math.round(val)}` : '—' });
  }
  if (metrics.length === 0 || (metrics.length === 0 && bd.some((item) => item.includes('отсутствуют')))) {
    metrics.push({ label: 'K/D', value: 'нет данных' });
    metrics.push({ label: 'Win Rate', value: 'нет данных' });
    metrics.push({ label: 'ADR', value: 'нет данных' });
  }
  return metrics;
};

// ─── Main component ───────────────────────────────────────────────────────────

const StatePage = () => {
  const [report, setReport] = useState<PlayerStateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<BodyZone | undefined>();
  const cacheRef = useRef<CacheEntry | null>(null);

  const fetchReport = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < CACHE_DURATION_MS) {
        setReport(cacheRef.current.data);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getPlayerStateAnalysis();
      cacheRef.current = { data, timestamp: Date.now() };
      setReport(data);
    } catch (err: unknown) {
      console.error('[StatePage] Ошибка загрузки отчёта:', err);
      setError('Не удалось загрузить анализ состояния. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleZoneClick = (zone: BodyZone) => {
    setSelectedZone((prev) => (prev === zone ? undefined : zone));
  };

  const formatDate = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const hasData = !!report;
  const isEmpty =
    !loading &&
    !error &&
    (!hasData || report.dataUsed.length === 0);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Профиль состояния</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-анализ когнитивного, психологического и игрового состояния
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchReport(true)}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Info className="h-10 w-10 opacity-40" />
            <p className="text-base font-medium">Недостаточно данных для анализа</p>
            <p className="text-sm max-w-md">
              Заполните дневник настроения и пройдите тесты, чтобы получить персональный отчёт о
              состоянии.
            </p>
          </div>
        </Card>
      )}

      {/* Error state */}
      {error && !loading && (
        <Card className="p-6 border-destructive">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">Ошибка загрузки анализа</p>
              <p className="text-sm opacity-80">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchReport(true)}>
                Попробовать снова
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Row 1: Body | Radar | AI report */}
      {(loading || hasData) && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Body visualization */}
          <div className="flex items-center justify-center min-h-[320px] relative">
            {loading && !report && (
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <RefreshCw className="h-10 w-10 animate-spin opacity-40" />
                <span className="text-sm">AI анализирует ваши данные...</span>
              </div>
            )}
            {report && (
              <BodyVisualization
                zones={report.zones}
                onZoneClick={handleZoneClick}
                selectedZone={selectedZone}
              />
            )}
          </div>

          {/* Col 2: Lifestyle radar */}
          <div className="flex flex-col items-center justify-center">
            {loading && !report ? (
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-1/3 mx-auto" />
                <Skeleton className="h-[220px] w-full rounded-lg" />
              </div>
            ) : (
              report && <LifestyleRadar zones={report.zones} />
            )}
          </div>

          {/* Col 3: AI report text */}
          <div className="space-y-5">
            {loading && !report ? (
              <LoadingSkeleton />
            ) : (
              report && (
                <>
                  {/* Fallback notice */}
                  {report.fallbackUsed && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md border border-amber-200 dark:border-amber-900">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      Анализ выполнен без AI (API недоступен), данные вычислены алгоритмически
                    </div>
                  )}

                  {/* Report text */}
                  <div className="space-y-3">
                    {report.report.split('\n').filter(Boolean).map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed text-foreground">
                        {para}
                      </p>
                    ))}
                  </div>

                  {/* Recommendations */}
                  {report.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Рекомендации</h3>
                      <ul className="space-y-1.5">
                        {report.recommendations.map((rec, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground flex items-start gap-2"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Data used */}
                  {report.dataUsed.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Данные использованы
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {report.dataUsed.map((d, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-normal">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground pt-1 space-y-0.5 border-t">
                    <p>
                      <span className="font-medium">Сформировано:</span>{' '}
                      {formatDate(report.generatedAt)}
                    </p>
                    <p>
                      <span className="font-medium">Модель:</span> {report.model}
                    </p>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Row 2: Metric group cards */}
      {(loading || hasData) && !error && (
        <div className="mt-8">
          <h2 className="text-base font-semibold mb-3">Факторы состояния</h2>
          {loading && !report ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-5/6" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            report && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  title="Когниции"
                  metrics={buildCognitionMetrics(report)}
                  badge={{
                    label: report.zones.head.label,
                    variant:
                      report.zones.head.severity === 'ok'
                        ? 'default'
                        : report.zones.head.severity === 'warning'
                        ? 'secondary'
                        : 'destructive',
                  }}
                />
                <MetricCard
                  title="Психология"
                  metrics={buildPsychologyMetrics(report)}
                  badge={{
                    label: report.zones.chest.label,
                    variant:
                      report.zones.chest.severity === 'ok'
                        ? 'default'
                        : report.zones.chest.severity === 'warning'
                        ? 'secondary'
                        : 'destructive',
                  }}
                />
                <MetricCard
                  title="Образ жизни"
                  metrics={buildLifestyleMetrics(report)}
                  badge={{
                    label: report.zones.legs.label,
                    variant:
                      report.zones.legs.severity === 'ok'
                        ? 'default'
                        : report.zones.legs.severity === 'warning'
                        ? 'secondary'
                        : 'destructive',
                  }}
                />
                <MetricCard
                  title="Игра"
                  metrics={buildGameMetrics(report)}
                  badge={{
                    label: report.zones.arms.label,
                    variant:
                      report.zones.arms.severity === 'ok'
                        ? 'default'
                        : report.zones.arms.severity === 'warning'
                        ? 'secondary'
                        : 'destructive',
                  }}
                />
              </div>
            )
          )}
        </div>
      )}

      {/* Row 3: Zone detail cards */}
      {(loading || hasData) && !error && (
        <>
          <div className="mt-8 mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold">Детализация по зонам</h2>
            {selectedZone && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setSelectedZone(undefined)}
              >
                Сбросить выбор
              </Button>
            )}
          </div>

          {loading && !report ? (
            <SkeletonCards />
          ) : (
            report && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {ZONES_ORDER.map((zone) => (
                  <ZoneDetailCard
                    key={zone}
                    zone={zone}
                    data={report.zones[zone]}
                    isSelected={selectedZone === zone}
                    onClick={() => handleZoneClick(zone)}
                  />
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default StatePage;
