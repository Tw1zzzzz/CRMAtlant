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
import ScreenTimeForm from '@/components/forms/ScreenTimeForm';
import GameStatsForm from '@/components/forms/GameStatsForm';

/**
 * Интерфейсы для данных
 */
interface MetricData {
  date: string;
  mood: number;
  energy: number;
  balanceAvg: number;
  screenTime: number;
  winRate: number;
  kdRatio: number;
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

/**
 * Компонент страницы корреляционного анализа
 */
const CorrelationAnalysisPage: React.FC = () => {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['mood', 'energy', 'screenTime']);
  const [chartData, setChartData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatCard[]>([]);
  
  // Новые состояния для выбора игроков
  const [analysisMode, setAnalysisMode] = useState<'team' | 'individual'>('team');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Инициализация дат (последние 30 дней)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    
    // Загружаем список игроков
    fetchPlayers();
  }, []);

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
      
      console.log('Запрос данных корреляций:', {
        dateFrom,
        dateTo,
        mode: analysisMode,
        playerId: selectedPlayerId
      });

      // Выполняем запрос к API
      const response = await fetch(`/api/correlations/multi-metrics?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('Получены данные корреляций:', result);
        setChartData(result.data || []);
        
        // Генерируем статистические карточки на основе реальных данных
        const realStats = generateStatsFromData(result.data || [], analysisMode);
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
      toast.error(`Ошибка при загрузке данных: ${error.message}`);
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      console.error('[CorrelationAnalysisPage] Ошибка сохранения игровых показателей:', error);
      throw error; // Перебрасываем ошибку чтобы форма могла её обработать
    }
  };

  // Проверка доступа (только для staff)
  if (user?.role !== 'staff') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Корреляционный анализ</h1>
          <p className="text-muted-foreground">
            Анализ взаимосвязей между различными метриками игроков
          </p>
        </div>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analysis">Анализ корреляций</TabsTrigger>
          <TabsTrigger value="screen-time">Экранное время</TabsTrigger>
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
        </TabsContent>

        <TabsContent value="screen-time" className="space-y-6">
          <div className="flex justify-center">
            <ScreenTimeForm />
          </div>
        </TabsContent>

        <TabsContent value="game-stats" className="space-y-6">
          <div className="flex justify-center">
            <GameStatsForm onSubmit={handleGameStatsSubmit} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorrelationAnalysisPage; 