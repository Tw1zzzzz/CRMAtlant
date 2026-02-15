import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  Target,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle,
  Minus,
  ArrowUp,
  ArrowDown,
  Equal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from "@/styles/theme";
import {
  getMoodReportsCorrelations,
  getPerformancePatterns,
  getBalanceWheelReportsCorrelations,
  getComprehensiveCorrelationAnalysis,
  getCorrelationStats,
  ReportMoodCorrelation,
  TeamPerformancePattern,
  BalanceWheelReportCorrelation,
  ComprehensiveCorrelationAnalysis,
  CorrelationStats,
  CorrelationResult
} from '@/lib/api';

const CorrelationAnalysis: React.FC = () => {
  // Состояния
  const [loading, setLoading] = useState(true);
  const [isFeatureInDevelopment, setIsFeatureInDevelopment] = useState(false);
  const [correlationStats, setCorrelationStats] = useState<CorrelationStats | null>(null);
  const [moodCorrelations, setMoodCorrelations] = useState<ReportMoodCorrelation[]>([]);
  const [performancePatterns, setPerformancePatterns] = useState<TeamPerformancePattern[]>([]);
  const [balanceCorrelations, setBalanceCorrelations] = useState<BalanceWheelReportCorrelation[]>([]);
  const [comprehensiveAnalysis, setComprehensiveAnalysis] = useState<ComprehensiveCorrelationAnalysis | null>(null);
  
  // Фильтры
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [monthsBack, setMonthsBack] = useState(6);
  const [activeTab, setActiveTab] = useState<'overview' | 'mood' | 'patterns' | 'balance' | 'comprehensive'>('overview');

  const { toast } = useToast();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  // Проверка доступа
  if (!isStaff) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="bg-blue-50 rounded-lg p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Корреляционный анализ</h2>
            <p className="text-gray-600 mb-4">
              Данная функция доступна только персоналу для анализа эффективности отчетов команды
            </p>
            <div className="text-sm text-blue-600">
              <p>✨ Анализ связей между отчетами и настроением команды</p>
              <p>📊 Выявление паттернов производительности</p>
              <p>🎯 Оптимизация стратегий управления командой</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Загрузка данных
  const fetchCorrelationStats = async () => {
    try {
      const response = await getCorrelationStats();
      setCorrelationStats(response.data);
      setIsFeatureInDevelopment(false);
    } catch (error: any) {
      console.error('Ошибка загрузки статистики корреляций:', error);
      
      // Проверяем, если функция в разработке (501 статус)
      if (error.response?.status === 501) {
        setIsFeatureInDevelopment(true);
      }
      
      // Не показываем toast для 404/501 ошибок (функция может быть не реализована)
      if (error.response?.status !== 404 && error.response?.status !== 501) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить статистику корреляций",
          variant: "destructive",
        });
      }
      setCorrelationStats(null);
    }
  };

  const fetchMoodCorrelations = async () => {
    try {
      const response = await getMoodReportsCorrelations({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setMoodCorrelations(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки корреляций настроения:', error);
      // Не показываем toast для 404/501 ошибок (функция может быть не реализована)
      if (error.response?.status !== 404 && error.response?.status !== 501) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить корреляции настроения",
          variant: "destructive",
        });
      }
      setMoodCorrelations([]); // Устанавливаем пустой массив при ошибке
    }
  };

  const fetchPerformancePatterns = async () => {
    try {
      const response = await getPerformancePatterns(monthsBack);
      setPerformancePatterns(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки паттернов производительности:', error);
      if (error.response?.status !== 404 && error.response?.status !== 501) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить паттерны производительности",
          variant: "destructive",
        });
      }
      setPerformancePatterns([]);
    }
  };

  const fetchBalanceCorrelations = async () => {
    try {
      const response = await getBalanceWheelReportsCorrelations({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setBalanceCorrelations(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки корреляций баланса:', error);
      if (error.response?.status !== 404 && error.response?.status !== 501) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить корреляции колеса баланса",
          variant: "destructive",
        });
      }
      setBalanceCorrelations([]);
    }
  };

  const fetchComprehensiveAnalysis = async () => {
    try {
      const response = await getComprehensiveCorrelationAnalysis({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setComprehensiveAnalysis(response.data);
    } catch (error: any) {
      console.error('Ошибка загрузки комплексного анализа:', error);
      if (error.response?.status !== 404 && error.response?.status !== 501) {
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить комплексный анализ",
          variant: "destructive",
        });
      }
      setComprehensiveAnalysis(null);
    }
  };

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    if (isStaff) {
      const loadData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            fetchCorrelationStats(),
            fetchMoodCorrelations(),
            fetchPerformancePatterns()
          ]);
        } catch (error) {
          console.error('Ошибка загрузки данных корреляций:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
    }
  }, [isStaff]);

  // Обновление данных при изменении фильтров
  useEffect(() => {
    if (isStaff && !loading) {
      fetchMoodCorrelations();
      fetchBalanceCorrelations();
    }
  }, [dateFrom, dateTo, isStaff]);

  useEffect(() => {
    if (isStaff && !loading) {
      fetchPerformancePatterns();
    }
  }, [monthsBack, isStaff]);

  const handleRefresh = async () => {
    if (!isStaff) return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchCorrelationStats(),
        fetchMoodCorrelations(),
        fetchPerformancePatterns(),
        fetchBalanceCorrelations(),
        fetchComprehensiveAnalysis()
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательные функции
  const getSignificanceColor = (significance: string): string => {
    switch (significance) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSignificanceLabel = (significance: string): string => {
    switch (significance) {
      case 'high': return 'Высокая';
      case 'medium': return 'Средняя';
      case 'low': return 'Низкая';
      default: return 'Отсутствует';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <ArrowDown className="h-4 w-4 text-red-600" />;
      default: return <Equal className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'improving': return 'text-green-600 bg-green-50';
      case 'declining': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatPercentage = (value: number): string => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Скелетон для карточек статистики */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Скелетон для таблицы */}
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и управление */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Корреляционный анализ</h1>
          <p className="text-gray-600">
            Анализ взаимосвязей между отчетами команды и метриками производительности
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Сообщение о разработке */}
      {isFeatureInDevelopment && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Activity className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-orange-900">Функция в разработке</h3>
                <p className="text-sm text-orange-700">
                  Корреляционный анализ находится в стадии активной разработки. 
                  Полная функциональность будет доступна в ближайших обновлениях.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Фильтры */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                С даты
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                По дату
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Месяцев для анализа
              </label>
              <Select value={monthsBack.toString()} onValueChange={(value) => setMonthsBack(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 месяца</SelectItem>
                  <SelectItem value="6">6 месяцев</SelectItem>
                  <SelectItem value="12">12 месяцев</SelectItem>
                  <SelectItem value="24">24 месяца</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleRefresh} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Применить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статистика */}
      {correlationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.primary + '20' }}>
                  <BarChart3 className="h-6 w-6" style={{ color: COLORS.primary }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Всего отчетов</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {correlationStats.totalReportsAnalyzed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Положит. влияние</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {correlationStats.positiveImpactReports}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Отрицат. влияние</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {correlationStats.negativeImpactReports}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Сильные корр.</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {correlationStats.highCorrelations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Табы с анализом */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="mood">Настроение</TabsTrigger>
          <TabsTrigger value="patterns">Паттерны</TabsTrigger>
          <TabsTrigger value="balance">Баланс</TabsTrigger>
          <TabsTrigger value="comprehensive">Комплексный</TabsTrigger>
        </TabsList>

        {/* Обзор */}
        <TabsContent value="overview" className="space-y-6">
          {comprehensiveAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Ключевые инсайты
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-blue-50">
                      <h4 className="font-semibold text-blue-900 mb-2">Средний эффект на настроение</h4>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatPercentage(comprehensiveAnalysis.insights.averageMoodImpact)}
                      </p>
                      <p className="text-sm text-blue-600">от базового уровня</p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-green-50">
                      <h4 className="font-semibold text-green-900 mb-2">Наиболее эффективный тип</h4>
                      <p className="text-lg font-bold text-green-700">
                        {comprehensiveAnalysis.insights.mostEffectiveReportType || 'Не определен'}
                      </p>
                      <p className="text-sm text-green-600">отчетов команды</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${getTrendColor(comprehensiveAnalysis.insights.overallTrend)}`}>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {getTrendIcon(comprehensiveAnalysis.insights.overallTrend)}
                        Общий тренд
                      </h4>
                      <p className="text-lg font-bold">
                        {comprehensiveAnalysis.insights.overallTrend === 'improving' && 'Улучшение'}
                        {comprehensiveAnalysis.insights.overallTrend === 'declining' && 'Ухудшение'}
                        {comprehensiveAnalysis.insights.overallTrend === 'stable' && 'Стабильность'}
                      </p>
                      <p className="text-sm opacity-75">производительности команды</p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-purple-50">
                      <h4 className="font-semibold text-purple-900 mb-2">Проанализировано отчетов</h4>
                      <p className="text-2xl font-bold text-purple-700">
                        {comprehensiveAnalysis.insights.totalReportsAnalyzed}
                      </p>
                      <p className="text-sm text-purple-600">за выбранный период</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Корреляции настроения */}
        <TabsContent value="mood" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Корреляции отчетов и настроения
              </CardTitle>
            </CardHeader>
            <CardContent>
              {moodCorrelations.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Нет данных для анализа корреляций</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {moodCorrelations.map((correlation, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{correlation.reportTitle}</h4>
                          <p className="text-sm text-gray-600">
                            {correlation.reportType} • {formatDate(correlation.reportDate)}
                          </p>
                        </div>
                        <Badge className={getSignificanceColor(correlation.correlations.timeWindow.correlation.significance)}>
                          {getSignificanceLabel(correlation.correlations.timeWindow.correlation.significance)}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">До отчета</p>
                          <p className="text-lg font-bold text-gray-900">
                            {correlation.correlations.beforeAfter.moodBefore.toFixed(1)}
                          </p>
                        </div>
                        
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">После отчета</p>
                          <p className="text-lg font-bold text-gray-900">
                            {correlation.correlations.beforeAfter.moodAfter.toFixed(1)}
                          </p>
                        </div>
                        
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Изменение</p>
                          <p className={`text-lg font-bold ${
                            correlation.correlations.beforeAfter.change > 0 ? 'text-green-600' : 
                            correlation.correlations.beforeAfter.change < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {formatPercentage(correlation.correlations.beforeAfter.changePercent)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Паттерны производительности */}
        <TabsContent value="patterns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Паттерны производительности по месяцам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performancePatterns.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Нет данных для анализа паттернов</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {performancePatterns.map((pattern, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{pattern.period}</h4>
                          <p className="text-sm text-gray-600">
                            {pattern.reportsCount} отчетов
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(pattern.moodTrend)}
                          <Badge className={getTrendColor(pattern.moodTrend)}>
                            {pattern.moodTrend === 'improving' && 'Улучшение'}
                            {pattern.moodTrend === 'declining' && 'Ухудшение'}
                            {pattern.moodTrend === 'stable' && 'Стабильно'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-600">Среднее настроение до</p>
                          <p className="text-lg font-bold text-blue-700">
                            {pattern.avgMoodBeforeReports.toFixed(1)}
                          </p>
                        </div>
                        
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-600">Среднее настроение после</p>
                          <p className="text-lg font-bold text-green-700">
                            {pattern.avgMoodAfterReports.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      
                      {pattern.reportTypes.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Типы отчетов:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {pattern.reportTypes.map((type, typeIndex) => (
                              <div key={typeIndex} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <span className="text-sm text-gray-700">{type.type}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">{type.count}</span>
                                  <span className={`text-sm font-medium ${
                                    type.avgMoodImpact > 0 ? 'text-green-600' : 
                                    type.avgMoodImpact < 0 ? 'text-red-600' : 'text-gray-600'
                                  }`}>
                                    {formatPercentage(type.avgMoodImpact)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Корреляции колеса баланса */}
        <TabsContent value="balance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Корреляции отчетов и колеса баланса
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balanceCorrelations.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Нет данных для анализа корреляций колеса баланса</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {balanceCorrelations.map((correlation, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">{correlation.reportTitle}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-600">Общий баланс до</p>
                            <p className="text-lg font-bold text-blue-700">
                              {correlation.overallBalance.before.toFixed(1)}
                            </p>
                          </div>
                          
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-600">Общий баланс после</p>
                            <p className="text-lg font-bold text-green-700">
                              {correlation.overallBalance.after.toFixed(1)}
                            </p>
                          </div>
                          
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Улучшение</p>
                            <p className={`text-lg font-bold ${
                              correlation.overallBalance.improvement > 0 ? 'text-green-600' : 
                              correlation.overallBalance.improvement < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {correlation.overallBalance.improvement > 0 ? '+' : ''}{correlation.overallBalance.improvement.toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {correlation.balanceAreas.map((area, areaIndex) => (
                          <div key={areaIndex} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h6 className="text-sm font-medium text-gray-700">{area.area}</h6>
                              <Badge className={getSignificanceColor(area.correlation.significance)} variant="outline">
                                {getSignificanceLabel(area.correlation.significance)[0]}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">До:</span>
                                <span className="font-medium">{area.beforeReport.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">После:</span>
                                <span className="font-medium">{area.afterReport.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Изменение:</span>
                                <span className={`font-medium ${
                                  area.change > 0 ? 'text-green-600' : 
                                  area.change < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {area.change > 0 ? '+' : ''}{area.change.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Комплексный анализ */}
        <TabsContent value="comprehensive" className="space-y-6">
          {comprehensiveAnalysis ? (
            <div className="space-y-6">
              {/* Итоговые инсайты */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Комплексный анализ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Ключевые выводы:</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <span className="text-sm text-gray-700">
                            Проанализировано {comprehensiveAnalysis.insights.totalReportsAnalyzed} отчетов команды
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <span className="text-sm text-gray-700">
                            Средний эффект на настроение: {formatPercentage(comprehensiveAnalysis.insights.averageMoodImpact)}
                          </span>
                        </li>
                        {comprehensiveAnalysis.insights.mostEffectiveReportType && (
                          <li className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                            <span className="text-sm text-gray-700">
                              Наиболее эффективный тип: {comprehensiveAnalysis.insights.mostEffectiveReportType}
                            </span>
                          </li>
                        )}
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <span className="text-sm text-gray-700">
                            Общий тренд: {
                              comprehensiveAnalysis.insights.overallTrend === 'improving' ? 'улучшение' :
                              comprehensiveAnalysis.insights.overallTrend === 'declining' ? 'ухудшение' : 'стабильность'
                            }
                          </span>
                        </li>
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Данные для анализа:</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg text-center">
                          <p className="text-sm text-blue-600">Корреляции настроения</p>
                          <p className="text-lg font-bold text-blue-700">
                            {comprehensiveAnalysis.moodCorrelations.length}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                          <p className="text-sm text-green-600">Паттерны производ.</p>
                          <p className="text-lg font-bold text-green-700">
                            {comprehensiveAnalysis.performancePatterns.length}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-purple-50 rounded-lg text-center">
                          <p className="text-sm text-purple-600">Корреляции баланса</p>
                          <p className="text-lg font-bold text-purple-700">
                            {comprehensiveAnalysis.balanceCorrelations.length}
                          </p>
                        </div>
                        
                        <div className="p-3 bg-orange-50 rounded-lg text-center">
                          <p className="text-sm text-orange-600">Дата анализа</p>
                          <p className="text-xs font-medium text-orange-700">
                            {formatDate(comprehensiveAnalysis.generatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Комплексный анализ недоступен
                  </h3>
                  <p className="text-gray-600">
                    Недостаточно данных для проведения комплексного анализа
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorrelationAnalysis; 