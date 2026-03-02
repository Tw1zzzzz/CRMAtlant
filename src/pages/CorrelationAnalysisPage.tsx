import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, Clock, Target, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GameStatsForm from '@/components/forms/GameStatsForm';

/**
 * Интерфейсы для данных
 */
interface MetricData {
  date: string;
  mood: number | null;
  energy: number | null;
  balanceAvg: number | null;
  screenTime: number | null;
  winRate: number | null;
  kdRatio: number | null;
  elo: number | null;
}

interface StatCard {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * Интерфейс для данных игровых показателей
 */
interface GameStatsFormData {
  date: string;
  kills: number;
  deaths: number;
  assists: number;
  adr?: number | null;
  kpr?: number | null;
  deathPerRound?: number | null;
  avgKr?: number | null;
  avgKd?: number | null;
  kast?: number | null;
  firstKills?: number | null;
  firstDeaths?: number | null;
  openingDuelDiff?: number | null;
  udr?: number | null;
  avgMultikills?: number | null;
  clutchesWon?: number | null;
  avgFlashTime?: number | null;
  ctSide: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    totalRounds: number;
    roundsWon: number;
    roundsLost: number;
    pistolRounds: number;
    pistolRoundsWon: number;
  };
  tSide: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    totalRounds: number;
    roundsWon: number;
    roundsLost: number;
    pistolRounds: number;
    pistolRoundsWon: number;
  };
  userId?: string;
}

interface GameStatsUser {
  _id?: string;
  name?: string;
  email?: string;
}

interface GameStatsEntry {
  _id: string;
  date: string;
  userId?: string | GameStatsUser;
  kills: number;
  deaths: number;
  assists: number;
  adr?: number | null;
  kpr?: number | null;
  deathPerRound?: number | null;
  avgKr?: number | null;
  avgKd?: number | null;
  kast?: number | null;
  firstKills?: number | null;
  firstDeaths?: number | null;
  openingDuelDiff?: number | null;
  udr?: number | null;
  avgMultikills?: number | null;
  clutchesWon?: number | null;
  avgFlashTime?: number | null;
  kdRatio: number;
  winRate: number;
  totalRounds: number;
  roundsWon: number;
  roundsLost: number;
  roundWinRate: number;
  ctSide?: {
    winRate?: number;
  };
  tSide?: {
    winRate?: number;
  };
}

type TemplateMetric = {
  label: string;
  summary: string;
  values: string[];
};

type DailyGameStatsComparison = {
  date: string;
  entries: number;
  kills: number;
  deaths: number;
  assists: number;
  winRate: number | null;
  kdRatio: number | null;
};

type CorrelationComparisonRow = {
  date: string;
  mood: number | null;
  energy: number | null;
  balanceAvg: number | null;
  screenTime: number | null;
  elo: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  winRate: number | null;
  kdRatio: number | null;
};

/**
 * Компонент страницы корреляционного анализа
 */
const CorrelationAnalysisPage: React.FC = () => {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['mood', 'energy', 'screenTime', 'elo']);
  const [chartData, setChartData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatCard[]>([]);
  
  // Новые состояния для выбора игроков
  const [analysisMode, setAnalysisMode] = useState<'team' | 'individual'>('team');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [gameStatsMode, setGameStatsMode] = useState<'team' | 'individual'>('team');
  const [gameStatsPlayerId, setGameStatsPlayerId] = useState('');
  const [gameStatsRows, setGameStatsRows] = useState<TemplateMetric[]>([]);
  const [gameStatsColumns, setGameStatsColumns] = useState<string[]>([]);
  const [gameStatsLoading, setGameStatsLoading] = useState(false);
  const [gameStatsDateFrom, setGameStatsDateFrom] = useState('');
  const [gameStatsDateTo, setGameStatsDateTo] = useState('');
  const [analysisGameStatsDaily, setAnalysisGameStatsDaily] = useState<DailyGameStatsComparison[]>([]);

  // Инициализация дат (последние 30 дней)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    
    // Загружаем список игроков
    fetchPlayers();
  }, []);

  useEffect(() => {
    if (dateFrom && !gameStatsDateFrom) {
      setGameStatsDateFrom(dateFrom);
    }
    if (dateTo && !gameStatsDateTo) {
      setGameStatsDateTo(dateTo);
    }
  }, [dateFrom, dateTo, gameStatsDateFrom, gameStatsDateTo]);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };

  const formatPercent = (value: number, decimals = 1) => `${formatNumber(value, decimals)}%`;
  const formatNullable = (value: number | null, decimals = 2) => (value === null ? '–' : formatNumber(value, decimals));
  const formatNullablePercent = (value: number | null, decimals = 1) => (value === null ? '–' : formatPercent(value, decimals));

  const safeDivide = (numerator: number, denominator: number): number | null => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
    return numerator / denominator;
  };

  const normalizeGameStatsEntries = (entries: GameStatsEntry[]) => {
    return entries.map((entry, index) => {
      const userName =
        typeof entry.userId === 'object' && entry.userId !== null
          ? entry.userId.name || 'Игрок'
          : 'Игрок';
      const dateLabel = new Date(entry.date).toLocaleDateString('ru-RU');
      return {
        ...entry,
        columnLabel: `№${index + 1}`,
        columnMeta: gameStatsMode === 'team' ? `${userName} • ${dateLabel}` : dateLabel
      };
    });
  };

  const buildTemplateRows = (entries: ReturnType<typeof normalizeGameStatsEntries>): TemplateMetric[] => {
    const totalKills = entries.reduce((sum, e) => sum + (e.kills || 0), 0);
    const totalDeaths = entries.reduce((sum, e) => sum + (e.deaths || 0), 0);
    const totalRounds = entries.reduce((sum, e) => sum + (e.totalRounds || 0), 0);

    const averageNullable = (values: Array<number | null | undefined>): number | null => {
      const filtered = values.filter((value): value is number => Number.isFinite(value as number));
      if (!filtered.length) return null;
      return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
    };

    const avgKD = entries.length
      ? entries.reduce((sum, e) => sum + (e.kdRatio || 0), 0) / entries.length
      : 0;
    const avgWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.winRate || 0), 0) / entries.length
      : 0;
    const avgRoundWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.roundWinRate || 0), 0) / entries.length
      : 0;
    const avgCTWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.ctSide?.winRate || 0), 0) / entries.length
      : 0;
    const avgTWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.tSide?.winRate || 0), 0) / entries.length
      : 0;

    const avgAdr = averageNullable(entries.map((e) => e.adr));
    const avgKpr = averageNullable(entries.map((e) => e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0)));
    const avgDeathPerRound = averageNullable(entries.map((e) => e.deathPerRound ?? safeDivide(e.deaths || 0, e.totalRounds || 0)));
    const avgAvgKr = averageNullable(entries.map((e) => e.avgKr ?? e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0)));
    const avgAvgKd = averageNullable(entries.map((e) => e.avgKd ?? e.kdRatio));
    const avgKast = averageNullable(entries.map((e) => e.kast));
    const avgFirstKills = averageNullable(entries.map((e) => e.firstKills));
    const avgFirstDeaths = averageNullable(entries.map((e) => e.firstDeaths));
    const avgOpeningDuelDiff = averageNullable(
      entries.map((e) => e.openingDuelDiff ?? ((e.firstKills != null && e.firstDeaths != null) ? e.firstKills - e.firstDeaths : null))
    );
    const avgUdr = averageNullable(entries.map((e) => e.udr));
    const avgMultikills = averageNullable(entries.map((e) => e.avgMultikills));
    const avgClutchesWon = averageNullable(entries.map((e) => e.clutchesWon));
    const avgFlashTime = averageNullable(entries.map((e) => e.avgFlashTime));

    return [
      {
        label: 'Total kills',
        summary: formatNumber(totalKills, 0),
        values: entries.map((e) => formatNumber(e.kills || 0, 0))
      },
      {
        label: 'Total deaths',
        summary: formatNumber(totalDeaths, 0),
        values: entries.map((e) => formatNumber(e.deaths || 0, 0))
      },
      {
        label: 'K/D Ratio',
        summary: formatNullable(safeDivide(totalKills, totalDeaths), 2),
        values: entries.map((e) => formatNullable(e.kdRatio ?? safeDivide(e.kills || 0, e.deaths || 0), 2))
      },
      {
        label: 'Rounds played',
        summary: formatNumber(totalRounds, 0),
        values: entries.map((e) => formatNumber(e.totalRounds || 0, 0))
      },
      {
        label: 'ADR (Damage/Round)',
        summary: formatNullable(avgAdr, 1),
        values: entries.map((e) => formatNullable(e.adr ?? null, 1))
      },
      {
        label: 'KPR (Kills/round)',
        summary: formatNullable(avgKpr, 2),
        values: entries.map((e) => formatNullable(e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'Death/round',
        summary: formatNullable(avgDeathPerRound, 2),
        values: entries.map((e) => formatNullable(e.deathPerRound ?? safeDivide(e.deaths || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'AVG KR',
        summary: formatNullable(avgAvgKr, 2),
        values: entries.map((e) => formatNullable(e.avgKr ?? e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'AVG KD',
        summary: formatNullable(avgAvgKd ?? avgKD, 2),
        values: entries.map((e) => formatNullable(e.avgKd ?? e.kdRatio, 2))
      },
      {
        label: 'KAST',
        summary: formatNullablePercent(avgKast, 1),
        values: entries.map((e) => formatNullablePercent(e.kast ?? null, 1))
      },
      {
        label: 'First kills',
        summary: formatNullable(avgFirstKills, 2),
        values: entries.map((e) => formatNullable(e.firstKills ?? null, 2))
      },
      {
        label: 'First deaths',
        summary: formatNullable(avgFirstDeaths, 2),
        values: entries.map((e) => formatNullable(e.firstDeaths ?? null, 2))
      },
      {
        label: 'Разница опен дуэлей',
        summary: formatNullable(avgOpeningDuelDiff, 2),
        values: entries.map((e) =>
          formatNullable(
            e.openingDuelDiff ?? ((e.firstKills != null && e.firstDeaths != null) ? e.firstKills - e.firstDeaths : null),
            2
          )
        )
      },
      {
        label: 'UDR',
        summary: formatNullable(avgUdr, 2),
        values: entries.map((e) => formatNullable(e.udr ?? null, 2))
      },
      {
        label: 'Ср. мультикилы',
        summary: formatNullable(avgMultikills, 2),
        values: entries.map((e) => formatNullable(e.avgMultikills ?? null, 2))
      },
      {
        label: 'Выигранные клатчи',
        summary: formatNullable(avgClutchesWon, 2),
        values: entries.map((e) => formatNullable(e.clutchesWon ?? null, 2))
      },
      {
        label: 'Ср. время ослепления',
        summary: formatNullable(avgFlashTime, 2),
        values: entries.map((e) => formatNullable(e.avgFlashTime ?? null, 2))
      },
      {
        label: 'Win-Rate',
        summary: formatPercent(avgWinRate, 1),
        values: entries.map((e) => formatPercent(e.winRate || 0, 1))
      },
      {
        label: 'Round Win-Rate',
        summary: formatPercent(avgRoundWinRate, 1),
        values: entries.map((e) => formatPercent(e.roundWinRate || 0, 1))
      },
      {
        label: 'CT Win-Rate',
        summary: formatPercent(avgCTWinRate, 1),
        values: entries.map((e) => formatPercent(e.ctSide?.winRate || 0, 1))
      },
      {
        label: 'T Win-Rate',
        summary: formatPercent(avgTWinRate, 1),
        values: entries.map((e) => formatPercent(e.tSide?.winRate || 0, 1))
      }
    ];
  };

  const buildDailyGameStatsComparison = (entries: GameStatsEntry[]): DailyGameStatsComparison[] => {
    const grouped = new Map<string, {
      entries: number;
      kills: number;
      deaths: number;
      assists: number;
      winRateSum: number;
      winRateCount: number;
      kdRatioSum: number;
      kdRatioCount: number;
    }>();

    entries.forEach((entry) => {
      const dateKey = new Date(entry.date).toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          entries: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          winRateSum: 0,
          winRateCount: 0,
          kdRatioSum: 0,
          kdRatioCount: 0
        });
      }

      const bucket = grouped.get(dateKey)!;
      bucket.entries += 1;
      bucket.kills += entry.kills || 0;
      bucket.deaths += entry.deaths || 0;
      bucket.assists += entry.assists || 0;

      if (Number.isFinite(entry.winRate)) {
        bucket.winRateSum += entry.winRate;
        bucket.winRateCount += 1;
      }

      if (Number.isFinite(entry.kdRatio)) {
        bucket.kdRatioSum += entry.kdRatio;
        bucket.kdRatioCount += 1;
      }
    });

    return Array.from(grouped.entries())
      .map(([date, value]) => ({
        date,
        entries: value.entries,
        kills: value.kills,
        deaths: value.deaths,
        assists: value.assists,
        winRate: value.winRateCount ? value.winRateSum / value.winRateCount : null,
        kdRatio: value.kdRatioCount ? value.kdRatioSum / value.kdRatioCount : null
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const buildCorrelationComparisonRows = (
    metricsData: MetricData[],
    gameStatsDaily: DailyGameStatsComparison[]
  ): CorrelationComparisonRow[] => {
    const metricsByDate = new Map(metricsData.map((item) => [item.date, item]));
    const gameStatsByDate = new Map(gameStatsDaily.map((item) => [item.date, item]));
    const allDates = Array.from(new Set([
      ...metricsData.map((item) => item.date),
      ...gameStatsDaily.map((item) => item.date)
    ])).sort((a, b) => a.localeCompare(b));

    return allDates.map((date) => {
      const metric = metricsByDate.get(date);
      const game = gameStatsByDate.get(date);

      return {
        date,
        mood: metric?.mood ?? null,
        energy: metric?.energy ?? null,
        balanceAvg: metric?.balanceAvg ?? null,
        screenTime: metric?.screenTime ?? null,
        elo: metric?.elo ?? null,
        kills: game?.kills ?? null,
        deaths: game?.deaths ?? null,
        assists: game?.assists ?? null,
        winRate: game?.winRate ?? metric?.winRate ?? null,
        kdRatio: game?.kdRatio ?? metric?.kdRatio ?? null
      };
    });
  };

  /**
   * Загрузка списка игроков
   */
  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      // Используем правильный API endpoint
      const response = await fetch('/api/users/players', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const players = await response.json();
        setPlayers(players || []);
      } else {
        console.error('Ошибка загрузки игроков:', response.statusText);
      }
    } catch (error) {
      console.error('Ошибка загрузки игроков:', error);
      toast.error('Ошибка при загрузке списка игроков');
    } finally {
      setLoadingPlayers(false);
    }
  };

  /**
   * Загрузка данных для анализа
   */
  const fetchAnalysisData = async () => {
    if (!dateFrom || !dateTo) {
      toast.error('Выберите период для анализа');
      return;
    }

    if (analysisMode === 'individual' && !selectedPlayerId) {
      toast.error('Выберите игрока для индивидуального анализа');
      return;
    }

    setLoading(true);
    try {
      // Подготавливаем параметры запроса
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        mode: analysisMode
      });
      
      if (analysisMode === 'individual' && selectedPlayerId) {
        params.append('playerId', selectedPlayerId);
      }

      const gameStatsParams = new URLSearchParams({
        startDate: dateFrom,
        endDate: dateTo,
        mode: analysisMode,
        limit: '500',
        page: '1'
      });

      if (analysisMode === 'individual' && selectedPlayerId) {
        gameStatsParams.append('playerId', selectedPlayerId);
      }
      
      console.log('Запрос данных корреляций:', {
        dateFrom,
        dateTo,
        mode: analysisMode,
        playerId: selectedPlayerId
      });

      // Выполняем запросы к API параллельно
      const [response, gameStatsResponse] = await Promise.all([
        fetch(`/api/correlations/multi-metrics?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/game-stats?${gameStatsParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('Получены данные корреляций:', result);
        const metricsData = result.data || [];
        let chartMergedData: MetricData[] = metricsData;
        if (gameStatsResponse.ok) {
          const gameStatsResult = await gameStatsResponse.json();
          const comparisonRows = buildDailyGameStatsComparison((gameStatsResult.data || []) as GameStatsEntry[]);
          setAnalysisGameStatsDaily(comparisonRows);
          chartMergedData = buildCorrelationComparisonRows(metricsData, comparisonRows);
        } else {
          console.error('[CorrelationAnalysisPage] Не удалось загрузить игровые показатели для сравнения:', gameStatsResponse.status);
          setAnalysisGameStatsDaily([]);
        }

        setChartData(chartMergedData);
        
        // Генерируем статистические карточки на основе реальных данных
        const realStats = generateStatsFromData(chartMergedData, analysisMode);
        setStats(realStats);
        
        const playerName = analysisMode === 'individual' && selectedPlayerId 
          ? players.find(p => p._id === selectedPlayerId)?.name || 'игрока'
          : 'команды';
        
        toast.success(`Данные для ${analysisMode === 'individual' ? playerName : 'команды'} успешно загружены (${result.data?.length || 0} дней)`);
      } else {
        throw new Error(result.message || 'Ошибка при получении данных');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setAnalysisGameStatsDaily([]);
      toast.error(`Ошибка при загрузке данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchGameStatsTemplate = async () => {
    if (!gameStatsDateFrom || !gameStatsDateTo) {
      toast.error('Выберите период для таблицы игровых показателей');
      return;
    }

    if (gameStatsMode === 'individual' && !gameStatsPlayerId) {
      toast.error('Выберите игрока для индивидуальной таблицы');
      return;
    }

    setGameStatsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: gameStatsDateFrom,
        endDate: gameStatsDateTo,
        mode: gameStatsMode,
        limit: '200',
        page: '1'
      });

      if (gameStatsMode === 'individual' && gameStatsPlayerId) {
        params.set('playerId', gameStatsPlayerId);
      }

      const response = await fetch(`/api/game-stats?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки таблицы (${response.status})`);
      }

      const result = await response.json();
      const entries = normalizeGameStatsEntries((result.data || []) as GameStatsEntry[]);
      setGameStatsColumns(entries.map((entry) => `${entry.columnLabel}\n${entry.columnMeta}`));
      setGameStatsRows(buildTemplateRows(entries));

      const targetLabel =
        gameStatsMode === 'team'
          ? 'команды'
          : players.find((p) => p._id === gameStatsPlayerId)?.name || 'игрока';
      toast.success(`Таблица игровых показателей для ${targetLabel} обновлена`);
    } catch (error: any) {
      console.error('[CorrelationAnalysisPage] Ошибка загрузки таблицы игровых показателей:', error);
      toast.error(error?.message || 'Не удалось загрузить таблицу игровых показателей');
      setGameStatsColumns([]);
      setGameStatsRows([]);
    } finally {
      setGameStatsLoading(false);
    }
  };

  /**
   * Генерация статистических карточек на основе реальных данных
   */
  const generateStatsFromData = (data: MetricData[], mode: string): StatCard[] => {
    if (!data || data.length === 0) {
      return [];
    }

    // Вычисляем средние значения
    const validData = data.filter(d => d.mood !== null || d.energy !== null || d.screenTime !== null || d.winRate !== null);
    
    if (validData.length === 0) {
      return [];
    }

    const avgMood = validData.filter(d => d.mood !== null).reduce((sum, d) => sum + (d.mood || 0), 0) / validData.filter(d => d.mood !== null).length || 0;
    const avgEnergy = validData.filter(d => d.energy !== null).reduce((sum, d) => sum + (d.energy || 0), 0) / validData.filter(d => d.energy !== null).length || 0;
    const avgBalance = validData.filter(d => d.balanceAvg !== null).reduce((sum, d) => sum + (d.balanceAvg || 0), 0) / validData.filter(d => d.balanceAvg !== null).length || 0;
    const avgScreenTime = validData.filter(d => d.screenTime !== null).reduce((sum, d) => sum + (d.screenTime || 0), 0) / validData.filter(d => d.screenTime !== null).length || 0;
    const avgWinRate = validData.filter(d => d.winRate !== null).reduce((sum, d) => sum + (d.winRate || 0), 0) / validData.filter(d => d.winRate !== null).length || 0;

    const prefix = mode === 'team' ? 'Среднее' : '';
    const suffix = mode === 'team' ? 'команды' : 'игрока';

    const stats: StatCard[] = [];

    if (avgMood > 0) {
      stats.push({
        title: `${prefix} настроение ${suffix}`,
        value: avgMood.toFixed(1),
        change: '+0%', // TODO: вычислить изменение по сравнению с предыдущим периодом
        icon: <Calendar className="h-4 w-4" />,
        color: 'text-blue-600'
      });
    }

    if (avgEnergy > 0) {
      stats.push({
        title: `${prefix} энергия ${suffix}`,
        value: avgEnergy.toFixed(1),
        change: '+0%',
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-green-600'
      });
    }

    if (avgBalance > 0) {
      stats.push({
        title: `${prefix} баланс жизни ${suffix}`,
        value: avgBalance.toFixed(1),
        change: '+0%',
        icon: <BarChart3 className="h-4 w-4" />,
        color: 'text-purple-600'
      });
    }

    if (avgScreenTime > 0) {
      stats.push({
        title: `${prefix} экранное время ${suffix}`,
        value: `${avgScreenTime.toFixed(1)}ч`,
        change: '+0%',
        icon: <Clock className="h-4 w-4" />,
        color: 'text-orange-600'
      });
    }

    if (avgWinRate > 0) {
      stats.push({
        title: `${prefix} Win-Rate ${suffix}`,
        value: `${avgWinRate.toFixed(1)}%`,
        change: '+0%',
        icon: <Target className="h-4 w-4" />,
        color: 'text-purple-600'
      });
    }

    return stats;
  };

  /**
   * Конфигурация метрик для отображения
   */
  const metricsConfig = {
    mood: { name: 'Настроение', color: '#3b82f6', dataKey: 'mood' },
    energy: { name: 'Энергия', color: '#10b981', dataKey: 'energy' },
    balanceAvg: { name: 'Баланс жизни', color: '#8b5cf6', dataKey: 'balanceAvg' },
    screenTime: { name: 'Экранное время', color: '#f59e0b', dataKey: 'screenTime' },
    elo: { name: 'ELO', color: '#2563eb', dataKey: 'elo' },
    winRate: { name: 'Win-Rate', color: '#ef4444', dataKey: 'winRate' },
    kdRatio: { name: 'K/D Ratio', color: '#06b6d4', dataKey: 'kdRatio' }
  };

  /**
   * Обработчик изменения выбранных метрик
   */
  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  /**
   * Обработчик изменения режима анализа
   */
  const handleAnalysisModeChange = (mode: 'team' | 'individual') => {
    setAnalysisMode(mode);
    
    // Сбрасываем выбранного игрока при переключении в командный режим
    if (mode === 'team') {
      setSelectedPlayerId('');
    }
    
    // Сбрасываем данные графика, чтобы пользователь заново нажал "Применить"
    setChartData([]);
    setStats([]);
    setAnalysisGameStatsDaily([]);
  };

  /**
   * Обработка сохранения игровых показателей
   */
  const handleGameStatsSubmit = async (data: GameStatsFormData) => {
    console.log('[CorrelationAnalysisPage] Получены данные для сохранения:', data);
    
    try {
      const token = localStorage.getItem('token');
      console.log('[CorrelationAnalysisPage] Токен:', token ? 'найден' : 'отсутствует');
      
      const response = await fetch('/api/game-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      console.log('[CorrelationAnalysisPage] Ответ сервера:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CorrelationAnalysisPage] Ошибка от сервера:', errorData);
        throw new Error(errorData.message || 'Ошибка при сохранении данных');
      }

      const result = await response.json();
      console.log('[CorrelationAnalysisPage] Игровые показатели сохранены:', result);
      
      toast.success('Игровые показатели успешно сохранены');
      
      // Обновляем данные корреляционного анализа если они загружены
      if (chartData.length > 0) {
        console.log('[CorrelationAnalysisPage] Обновляем данные корреляционного анализа');
        await fetchAnalysisData();
      }

      // Обновляем шаблон игровых показателей, если можно корректно построить выборку
      if (gameStatsMode === 'team' || (gameStatsMode === 'individual' && gameStatsPlayerId)) {
        await fetchGameStatsTemplate();
      }
    } catch (error: any) {
      console.error('[CorrelationAnalysisPage] Ошибка сохранения игровых показателей:', error);
      throw error; // Перебрасываем ошибку чтобы форма могла её обработать
    }
  };

  const comparisonRows = buildCorrelationComparisonRows(chartData, analysisGameStatsDaily);
  const avgKills = analysisGameStatsDaily.length
    ? analysisGameStatsDaily.reduce((sum, row) => sum + row.kills, 0) / analysisGameStatsDaily.length
    : null;
  const avgDeaths = analysisGameStatsDaily.length
    ? analysisGameStatsDaily.reduce((sum, row) => sum + row.deaths, 0) / analysisGameStatsDaily.length
    : null;
  const avgAssists = analysisGameStatsDaily.length
    ? analysisGameStatsDaily.reduce((sum, row) => sum + row.assists, 0) / analysisGameStatsDaily.length
    : null;
  const avgWinRate = analysisGameStatsDaily.length
    ? analysisGameStatsDaily.reduce((sum, row) => sum + (row.winRate || 0), 0) / analysisGameStatsDaily.length
    : null;

  // Проверка доступа (только для staff)
  if (user?.role !== 'staff') {
    return (
      <div className="flex items-center justify-center min-h-screen performance-page">
        <Card className="w-96 performance-hero">
          <CardHeader>
            <CardTitle className="text-center">Доступ ограничен</CardTitle>
            <CardDescription className="text-center">
              Корреляционный анализ доступен только персоналу
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 performance-page">
      <div className="flex items-center space-x-2">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <span className="performance-eyebrow">Signal Matrix</span>
          <h1 className="text-3xl font-bold performance-title">Корреляционный анализ</h1>
          <p className="text-muted-foreground performance-subtitle">
            Анализ взаимосвязей между различными метриками игроков
          </p>
        </div>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analysis">Анализ корреляций</TabsTrigger>
          <TabsTrigger value="game-stats">Игровые показатели</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки анализа</CardTitle>
              <CardDescription>
                Выберите режим, период и метрики для анализа корреляций
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Выбор режима анализа */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="analysisMode">Режим анализа</Label>
                  <Select value={analysisMode} onValueChange={(value: 'team' | 'individual') => handleAnalysisModeChange(value)}>
                    <SelectTrigger id="analysisMode">
                      <SelectValue placeholder="Выберите режим анализа" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Командная статистика</SelectItem>
                      <SelectItem value="individual">Индивидуальная статистика</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Выбор игрока (показывается только в индивидуальном режиме) */}
                {analysisMode === 'individual' && (
                  <div className="space-y-2">
                    <Label htmlFor="playerSelect">Игрок</Label>
                    <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId} disabled={loadingPlayers}>
                      <SelectTrigger id="playerSelect">
                        <SelectValue placeholder={loadingPlayers ? "Загрузка игроков..." : "Выберите игрока"} />
                      </SelectTrigger>
                      <SelectContent>
                        {players.map((player) => (
                          <SelectItem key={player._id} value={player._id}>
                            {player.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Выбор периода */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">С даты</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">По дату</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Действие</Label>
                  <Button 
                    onClick={fetchAnalysisData} 
                    disabled={loading || (analysisMode === 'individual' && !selectedPlayerId)}
                    className="w-full"
                  >
                    {loading ? 'Загрузка...' : 'Применить'}
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <Label className="text-base font-medium">Отображаемые метрики</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Экранное время в графике автоматически берется из ежедневного опросника.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {Object.entries(metricsConfig).map(([key, config]) => (
                    <Button
                      key={key}
                      variant={selectedMetrics.includes(key) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMetricToggle(key)}
                      className="justify-start"
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: config.color }}
                      />
                      {config.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.change}
                        </p>
                      </div>
                      <div className={stat.color}>
                        {stat.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {analysisMode === 'team' 
                  ? 'Динамика метрик команды' 
                  : selectedPlayerId && players.length > 0
                    ? `Динамика метрик игрока: ${players.find(p => p._id === selectedPlayerId)?.name || 'Неизвестный игрок'}`
                    : 'Динамика метрик игрока'
                }
              </CardTitle>
              <CardDescription>
                {analysisMode === 'team' 
                  ? 'Временной график командных метрик для анализа корреляций'
                  : 'Временной график индивидуальных метрик для анализа корреляций'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                      formatter={(value: any, name: any) => [
                        typeof value === 'number' ? value.toFixed(1) : value,
                        metricsConfig[name as keyof typeof metricsConfig]?.name || name
                      ]}
                    />
                    <Legend />
                    {selectedMetrics.map(metric => {
                      const config = metricsConfig[metric as keyof typeof metricsConfig];
                      return (
                        <Line
                          key={metric}
                          type="monotone"
                          dataKey={config.dataKey}
                          stroke={config.color}
                          strokeWidth={2}
                          name={metric}
                          connectNulls={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Нажмите "Применить" для загрузки данных</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Сравнение с игровыми показателями</CardTitle>
                <CardDescription>
                  Сводка игровых показателей за тот же период, чтобы сравнивать их с настроением, энергией и экранным временем.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisGameStatsDaily.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средние убийства/день</p>
                        <p className="text-xl font-semibold">{avgKills === null ? '–' : formatNumber(avgKills, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средние смерти/день</p>
                        <p className="text-xl font-semibold">{avgDeaths === null ? '–' : formatNumber(avgDeaths, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средние ассисты/день</p>
                        <p className="text-xl font-semibold">{avgAssists === null ? '–' : formatNumber(avgAssists, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средний Win-Rate</p>
                        <p className="text-xl font-semibold">{avgWinRate === null ? '–' : formatPercent(avgWinRate, 1)}</p>
                      </div>
                    </div>

                    <div className="overflow-auto rounded-md border">
                      <table className="min-w-[1120px] w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border px-3 py-2 text-left">Дата</th>
                            <th className="border px-3 py-2 text-right">Настроение</th>
                            <th className="border px-3 py-2 text-right">Энергия</th>
                            <th className="border px-3 py-2 text-right">Баланс</th>
                            <th className="border px-3 py-2 text-right">Экранное время</th>
                            <th className="border px-3 py-2 text-right bg-[#f2f7ec]">Kills</th>
                            <th className="border px-3 py-2 text-right bg-[#f2f7ec]">Deaths</th>
                            <th className="border px-3 py-2 text-right bg-[#f2f7ec]">Assists</th>
                            <th className="border px-3 py-2 text-right bg-[#f2f7ec]">Win-Rate</th>
                            <th className="border px-3 py-2 text-right bg-[#f2f7ec]">K/D</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonRows.map((row) => (
                            <tr key={row.date} className="odd:bg-background even:bg-muted/20">
                              <td className="border px-3 py-2 whitespace-nowrap">
                                {new Date(row.date).toLocaleDateString('ru-RU')}
                              </td>
                              <td className="border px-3 py-2 text-right">{row.mood === null ? '–' : formatNumber(row.mood, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.energy === null ? '–' : formatNumber(row.energy, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.balanceAvg === null ? '–' : formatNumber(row.balanceAvg, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.screenTime === null ? '–' : formatNumber(row.screenTime, 1)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.kills === null ? '–' : formatNumber(row.kills, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.deaths === null ? '–' : formatNumber(row.deaths, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.assists === null ? '–' : formatNumber(row.assists, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.winRate === null ? '–' : formatPercent(row.winRate, 1)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.kdRatio === null ? '–' : formatNumber(row.kdRatio, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Для выбранного периода игровые показатели не найдены.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="game-stats" className="space-y-6">
          <Card className="overflow-hidden border-2 border-[#204f14]">
            <CardHeader className="bg-[#204f14] text-[#e8f4df]">
              <CardTitle>Игровые показатели</CardTitle>
              <CardDescription className="text-[#cfe6bf]">
                Рабочая таблица аналитика: вводите данные игрока ниже и сразу обновляйте общую витрину метрик.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-[#eef5e8] p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-2">
                  <Label>Режим</Label>
                  <Select value={gameStatsMode} onValueChange={(value: 'team' | 'individual') => setGameStatsMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Команда</SelectItem>
                      <SelectItem value="individual">Один игрок</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Игрок</Label>
                  <Select
                    value={gameStatsPlayerId}
                    onValueChange={setGameStatsPlayerId}
                    disabled={gameStatsMode !== 'individual' || loadingPlayers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={gameStatsMode === 'individual' ? 'Выберите игрока' : 'Только для режима игрока'} />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player._id} value={player._id}>
                          {player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>С даты</Label>
                  <Input type="date" value={gameStatsDateFrom} onChange={(e) => setGameStatsDateFrom(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>По дату</Label>
                  <Input type="date" value={gameStatsDateTo} onChange={(e) => setGameStatsDateTo(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Действие</Label>
                  <Button className="w-full" onClick={fetchGameStatsTemplate} disabled={gameStatsLoading}>
                    {gameStatsLoading ? 'Загрузка...' : 'Обновить таблицу'}
                  </Button>
                </div>
              </div>

              <div className="overflow-auto border border-[#204f14] rounded-md bg-[#dbe8d4]">
                <table className="min-w-[980px] w-full border-collapse text-[#234b1a]">
                  <thead>
                    <tr className="bg-[#204f14] text-[#e8f4df]">
                      <th className="sticky left-0 z-20 min-w-[260px] border border-[#15360d] px-3 py-2 text-left text-xl font-semibold">
                        Показатели
                      </th>
                      <th className="sticky left-[260px] z-20 min-w-[170px] border border-[#15360d] px-3 py-2 text-left text-xl font-semibold">
                        Данные
                      </th>
                      {gameStatsColumns.map((column, index) => {
                        const [main, meta] = column.split('\n');
                        return (
                          <th key={index} className="min-w-[140px] border border-[#15360d] px-2 py-2 text-center font-semibold">
                            <div>{main}</div>
                            <div className="text-xs font-normal text-[#b8d7a6]">{meta}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {gameStatsRows.length === 0 && !gameStatsLoading && (
                      <tr>
                        <td colSpan={Math.max(2 + gameStatsColumns.length, 3)} className="px-4 py-8 text-center text-sm text-[#3a5e32]">
                          Нажмите "Обновить таблицу", чтобы загрузить игровые показатели.
                        </td>
                      </tr>
                    )}
                    {gameStatsRows.map((row, rowIndex) => (
                      <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-[#dbe8d4]' : 'bg-[#cfe0c8]'}>
                        <td className="sticky left-0 z-10 border border-[#6d8a62] bg-[#204f14] px-3 py-2 text-lg font-semibold text-[#e8f4df]">
                          {row.label}
                        </td>
                        <td className="sticky left-[260px] z-10 border border-[#6d8a62] bg-[#c4d6bd] px-3 py-2 text-lg font-bold">
                          {row.summary}
                        </td>
                        {row.values.map((value, valueIndex) => (
                          <td key={`${row.label}-${valueIndex}`} className="border border-[#6d8a62] px-3 py-2 text-center text-lg">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <GameStatsForm
              onSubmit={handleGameStatsSubmit}
              analysisMode={gameStatsMode}
              onAnalysisModeChange={setGameStatsMode}
              players={players}
              selectedPlayerId={gameStatsPlayerId}
              onSelectedPlayerChange={setGameStatsPlayerId}
              loadingPlayers={loadingPlayers}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorrelationAnalysisPage; 
