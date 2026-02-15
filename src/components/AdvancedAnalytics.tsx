import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ui/use-toast';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Calendar as CalendarIcon,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Lightbulb,
  Eye,
  BarChart3,
  Zap,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Download,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import {
  getSentimentAnalysis,
  getPlayerClustering,
  getTimeSeriesAnalysis,
  getPredictiveInsights,
  getTeamPerformanceProfile,
  getAdvancedAnalyticsReport,
  getAdvancedAnalyticsStats,
  type SentimentAnalysis,
  type PlayerCluster,
  type TimeSeriesPattern,
  type PredictiveInsight,
  type TeamPerformanceProfile,
  type AdvancedAnalyticsReport
} from '../lib/api';
import PDFExporter from '@/utils/export/PDFExporter';
import ExcelExporter from '@/utils/export/ExcelExporter';

interface AdvancedAnalyticsProps {
  className?: string;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ className }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Состояние данных
  const [sentimentData, setSentimentData] = useState<SentimentAnalysis[]>([]);
  const [clusterData, setClusterData] = useState<PlayerCluster[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPattern[]>([]);
  const [predictiveData, setPredictiveData] = useState<PredictiveInsight[]>([]);
  const [teamProfile, setTeamProfile] = useState<TeamPerformanceProfile | null>(null);
  const [comprehensiveReport, setComprehensiveReport] = useState<AdvancedAnalyticsReport | null>(null);

  // Состояние UI
  const [activeTab, setActiveTab] = useState<'overview' | 'sentiment' | 'clustering' | 'timeseries' | 'predictions' | 'comprehensive'>('overview');
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedMetric, setSelectedMetric] = useState<'mood' | 'balance' | 'activity'>('mood');
  const [analysisPeriod, setAnalysisPeriod] = useState<number>(30);

  // Проверка прав доступа
  if (!user || user.role !== 'staff') {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Расширенная аналитика доступна только персоналу</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Загрузка данных
  const loadData = async () => {
    setLoading(true);
    try {
      const dateParams = {
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString()
      };

      const [
        sentimentResponse,
        clusterResponse,
        timeSeriesResponse,
        predictiveResponse,
        profileResponse
      ] = await Promise.all([
        getSentimentAnalysis(dateParams),
        getPlayerClustering(),
        getTimeSeriesAnalysis({ metric: selectedMetric, daysBack: analysisPeriod }),
        getPredictiveInsights(),
        getTeamPerformanceProfile()
      ]);

      setSentimentData(sentimentResponse.data);
      setClusterData(clusterResponse.data);
      setTimeSeriesData(timeSeriesResponse.data);
      setPredictiveData(predictiveResponse.data);
      setTeamProfile(profileResponse.data);

      toast({
        title: "Данные обновлены",
        description: "Расширенная аналитика успешно загружена",
      });
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить данные аналитики",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Загрузка комплексного отчета
  const loadComprehensiveReport = async () => {
    setLoading(true);
    try {
      const dateParams = {
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString()
      };

      const response = await getAdvancedAnalyticsReport(dateParams);
      setComprehensiveReport(response.data);

      toast({
        title: "Отчет сгенерирован",
        description: "Комплексный анализ готов",
      });
    } catch (error) {
      console.error('Ошибка генерации отчета:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сгенерировать отчет",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Инициальная загрузка
  useEffect(() => {
    loadData();
  }, [selectedMetric, analysisPeriod]);

  // Функции отображения трендов
  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentColor = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800';
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return 'text-green-600';
    if (confidence > 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Функции экспорта
  const handleExportSentimentPDF = async () => {
    try {
      const pdfExporter = new PDFExporter();
      await pdfExporter.exportSentimentAnalysis(sentimentData);
      
      toast({
        title: "Экспорт завершен",
        description: "PDF отчет анализа тональности сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта PDF:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать PDF отчет",
        variant: "destructive",
      });
    }
  };

  const handleExportSentimentExcel = async () => {
    try {
      const excelExporter = new ExcelExporter();
      await excelExporter.exportSentimentAnalysis(sentimentData);
      
      toast({
        title: "Экспорт завершен",
        description: "Excel файл анализа тональности сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта Excel:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать Excel файл",
        variant: "destructive",
      });
    }
  };

  const handleExportClusteringExcel = async () => {
    try {
      const excelExporter = new ExcelExporter();
      await excelExporter.exportPlayerClustering(clusterData);
      
      toast({
        title: "Экспорт завершен",
        description: "Excel файл кластеризации сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта Excel:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать Excel файл",
        variant: "destructive",
      });
    }
  };

  const handleExportTimeSeriesExcel = async () => {
    try {
      const excelExporter = new ExcelExporter();
      await excelExporter.exportTimeSeriesAnalysis(timeSeriesData);
      
      toast({
        title: "Экспорт завершен",
        description: "Excel файл временных рядов сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта Excel:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать Excel файл",
        variant: "destructive",
      });
    }
  };

  const handleExportComprehensiveReport = async () => {
    try {
      const excelExporter = new ExcelExporter();
      await excelExporter.exportComprehensiveAnalytics({
                 summary: {
           totalReports: sentimentData?.length || 0,
           avgSentiment: sentimentData?.reduce((sum, item) => sum + item.overallSentiment, 0) / (sentimentData?.length || 1),
           strongCorrelations: clusterData?.clusters?.length || 0,
           dominantCluster: clusterData?.clusters?.[0]?.name || 'Не определен',
           weeklyTrend: timeSeriesData?.[0]?.trend?.direction === 'upward' ? 'improving' : 
                       timeSeriesData?.[0]?.trend?.direction === 'downward' ? 'declining' : 'stable'
         },
        sentiment: { details: sentimentData },
        correlations: { significant: [] }
      });
      
      toast({
        title: "Экспорт завершен",
        description: "Комплексный отчет аналитики сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта отчета:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать комплексный отчет",
        variant: "destructive",
      });
    }
  };

  // Компонент статистических карточек
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Анализ сентимента</p>
              <p className="text-2xl font-bold">{sentimentData.length}</p>
            </div>
            <Eye className="w-8 h-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Кластеры игроков</p>
              <p className="text-2xl font-bold">{clusterData.length}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Прогнозы</p>
              <p className="text-2xl font-bold">{predictiveData.length}</p>
            </div>
            <Brain className="w-8 h-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Общий рейтинг</p>
              <p className="text-2xl font-bold">
                {teamProfile ? `${teamProfile.overallHealthScore}/10` : '---'}
              </p>
            </div>
            <Star className="w-8 h-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Заголовок и фильтры */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🧠 Расширенная аналитика</h2>
          <p className="text-gray-600">Машинное обучение и предиктивная аналитика</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Период анализа */}
          <Select value={analysisPeriod.toString()} onValueChange={(value) => setAnalysisPeriod(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 дней</SelectItem>
              <SelectItem value="14">14 дней</SelectItem>
              <SelectItem value="30">30 дней</SelectItem>
              <SelectItem value="60">60 дней</SelectItem>
              <SelectItem value="90">90 дней</SelectItem>
            </SelectContent>
          </Select>

          {/* Фильтр дат */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-40 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd MMM", { locale: ru }) : "От даты"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-40 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd MMM", { locale: ru }) : "До даты"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button onClick={loadData} disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Статистические карточки */}
      <StatsCards />

      {/* Основные вкладки */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="sentiment">Сентимент</TabsTrigger>
          <TabsTrigger value="clustering">Кластеры</TabsTrigger>
          <TabsTrigger value="timeseries">Временные ряды</TabsTrigger>
          <TabsTrigger value="predictions">Прогнозы</TabsTrigger>
          <TabsTrigger value="comprehensive">Отчет</TabsTrigger>
        </TabsList>

        {/* Обзор */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Профиль команды */}
            {teamProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Профиль команды
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Общий рейтинг здоровья</span>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {teamProfile.overallHealthScore}/10
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Активных игроков</span>
                    <span className="font-semibold">{teamProfile.activePlayersCount}</span>
                  </div>

                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Сильные стороны:</h4>
                    <div className="space-y-1">
                      {teamProfile.strengthAreas.map((area, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm">{area}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {teamProfile.riskAreas.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">Зоны риска:</h4>
                      <div className="space-y-1">
                        {teamProfile.riskAreas.map((area, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm">{area}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ключевые прогнозы */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Ключевые прогнозы
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {predictiveData.slice(0, 3).map((insight, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{insight.metric}</p>
                      <p className="text-sm text-gray-600">{insight.timeframe}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(insight.trend)}
                      <span className={cn("text-sm font-medium", getConfidenceColor(insight.confidence))}>
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Анализ сентимента */}
        <TabsContent value="sentiment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Анализ сентимента отчетов
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Анализ тональности</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportSentimentPDF}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportSentimentExcel}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sentimentData.map((analysis, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium line-clamp-2">{analysis.reportTitle}</h4>
                          <Badge className={getSentimentColor(analysis.overallSentiment)}>
                            {analysis.overallSentiment === 'positive' ? 'Позитивный' :
                             analysis.overallSentiment === 'negative' ? 'Негативный' : 'Нейтральный'}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Оценка</span>
                          <span className="font-semibold">{(analysis.sentimentScore * 100).toFixed(1)}%</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span>Радость</span>
                            <span>{(analysis.emotionalTone.joy * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span>Уверенность</span>
                            <span>{(analysis.emotionalTone.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>

                        {analysis.recommendedActions.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-gray-600 mb-1">Рекомендации:</p>
                            <p className="text-xs text-gray-500">{analysis.recommendedActions[0]}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Кластерный анализ */}
        <TabsContent value="clustering" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Кластеры игроков
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Кластерный анализ</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportClusteringExcel}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clusterData.map((cluster, index) => (
                  <Card key={index} className="border-l-4 border-l-purple-500">
                    <CardContent className="pt-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold">{cluster.clusterName}</h4>
                          <p className="text-sm text-gray-600">{cluster.playerIds.length} игроков</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Средний mood</span>
                            <Badge variant="outline">{cluster.characteristics.avgMoodScore}</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Отзывчивость</span>
                            <Badge 
                              variant={cluster.characteristics.responsiveness === 'high' ? 'default' : 'secondary'}
                            >
                              {cluster.characteristics.responsiveness === 'high' ? 'Высокая' :
                               cluster.characteristics.responsiveness === 'medium' ? 'Средняя' : 'Низкая'}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Сильные стороны:</p>
                          <div className="space-y-1">
                            {cluster.characteristics.strengths.slice(0, 2).map((strength, idx) => (
                              <p key={idx} className="text-xs text-gray-500">• {strength}</p>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-600 mb-1">Стратегии:</p>
                          <p className="text-xs text-gray-500">{cluster.recommendedStrategies[0]}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Временные ряды */}
        <TabsContent value="timeseries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Анализ временных рядов: {selectedMetric === 'mood' ? 'Настроение' : 
                                         selectedMetric === 'balance' ? 'Баланс' : 'Активность'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Анализ временных рядов</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleExportTimeSeriesExcel}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Тип паттерна</p>
                      <p className="text-lg font-semibold capitalize">{timeSeriesData[0]?.pattern}</p>
                    </div>
                  </CardContent>
                </Card>

                {timeSeriesData[0]?.trend && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Тренд</p>
                        <div className="flex items-center justify-center gap-2">
                          {getTrendIcon(timeSeriesData[0]?.trend.direction)}
                          <span className="font-semibold capitalize">{timeSeriesData[0]?.trend.direction}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Достоверность</p>
                      <p className={cn("text-lg font-semibold", getConfidenceColor(timeSeriesData[0]?.forecast.confidence))}>
                        {Math.round(timeSeriesData[0]?.forecast.confidence * 100)}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <p className="font-medium">Прогноз на неделю</p>
                      <div className="flex items-center justify-between">
                        <span>Ожидаемое значение</span>
                        <span className="font-semibold">{timeSeriesData[0]?.forecast.nextWeek.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <p className="font-medium">Прогноз на месяц</p>
                      <div className="flex items-center justify-between">
                        <span>Ожидаемое значение</span>
                        <span className="font-semibold">{timeSeriesData[0]?.forecast.nextMonth.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Прогнозы */}
        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Прогнозные инсайты
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveData.map((insight, index) => (
                  <Card key={index} className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold">{insight.metric}</h4>
                            <p className="text-sm text-gray-600">{insight.timeframe}</p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-xs text-gray-600">Текущее</p>
                              <p className="font-semibold">{insight.currentValue.toFixed(1)}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-600">Прогноз</p>
                              <p className="font-semibold">{insight.predictedValue.toFixed(1)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {getTrendIcon(insight.trend)}
                            <span className="text-sm capitalize">{insight.trend}</span>
                            <Badge className={getConfidenceColor(insight.confidence)}>
                              {Math.round(insight.confidence * 100)}% уверенности
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Факторы влияния:</p>
                          <div className="space-y-1">
                            {insight.factors.map((factor, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Lightbulb className="w-3 h-3 text-yellow-500" />
                                <span className="text-xs text-gray-500">{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Комплексный отчет */}
        <TabsContent value="comprehensive" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Комплексный аналитический отчет</h3>
            <Button 
              onClick={loadComprehensiveReport} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Сгенерировать отчет
            </Button>
          </div>

          {comprehensiveReport && (
            <div className="space-y-6">
              {/* Исполнительное резюме */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Исполнительное резюме</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {comprehensiveReport.executiveSummary.overallScore}/10
                      </p>
                      <p className="text-sm text-gray-600">Общий рейтинг</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {comprehensiveReport.executiveSummary.successMetrics.length}
                      </p>
                      <p className="text-sm text-gray-600">Успешные метрики</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {comprehensiveReport.executiveSummary.keyFindings.length}
                      </p>
                      <p className="text-sm text-gray-600">Ключевые находки</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {comprehensiveReport.executiveSummary.criticalAlerts.length}
                      </p>
                      <p className="text-sm text-gray-600">Критические сигналы</p>
                    </div>
                  </div>

                  {comprehensiveReport.executiveSummary.criticalAlerts.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">🚨 Критические сигналы:</h4>
                      <div className="space-y-1">
                        {comprehensiveReport.executiveSummary.criticalAlerts.map((alert, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm">{alert}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {comprehensiveReport.executiveSummary.successMetrics.length > 0 && (
                    <div>
                      <h4 className="font-medium text-green-600 mb-2">✅ Успешные метрики:</h4>
                      <div className="space-y-1">
                        {comprehensiveReport.executiveSummary.successMetrics.map((metric, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">{metric}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* План действий */}
              <Card>
                <CardHeader>
                  <CardTitle>🎯 План действий</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {comprehensiveReport.actionPlan.immediateActions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-3">Срочные действия:</h4>
                      <div className="space-y-2">
                        {comprehensiveReport.actionPlan.immediateActions.map((action, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                            <span className="text-sm">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-yellow-600 mb-3">Краткосрочные цели:</h4>
                    <div className="space-y-2">
                      {comprehensiveReport.actionPlan.shortTermGoals.map((goal, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                          <Target className="w-5 h-5 text-yellow-500 mt-0.5" />
                          <span className="text-sm">{goal}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-blue-600 mb-3">Долгосрочные стратегии:</h4>
                    <div className="space-y-2">
                      {comprehensiveReport.actionPlan.longTermStrategies.map((strategy, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                          <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
                          <span className="text-sm">{strategy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedAnalytics; 