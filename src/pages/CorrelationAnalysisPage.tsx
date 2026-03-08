import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, Clock, Target, BarChart3, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';


/**
 * ?????????? ??? ??????
 */
interface MetricData {
  date: string;
  [key: string]: string | number | null;
  mood: number | null;
  energy: number | null;
  balanceAvg: number | null;
  screenTime: number | null;
  winRate: number | null;
  kdRatio: number | null;
  elo: number | null;
  currentElo: number | null;
  testsScore: number | null;
  testsCount: number | null;
}

interface StatCard {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: string;
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
  [key: string]: string | number | null;
  mood: number | null;
  energy: number | null;
  balanceAvg: number | null;
  screenTime: number | null;
  elo: number | null;
  currentElo: number | null;
  testsScore: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  winRate: number | null;
  kdRatio: number | null;
};


/**
 * РљРѕРјРїРѕРЅРµРЅС‚ СЃС‚СЂР°РЅРёС†С‹ РєРѕСЂСЂРµР»СЏС†РёРѕРЅРЅРѕРіРѕ Р°РЅР°Р»РёР·Р°
 */
const CorrelationAnalysisPage: React.FC = () => {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['mood', 'energy', 'screenTime', 'elo', 'currentElo', 'testsScore']);
  const [chartData, setChartData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [currentElo, setCurrentElo] = useState<number | null>(null);
  
  // РќРѕРІС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РґР»СЏ РІС‹Р±РѕСЂР° игроков
  const [analysisMode, setAnalysisMode] = useState<'team' | 'individual'>('team');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [analysisGameStatsDaily, setAnalysisGameStatsDaily] = useState<DailyGameStatsComparison[]>([]);

  // РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РґР°С‚ (РїРѕСЃР»РµРґРЅРёРµ 30 РґРЅРµР№)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    
    // Р—Р°РіСЂСѓР¶Р°Рµм список игроков
    fetchPlayers();
  }, []);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) return '0';
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };

  const formatPercent = (value: number, decimals = 1) => `${formatNumber(value, decimals)}%`;
  const formatNullable = (value: number | null, decimals = 2) => (value === null ? '' : formatNumber(value, decimals));
  const formatNullablePercent = (value: number | null, decimals = 1) => (value === null ? '' : formatPercent(value, decimals));

  const safeDivide = (numerator: number, denominator: number): number | null => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
    return numerator / denominator;
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
        ...(metric || { date }),
        date,
        kills: game?.kills ?? null,
        deaths: game?.deaths ?? null,
        assists: game?.assists ?? null,
        winRate: game?.winRate ?? metric?.winRate ?? null,
        kdRatio: game?.kdRatio ?? metric?.kdRatio ?? null
      };
    });
  };

  /**
   * Р—Р°РіСЂСѓР·РєР° СЃРїРёСЃРєР° игроков
   */
  const fetchPlayers = async () => {
    setLoadingPlayers(true);
    try {
      // РСЃРїРѕР»СЊР·СѓРµРј РїСЂР°РІРёР»СЊРЅС‹Р№ API endpoint
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
   * Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… РґР»СЏ Р°РЅР°Р»РёР·Р°
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
      // РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј РїР°СЂР°РјРµС‚СЂС‹ Р·Р°РїСЂРѕСЃР°
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

      // Р’С‹РїРѕР»РЅСЏРµРј Р·Р°РїСЂРѕСЃС‹ Рє API РїР°СЂР°Р»Р»РµР»ьно
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
        const metaCurrentElo = typeof result.meta?.currentElo === 'number' ? result.meta.currentElo : null;
        setCurrentElo(metaCurrentElo);
        const metricsWithEloLine = metaCurrentElo != null
          ? metricsData.map((item) => ({ ...item, currentElo: metaCurrentElo }))
          : metricsData;
        let chartMergedData: MetricData[] = metricsWithEloLine;
        if (gameStatsResponse.ok) {
          const gameStatsResult = await gameStatsResponse.json();
          const comparisonRows = buildDailyGameStatsComparison((gameStatsResult.data || []) as GameStatsEntry[]);
          setAnalysisGameStatsDaily(comparisonRows);
          chartMergedData = buildCorrelationComparisonRows(metricsWithEloLine, comparisonRows);
        } else {
          console.error('[CorrelationAnalysisPage] Не удалось загрузить игровые показатели для сравнения:', gameStatsResponse.status);
          setAnalysisGameStatsDaily([]);
        }

        setChartData(chartMergedData);
        
        // Р“РµРЅРµСЂРёСЂСѓРµРј СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєРёРµ РєР°СЂС‚РѕС‡РєРё РЅР° РѕСЃРЅРѕРІРµ СЂРµР°Р»СЊРЅС‹С… РґР°РЅРЅС‹С…
        const realStats = generateStatsFromData(chartMergedData, analysisMode);
        if (metaCurrentElo != null) {
          realStats.push({
            title: 'Текущий ELO',
            value: `${Math.round(metaCurrentElo)}`,
            change: '+0%',
            icon: <Trophy className="h-4 w-4 text-white" />,
            color: 'text-blue-600'
          });
        }
        setStats(realStats);
        
        const playerName = analysisMode === 'individual' && selectedPlayerId 
          ? players.find(p => p._id === selectedPlayerId)?.name || ''
          : 'команды';
        
        toast.success(`  ${analysisMode === 'individual' ? playerName : ''}   (${result.data?.length || 0} )`);
      } else {
        throw new Error(result.message || 'Ошибка при получении данных');
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setAnalysisGameStatsDaily([]);
      setCurrentElo(null);
      toast.error(`Ошибка при загрузке данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateStatsFromData = (data: MetricData[], mode: string): StatCard[] => {
    if (!data || data.length === 0) {
      return [];
    }

    // Р’С‹С‡РёСЃР»СЏРµРј СЃСЂРµРґРЅРёРµ Р·РЅР°С‡Рµния
    const validData = data.filter(d => d.mood !== null || d.energy !== null || d.screenTime !== null || d.winRate !== null || d.testsScore !== null);
    
    if (validData.length === 0) {
      return [];
    }

    const avgMood = validData.filter(d => d.mood !== null).reduce((sum, d) => sum + (d.mood || 0), 0) / validData.filter(d => d.mood !== null).length || 0;
    const avgEnergy = validData.filter(d => d.energy !== null).reduce((sum, d) => sum + (d.energy || 0), 0) / validData.filter(d => d.energy !== null).length || 0;
    const avgBalance = validData.filter(d => d.balanceAvg !== null).reduce((sum, d) => sum + (d.balanceAvg || 0), 0) / validData.filter(d => d.balanceAvg !== null).length || 0;
    const avgScreenTime = validData.filter(d => d.screenTime !== null).reduce((sum, d) => sum + (d.screenTime || 0), 0) / validData.filter(d => d.screenTime !== null).length || 0;
    const avgWinRate = validData.filter(d => d.winRate !== null).reduce((sum, d) => sum + (d.winRate || 0), 0) / validData.filter(d => d.winRate !== null).length || 0;
    const avgTestsScore = validData.filter(d => d.testsScore !== null).reduce((sum, d) => sum + (d.testsScore || 0), 0) / validData.filter(d => d.testsScore !== null).length || 0;

    const prefix = mode === 'team' ? '' : '';
    const suffix = mode === 'team' ? '' : '';

    const stats: StatCard[] = [];

    if (avgMood > 0) {
      stats.push({
        title: `${prefix} настроение ${suffix}`,
        value: avgMood.toFixed(1),
        change: '+0%', // TODO: РІС‹С‡РёСЃР»РёС‚СЊ РёР·РјРµРЅРµРЅРёРµ РїРѕ СЃСЂР°РІРЅРµРЅРёСЋ СЃ РїСЂРµРґС‹РґСѓС‰РёРј РїРµСЂРёРѕРґом
        icon: <Calendar className="h-4 w-4 text-white" />,
        color: 'text-blue-600'
      });
    }

    if (avgEnergy > 0) {
      stats.push({
        title: `${prefix} энергия ${suffix}`,
        value: avgEnergy.toFixed(1),
        change: '+0%',
        icon: <TrendingUp className="h-4 w-4 text-white" />,
        color: 'text-green-600'
      });
    }

    if (avgBalance > 0) {
      stats.push({
        title: `${prefix} баланс жизни ${suffix}`,
        value: avgBalance.toFixed(1),
        change: '+0%',
        icon: <BarChart3 className="h-4 w-4 text-white" />,
        color: 'text-purple-600'
      });
    }

    if (avgScreenTime > 0) {
      stats.push({
        title: `${prefix} экранное время ${suffix}`,
        value: `${avgScreenTime.toFixed(1)}С‡`,
        change: '+0%',
        icon: <Clock className="h-4 w-4 text-white" />,
        color: 'text-orange-600'
      });
    }

    if (avgTestsScore > 0) {
      stats.push({
        title: `${prefix} результат тестов ${suffix}`,
        value: avgTestsScore.toFixed(1),
        change: '+0%',
        icon: <BarChart3 className="h-4 w-4 text-white" />,
        color: 'text-cyan-600'
      });
    }

    if (avgWinRate > 0) {
      stats.push({
        title: `${prefix} Win-Rate ${suffix}`,
        value: `${avgWinRate.toFixed(1)}%`,
        change: '+0%',
        icon: <Target className="h-4 w-4 text-white" />,
        color: 'text-purple-600'
      });
    }

    return stats;
  };

  /**
   * РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ РјРµС‚СЂРёРє РґР»СЏ РѕС‚РѕР±СЂР°Р¶Рµния
   */
  const metricsConfig = {
    mood: { name: 'Настроение', color: '#3b82f6', dataKey: 'mood' },
    energy: { name: 'Энергия', color: '#10b981', dataKey: 'energy' },
    balanceAvg: { name: 'Баланс жизни', color: '#8b5cf6', dataKey: 'balanceAvg' },
    screenTime: { name: 'Экранное время', color: '#f59e0b', dataKey: 'screenTime' },
    testsScore: { name: 'Результат тестов', color: '#22d3ee', dataKey: 'testsScore' },
    currentElo: { name: 'Текущий ELO', color: '#1d4ed8', dataKey: 'currentElo' },
    elo: { name: 'ELO', color: '#2563eb', dataKey: 'elo' },
    winRate: { name: 'Win-Rate', color: '#ef4444', dataKey: 'winRate' },
    kdRatio: { name: 'K/D Ratio', color: '#06b6d4', dataKey: 'kdRatio' }
  };

  /**
   * РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ РІС‹Р±СЂР°РЅРЅС‹С… РјРµтрик
   */
  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  /**
   * РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ СЂРµР¶РёРјР° Р°РЅР°Р»РёР·Р°
   */
  const handleAnalysisModeChange = (mode: 'team' | 'individual') => {
    setAnalysisMode(mode);
    
    // РЎР±СЂР°СЃС‹РІР°РµРј РІС‹Р±СЂР°РЅРЅРѕРіРѕ РёРіСЂРѕРєР° РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё РІ РєРѕРјР°РЅРґРЅС‹Р№ СЂРµР¶им
    if (mode === 'team') {
      setSelectedPlayerId('');
    }
    
    // РЎР±СЂР°СЃС‹РІР°РµРј РґР°РЅРЅС‹Рµ РіСЂР°С„РёРєР°, С‡С‚РѕР±С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р·Р°РЅРѕРІРѕ РЅР°Р¶Р°Р» "РџСЂРёРјРµнить"
    setChartData([]);
    setStats([]);
    setAnalysisGameStatsDaily([]);
      setCurrentElo(null);
  };

  /**
   * РћР±СЂР°Р±РѕС‚РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РёРіСЂРѕРІС‹С… РїРѕРєР°Р·Р°С‚РµР»РµР№
   */
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

  // РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїР° (С‚РѕР»СЊРєРѕ РґР»я staff)
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
        <BarChart3 className="h-8 w-8 text-white" />
        <div>
          <span className="performance-eyebrow">Signal Matrix</span>
          <h1 className="text-3xl font-bold performance-title">Корреляционный анализ</h1>
          <p className="text-muted-foreground performance-subtitle">
            Анализ взаимосвязей между различными метриками игроков
          </p>
        </div>
      </div>

      <div className="w-full">

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки анализа</CardTitle>
              <CardDescription>
                Выберите режим, период и метрики для анализа корреляций
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Р’С‹Р±РѕСЂ СЂРµР¶РёРјР° Р°РЅР°Р»РёР·Р° */}
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

                {/* Р’С‹Р±РѕСЂ РёРіСЂРѕРєР° (РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ РёРЅРґРёРІРёРґСѓР°Р»СЊРЅРѕРј СЂРµР¶РёРјРµ) */}
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

              {/* Р’С‹Р±РѕСЂ РїРµСЂРёРѕРґР° */}
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
                  Экранное время в графике автоматически берётся из ежедневного опросника.
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
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-white opacity-50" />
                    <p>Нажмите «Применить», чтобы загрузить данные</p>
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
                        <p className="text-xl font-semibold">{avgKills === null ? '' : formatNumber(avgKills, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средние смерти/день</p>
                        <p className="text-xl font-semibold">{avgDeaths === null ? '' : formatNumber(avgDeaths, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средние ассисты/день</p>
                        <p className="text-xl font-semibold">{avgAssists === null ? '' : formatNumber(avgAssists, 1)}</p>
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground">Средний Win-Rate</p>
                        <p className="text-xl font-semibold">{avgWinRate === null ? '' : formatPercent(avgWinRate, 1)}</p>
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
                              <td className="border px-3 py-2 text-right">{row.mood === null ? '' : formatNumber(row.mood, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.energy === null ? '' : formatNumber(row.energy, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.balanceAvg === null ? '' : formatNumber(row.balanceAvg, 1)}</td>
                              <td className="border px-3 py-2 text-right">{row.screenTime === null ? '' : formatNumber(row.screenTime, 1)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.kills === null ? '' : formatNumber(row.kills, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.deaths === null ? '' : formatNumber(row.deaths, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.assists === null ? '' : formatNumber(row.assists, 0)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.winRate === null ? '' : formatPercent(row.winRate, 1)}</td>
                              <td className="border px-3 py-2 text-right bg-[#f8fbf4]">{row.kdRatio === null ? '' : formatNumber(row.kdRatio, 2)}</td>
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
        </div>

      </div>
    </div>
  );
};

export default CorrelationAnalysisPage; 
