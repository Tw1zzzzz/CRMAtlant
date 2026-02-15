import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Trophy, Crosshair, Target, Swords, LineChart as ChartLineUp, Medal, Upload, User, Users, Calendar, UsersRound, Dumbbell, Clock, Flame, TrendingUp, Map, X, Image } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
// Импортируем функции API и тему
import { getAnalyticsMoodStats, getAnalyticsTestStats, getAnalyticsBalanceWheelStats } from '@/lib/api';
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import TeamReports from '@/components/TeamReports';
import CorrelationAnalysis from '@/components/CorrelationAnalysis';
import AdvancedAnalytics from '@/components/AdvancedAnalytics';
import ErrorBoundary from '@/components/ErrorBoundary';
import Cs2AnalyticsPanel from '@/components/Cs2AnalyticsPanel';

interface PlayerStats {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  kdRatio: number;
  headshotPercentage: number;
  accuracy: number;
  winRate: number;
  hltvRating: number;
  winRateHistory: { date: string; value: number }[];
}

interface TeamStats {
  totalWins: number;
  winRate: number;
  longestWinStreak: number;
  recentResults: string;
  kdRatio: number;
  headshotPercentage: number;
  hltvRanking: number;
  hltvPoints: number;
  mainRoster: string[];
  practiceStats: {
    totalWins: number;
    winRate: number;
    kdRatio: number;
    headshotPercentage: number;
  };
  winRateHistory: { date: string; official: number; practice: number }[];
}

interface TrainingStats {
  totalSessions: number;
  averageDuration: number;
  completionRate: number;
  intensityScore: number;
  progressRate: number;
  recentSessions: {
    date: string;
    duration: number;
    intensity: number;
    completed: boolean;
  }[];
}

interface MapStats {
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  roundsTotal: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    avgWins: number;
    avgLosses: number;
  };
  ctSide: {
    roundsTotal: number;
    roundsWon: number;
    roundsLost: number;
    winRate: number;
    pistolRounds: string;
    avgWins: number;
    avgLosses: number;
  };
  tSide: {
    roundsTotal: number;
    roundsWon: number;
    roundsLost: number;
    winRate: number;
    pistolRounds: string;
    avgWins: number;
    avgLosses: number;
  };
}

const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmaps' | 'training' | 'detailedStats' | 'reports' | 'correlations' | 'advanced' | 'cs2'>('overview');
  const [selectedMapType, setSelectedMapType] = useState<'practice' | 'official'>('official');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statsView, setStatsView] = useState<'team' | 'personal'>('team');
  const [showPractice, setShowPractice] = useState<boolean>(false);
  const [selectedMap, setSelectedMap] = useState<string>('all');
  const [uploadedImages, setUploadedImages] = useState<{ id: string; file: File; url: string }[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Состояния для хранения реальных данных
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [moodStatsData, setMoodStatsData] = useState<any[]>([]);
  const [testStatsData, setTestStatsData] = useState<any[]>([]);
  const [balanceWheelStatsData, setBalanceWheelStatsData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const isPlayerRole = user?.role === 'player';

  // Получение данных при монтировании компонента
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Загрузка статистики настроения с использованием новых API
        const moodResponse = await getAnalyticsMoodStats();
        setMoodStatsData(moodResponse.data);
        
        // Загрузка статистики тестов с использованием новых API
        const testsResponse = await getAnalyticsTestStats();
        setTestStatsData(testsResponse.data);
        
        // Загрузка данных колес баланса с использованием новых API
        const balanceWheelResponse = await getAnalyticsBalanceWheelStats();
        setBalanceWheelStatsData(balanceWheelResponse.data);
        
        // Проверяем, есть ли данные и формируем статистику соответственно
        if (moodResponse.data && moodResponse.data.length > 0) {
        // Создание реальных данных о команде из данных настроения и тестов
        const realTeamStats: TeamStats = {
          totalWins: testsResponse.data.reduce((total: number, player: any) => total + (player.testCount || 0), 0),
          winRate: calculateAverageWinRate(testsResponse.data),
          longestWinStreak: 0, // Нужно получить из другого API
          recentResults: '',
          kdRatio: 0,
          headshotPercentage: 0,
          hltvRanking: 0,
          hltvPoints: 0,
          mainRoster: moodResponse.data.slice(0, 5).map((player: any) => player.name),
    practiceStats: {
            totalWins: 0,
            winRate: 0,
            kdRatio: 0,
            headshotPercentage: 0
    },
          winRateHistory: generateWinRateHistory()
        };
        
        setTeamStats(realTeamStats);
        
        // Создание данных игроков из данных настроения и тестов
        const realPlayers = moodResponse.data.map((player: any, index: number) => {
          const testData = testsResponse.data.find((test: any) => test.userId === player.userId) || { testCount: 0 };
            
            // Если игрок и есть данные для графика, используем их
            let winRateHistory = generatePlayerWinRateHistory();
            if (isPlayerRole && player.chartData) {
              winRateHistory = player.chartData.map((item: any) => ({
                date: item.date,
                value: item.mood // Используем настроение как показатель "успешности"
              }));
            }
          
          return {
            id: index + 1,
            name: player.name,
            kills: Math.floor(Math.random() * 1000) + 1000, // Заглушка, нужны данные из другого API
            deaths: Math.floor(Math.random() * 800) + 800,
            kdRatio: parseFloat((Math.random() * 0.5 + 0.8).toFixed(2)),
            headshotPercentage: Math.floor(Math.random() * 20) + 40,
            accuracy: Math.floor(Math.random() * 20) + 40,
            winRate: testData.testCount > 0 ? Math.floor(Math.random() * 20) + 40 : 0,
            hltvRating: parseFloat((Math.random() * 0.5 + 0.8).toFixed(2)),
              winRateHistory
          };
        });
        
        setPlayers(realPlayers);
        } else {
          // Если данных нет, используем заглушки
          setTeamStats({
            totalWins: 0,
            winRate: 0,
            longestWinStreak: 0,
            recentResults: '',
            kdRatio: 0,
            headshotPercentage: 0,
            hltvRanking: 0,
            hltvPoints: 0,
            mainRoster: ['Нет данных'],
            practiceStats: {
              totalWins: 0,
              winRate: 0,
              kdRatio: 0,
              headshotPercentage: 0
            },
            winRateHistory: []
          });
          
          setPlayers([]);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching analytics data:', err);
        setError(err.message || 'Ошибка при загрузке данных');
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить данные аналитики',
          variant: 'destructive'
        });
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isPlayerRole]);
  
  // Вспомогательные функции для генерации данных
  const calculateAverageWinRate = (testData: any[]): number => {
    const totalPlayers = testData.length;
    if (totalPlayers === 0) return 0;
    
    return Math.floor(Math.random() * 15) + 45; // Заглушка
  };
  
  const generateWinRateHistory = (): { date: string; official: number; practice: number }[] => {
    const months = ['2024-01', '2024-02', '2024-03', '2024-04'];
    return months.map(month => ({
      date: month,
      official: Math.floor(Math.random() * 15) + 45,
      practice: Math.floor(Math.random() * 15) + 55
    }));
  };
  
  const generatePlayerWinRateHistory = (): { date: string; value: number }[] => {
    const months = ['2024-01', '2024-02', '2024-03', '2024-04'];
    return months.map(month => ({
      date: month,
      value: Math.floor(Math.random() * 15) + 45
    }));
  };

  // Тестовые данные - только для данных, которые еще не загружены
  const trainingStats: TrainingStats = {
    totalSessions: 52,
    averageDuration: 87,
    completionRate: 92,
    intensityScore: 7.8,
    progressRate: 8.5,
    recentSessions: [
      { date: '2024-04-01', duration: 90, intensity: 8, completed: true },
      { date: '2024-04-03', duration: 85, intensity: 7, completed: true },
      { date: '2024-04-05', duration: 95, intensity: 9, completed: true },
      { date: '2024-04-07', duration: 75, intensity: 6, completed: false },
      { date: '2024-04-09', duration: 92, intensity: 8, completed: true },
      { date: '2024-04-11', duration: 88, intensity: 8, completed: true },
      { date: '2024-04-13', duration: 90, intensity: 9, completed: true }
    ]
  };

  // Рекомендуемые тесты - расширенный список
  const recommendedTests = [
    { id: 1, name: 'Тест реакции', description: 'Проверка времени реакции на визуальные стимулы', score: 185, unit: 'мс' },
    { id: 2, name: 'Тест на точность', description: 'Измерение точности при стрельбе по мишеням', score: 92, unit: '%' },
    { id: 3, name: 'Тест на отслеживание', description: 'Анализ способности отслеживать движущиеся объекты', score: 86, unit: '%' },
    { id: 4, name: 'Тест на память', description: 'Проверка визуальной памяти и внимания к деталям', score: 78, unit: '%' },
    { id: 5, name: 'Тест на стрессоустойчивость', description: 'Измерение производительности под давлением', score: 83, unit: '%' },
    { id: 6, name: 'Тест периферийного зрения', description: 'Оценка реакции на объекты на краю поля зрения', score: 89, unit: '%' },
    { id: 7, name: 'Тест на многозадачность', description: 'Способность эффективно переключаться между задачами', score: 76, unit: '%' }
  ];

  // Еженедельные тесты - расширенный список
  const weeklyTests = [
    { id: 101, name: 'Спринт-проверка скорости', date: '2024-04-02', completed: true, score: 94 },
    { id: 102, name: 'Контроль позиции', date: '2024-04-04', completed: true, score: 88 },
    { id: 103, name: 'Тактическое мышление', date: '2024-04-05', completed: true, score: 91 },
    { id: 104, name: 'Коммуникация в команде', date: '2024-04-07', completed: false, score: 0 },
    { id: 105, name: 'Анализ макро-игры', date: '2024-04-09', completed: true, score: 86 },
    { id: 106, name: 'Таймеры и тайминги', date: '2024-04-11', completed: false, score: 0 },
    { id: 107, name: 'Предварительный анализ противника', date: '2024-04-13', scheduled: true }
  ];

  // Тестовые данные для детальной статистики по карте
  const mapStatsData: { [key: string]: MapStats } = {
    'all': {
      name: 'Все карты',
      totalGames: 8,
      wins: 5,
      losses: 2,
      draws: 1,
      winRate: 6250,
      roundsTotal: {
        total: 192,
        wins: 99,
        losses: 93,
        winRate: 5156,
        avgWins: 12.4,
        avgLosses: 11.6
      },
      ctSide: {
        roundsTotal: 96,
        roundsWon: 50,
        roundsLost: 46,
        winRate: 5208,
        pistolRounds: '4/8',
        avgWins: 6.25,
        avgLosses: 5.75
      },
      tSide: {
        roundsTotal: 96,
        roundsWon: 49,
        roundsLost: 47,
        winRate: 5104,
        pistolRounds: '4/8',
        avgWins: 6.13,
        avgLosses: 5.88
      }
    },
    'mirage': {
      name: 'Mirage',
      totalGames: 3,
      wins: 2,
      losses: 1,
      draws: 0,
      winRate: 6667,
      roundsTotal: {
        total: 72,
        wins: 40,
        losses: 32,
        winRate: 5556,
        avgWins: 13.3,
        avgLosses: 10.7
      },
      ctSide: {
        roundsTotal: 36,
        roundsWon: 22,
        roundsLost: 14,
        winRate: 6111,
        pistolRounds: '2/3',
        avgWins: 7.33,
        avgLosses: 4.67
      },
      tSide: {
        roundsTotal: 36,
        roundsWon: 18,
        roundsLost: 18,
        winRate: 5000,
        pistolRounds: '1/3',
        avgWins: 6.00,
        avgLosses: 6.00
      }
    },
    'anubis': {
      name: 'Anubis',
      totalGames: 2,
      wins: 1,
      losses: 0,
      draws: 1,
      winRate: 7500,
      roundsTotal: {
        total: 48,
        wins: 26,
        losses: 22,
        winRate: 5417,
        avgWins: 13.0,
        avgLosses: 11.0
      },
      ctSide: {
        roundsTotal: 24,
        roundsWon: 12,
        roundsLost: 12,
        winRate: 5000,
        pistolRounds: '1/2',
        avgWins: 6.00,
        avgLosses: 6.00
      },
      tSide: {
        roundsTotal: 24,
        roundsWon: 14,
        roundsLost: 10,
        winRate: 5833,
        pistolRounds: '2/2',
        avgWins: 7.00,
        avgLosses: 5.00
      }
    },
    'dust2': {
      name: 'Dust2',
      totalGames: 3,
      wins: 2,
      losses: 1,
      draws: 0,
      winRate: 6667,
      roundsTotal: {
        total: 72,
        wins: 33,
        losses: 39,
        winRate: 4583,
        avgWins: 11.0,
        avgLosses: 13.0
      },
      ctSide: {
        roundsTotal: 36,
        roundsWon: 16,
        roundsLost: 20,
        winRate: 4444,
        pistolRounds: '1/3',
        avgWins: 5.33,
        avgLosses: 6.67
      },
      tSide: {
        roundsTotal: 36,
        roundsWon: 17,
        roundsLost: 19,
        winRate: 4722,
        pistolRounds: '1/3',
        avgWins: 5.67,
        avgLosses: 6.33
      }
    }
  };

  const currentMapStats = mapStatsData[selectedMap];

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    setIsUploading(true);
    
    const fileArray = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || 
      file.type === 'image/jpg' || 
      file.type === 'image/png'
    );

    const newImages = fileArray.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file: file,
      url: URL.createObjectURL(file)
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    setIsUploading(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const updatedImages = prev.filter(img => img.id !== id);
      return updatedImages;
    });
  };

  // Показываем индикатор загрузки, пока данные не загружены
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="text-xl text-red-500">Ошибка при загрузке данных</div>
        <div>{error}</div>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
        >
          Попробовать снова
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4">
      <div className="flex flex-col space-y-4">
        {/* Основной заголовок и вкладки в одну линию */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg shadow-sm mb-2" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <div className="flex flex-col mb-4 sm:mb-0">
            <h1 className="text-2xl font-bold tracking-tight font-heading" style={{ color: COLORS.textColor }}>Аналитика</h1>
            <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>Игровая статистика и аналитика игроков</p>
          </div>
          
          <div className="flex flex-col space-y-2 w-full sm:w-auto">
            <Tabs 
              defaultValue="overview" 
              value={activeTab} 
              onValueChange={(value) => setActiveTab(value as 'overview' | 'heatmaps' | 'training' | 'detailedStats' | 'reports' | 'correlations' | 'advanced' | 'cs2')}
              className="w-full sm:w-auto"
            >
              <TabsList className="w-full" style={COMPONENT_STYLES.tabs.list}>
                <TabsTrigger 
                  value="overview" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Обзор
                </TabsTrigger>
                <TabsTrigger 
                  value="heatmaps" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Тепловая карта
                </TabsTrigger>
                <TabsTrigger 
                  value="training" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Тренировки
                </TabsTrigger>
                <TabsTrigger 
                  value="detailedStats" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Детальная статистика
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Отчеты команды
                </TabsTrigger>
                <TabsTrigger 
                  value="correlations" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Корреляции
                </TabsTrigger>
                <TabsTrigger 
                  value="advanced" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  Advanced
                </TabsTrigger>
                <TabsTrigger 
                  value="cs2" 
                  className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white"
                  style={{ color: COLORS.textColor }}
                >
                  CS2 (7/30)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Панель выбора с типами статистики и игр в одной строке */}
            <div className="flex flex-wrap justify-between items-center p-3 rounded-lg shadow-sm mb-4" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
              <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                <span className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>Режим просмотра:</span>
                <Tabs 
                  defaultValue="team" 
                  value={statsView} 
                  onValueChange={(value) => setStatsView(value as 'team' | 'personal')}
                >
                  <TabsList style={COMPONENT_STYLES.tabs.list}>
                    <TabsTrigger 
                      value="team"
                      className="data-[state=active]:bg-primary data-[state=active]:text-white"
                      style={{ color: COLORS.textColor }}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Командная
                    </TabsTrigger>
                    <TabsTrigger 
                      value="personal"
                      className="data-[state=active]:bg-primary data-[state=active]:text-white"
                      style={{ color: COLORS.textColor }}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Личная
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              {statsView === 'team' && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>Тип игр:</span>
                  <Tabs 
                    defaultValue="official" 
                    value={showPractice ? "practice" : "official"} 
                    onValueChange={(value) => setShowPractice(value === "practice")}
                  >
                    <TabsList style={COMPONENT_STYLES.tabs.list}>
                      <TabsTrigger 
                        value="official"
                        className="data-[state=active]:bg-primary data-[state=active]:text-white"
                        style={{ color: COLORS.textColor }}
                      >
                        Официальные
                      </TabsTrigger>
                      <TabsTrigger 
                        value="practice"
                        className="data-[state=active]:bg-primary data-[state=active]:text-white"
                        style={{ color: COLORS.textColor }}
                      >
                        Праки
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>

            {statsView === 'team' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* HLTV Рейтинг */}
                <Card style={COMPONENT_STYLES.card}>
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="py-1 px-1" style={{ color: COLORS.textColor }}>HLTV Рейтинг</CardTitle>
                      <Medal className="h-5 w-5" style={{ color: COLORS.textColorSecondary }} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div>
                        <p className="text-3xl font-bold" style={{ color: COLORS.textColor }}>#{teamStats.hltvRanking}</p>
                        <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>Текущая позиция</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold" style={{ color: COLORS.textColor }}>{teamStats.hltvPoints}</p>
                        <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>Очки рейтинга</p>
                      </div>
                    </div>
                    
                    {/* Основной состав команды - более крупный и заметный */}
                    <div className="mt-3 pt-4 border-t" style={{ borderColor: COLORS.borderColor }}>
                      <div className="flex items-center mb-2">
                        <UsersRound className="h-5 w-5 text-primary mr-2" />
                        <h3 className="text-base font-bold" style={{ color: COLORS.textColor }}>Основной состав:</h3>
                      </div>
                      <div className="p-3 rounded-md" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <p className="text-base font-medium text-center" style={{ color: COLORS.textColor }}>
                          {teamStats.mainRoster.join(', ')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Основная статистика */}
                <Card style={COMPONENT_STYLES.card}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="py-2 px-2 mb-1" style={{ color: COLORS.textColor }}>Основная статистика</CardTitle>
                      <ChartLineUp className="h-5 w-5" style={{ color: COLORS.textColorSecondary }} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <Trophy className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>
                          {showPractice ? teamStats.practiceStats.totalWins : teamStats.totalWins}
                        </p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Всего побед</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <Target className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>
                          {showPractice ? teamStats.practiceStats.winRate : teamStats.winRate}%
                        </p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Процент побед</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <Swords className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{teamStats.longestWinStreak}</p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Победная серия</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <ChartLineUp className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{teamStats.recentResults}</p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Последние матчи</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <Crosshair className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>
                          {showPractice ? teamStats.practiceStats.kdRatio : teamStats.kdRatio}
                        </p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>K/D</p>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <Target className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                        <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>
                          {showPractice ? teamStats.practiceStats.headshotPercentage : teamStats.headshotPercentage}%
                        </p>
                        <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Headshots</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Динамика винрейта - растянута на всю ширину */}
                <Card className="lg:col-span-2" style={COMPONENT_STYLES.card}>
                  <CardHeader className="pb-1">
                    <CardTitle className="py-1 px-1" style={{ color: COLORS.textColor }}>Динамика винрейта</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={teamStats.winRateHistory}>
                          <XAxis dataKey="date" stroke={COLORS.textColorSecondary} />
                          <YAxis stroke={COLORS.textColorSecondary} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: COLORS.cardBackground, 
                              borderColor: COLORS.borderColor,
                              color: COLORS.textColor 
                            }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="official" 
                            stroke={COLORS.chartColors[0]} 
                            strokeWidth={3}
                            dot={{ stroke: COLORS.chartColors[0], strokeWidth: 2, r: 4, fill: COLORS.cardBackground }}
                            activeDot={{ stroke: COLORS.chartColors[0], strokeWidth: 3, r: 6, fill: COLORS.cardBackground }}
                            name="Официальные" 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="practice" 
                            stroke={COLORS.chartColors[1]} 
                            strokeWidth={3}
                            dot={{ stroke: COLORS.chartColors[1], strokeWidth: 2, r: 4, fill: COLORS.cardBackground }}
                            activeDot={{ stroke: COLORS.chartColors[1], strokeWidth: 3, r: 6, fill: COLORS.cardBackground }}
                            name="Праки" 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card style={COMPONENT_STYLES.card}>
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="py-1 px-1" style={{ color: COLORS.textColor }}>Личная статистика игроков</CardTitle>
                    <User className="h-5 w-5" style={{ color: COLORS.textColorSecondary }} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {players.map(player => (
                      <div key={player.id} className="rounded-lg p-4" style={{ backgroundColor: COLORS.backgroundColor }}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold" style={{ color: COLORS.textColor }}>{player.name}</h3>
                            <div className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                              HLTV Rating: {player.hltvRating}
                            </div>
                          </div>
                          <div className="text-sm font-medium py-1 px-3 rounded-md" style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}>
                            Винрейт: {player.winRate}%
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div className="text-center p-2 rounded-md" style={{ backgroundColor: COLORS.cardBackground }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.textColor }}>{player.kills}</p>
                            <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Убийства</p>
                          </div>
                          <div className="text-center p-2 rounded-md" style={{ backgroundColor: COLORS.cardBackground }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.textColor }}>{player.deaths}</p>
                            <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Смерти</p>
                          </div>
                          <div className="text-center p-2 rounded-md" style={{ backgroundColor: COLORS.cardBackground }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.textColor }}>{player.kdRatio}</p>
                            <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>K/D</p>
                          </div>
                          <div className="text-center p-2 rounded-md" style={{ backgroundColor: COLORS.cardBackground }}>
                            <p className="text-lg font-bold" style={{ color: COLORS.textColor }}>{player.headshotPercentage}%</p>
                            <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Headshots</p>
                          </div>
                        </div>
                        <div className="h-28 p-2 rounded-md" style={{ backgroundColor: COLORS.cardBackground }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={player.winRateHistory}>
                              <XAxis dataKey="date" stroke={COLORS.textColorSecondary} />
                              <YAxis domain={[40, 70]} stroke={COLORS.textColorSecondary} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: COLORS.cardBackground, 
                                  borderColor: COLORS.borderColor,
                                  color: COLORS.textColor,
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                  borderRadius: '8px',
                                  padding: '10px 14px'
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={COLORS.chartColors[0]} 
                                strokeWidth={2.5}
                                dot={{ stroke: COLORS.chartColors[0], strokeWidth: 2, r: 5, fill: COLORS.cardBackground }}
                                activeDot={{ stroke: COLORS.chartColors[0], strokeWidth: 2, r: 7, fill: COLORS.cardBackground }}
                                name="Винрейт"
                                animationDuration={1800}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'cs2' && (
          <ErrorBoundary fallback={<div>Ошибка в CS2 аналитике</div>}>
            <Cs2AnalyticsPanel />
          </ErrorBoundary>
        )}

        {activeTab === 'heatmaps' && (
          <div className="space-y-4">
            <Card style={COMPONENT_STYLES.card}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <CardTitle className="py-1 px-1 mb-2 sm:mb-0 font-heading" style={{ color: COLORS.textColor }}>Командная тепловая карта</CardTitle>
                  <Tabs 
                    defaultValue="official" 
                    value={selectedMapType} 
                    onValueChange={(value) => setSelectedMapType(value as 'practice' | 'official')}
                  >
                    <TabsList style={COMPONENT_STYLES.tabs.list}>
                      <TabsTrigger value="practice" style={{ color: COLORS.textColor, 
                        backgroundColor: selectedMapType === 'practice' ? COLORS.primary : 'transparent',
                        ...(selectedMapType === 'practice' ? { color: '#ffffff' } : {}) 
                      }}>
                        Праки
                      </TabsTrigger>
                      <TabsTrigger value="official" style={{ color: COLORS.textColor, 
                        backgroundColor: selectedMapType === 'official' ? COLORS.primary : 'transparent',
                        ...(selectedMapType === 'official' ? { color: '#ffffff' } : {}) 
                      }}>
                        Официальные
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                    <Calendar className="h-5 w-5" style={{ color: COLORS.textColorSecondary }} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1 rounded-md border focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                      style={{ backgroundColor: COLORS.cardBackground, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                    />
                  </div>
                  
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200`}
                    style={{ 
                      borderColor: dragActive ? COLORS.primary : COLORS.borderColor,
                      backgroundColor: dragActive ? `${COLORS.primary}1a` : 'transparent',
                      color: COLORS.textColor
                    }}
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png" 
                      multiple 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                    />
                    <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: COLORS.primary }} />
                    <p style={{ color: COLORS.textColorSecondary }} className="mb-1">Перетащите файл сюда или нажмите для загрузки</p>
                    <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Поддерживаются форматы JPG, PNG</p>
                  </div>

                  {isUploading && (
                    <div className="text-center p-4">
                      <p className="text-sm text-muted-foreground">Загрузка...</p>
                    </div>
                  )}

                  {uploadedImages.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">Загруженные изображения ({uploadedImages.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploadedImages.map((img) => (
                          <div key={img.id} className="relative group">
                            <div className="overflow-hidden rounded-md border border-border h-48 bg-muted">
                              <img 
                                src={img.url} 
                                alt={`Uploaded ${img.file.name}`} 
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                              className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove image"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <div className="text-xs truncate mt-1 text-muted-foreground">{img.file.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadedImages.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-base font-semibold">Просмотр выбранной карты</h3>
                      {uploadedImages.length > 0 && (
                        <div className="bg-black rounded-lg overflow-hidden">
                          <img 
                            src={uploadedImages[0].url} 
                            alt="Heat map view" 
                            className="w-full h-auto max-h-[500px] object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'training' && (
          <Card style={COMPONENT_STYLES.card}>
            <CardHeader className="pb-2">
              <CardTitle className="py-1 px-1 font-heading" style={{ color: COLORS.textColor }}>Тренировки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                  <Dumbbell className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                  <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{trainingStats.totalSessions}</p>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Всего тренировок</p>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                  <Clock className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                  <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{trainingStats.averageDuration} минут</p>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Средняя продолжительность</p>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                  <Flame className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                  <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{trainingStats.completionRate}%</p>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Завершенность</p>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg" style={{ backgroundColor: COLORS.backgroundColor }}>
                  <TrendingUp className="h-5 w-5 mb-1" style={{ color: COLORS.textColorSecondary }} />
                  <p className="text-xl font-bold" style={{ color: COLORS.textColor }}>{trainingStats.intensityScore}</p>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>Интенсивность</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'detailedStats' && (
          <div className="flex flex-col space-y-4">
            <div className="flex flex-wrap justify-between items-center p-3 rounded-lg shadow-sm mb-4" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
              <div className="flex items-center gap-3 w-full sm:w-auto mb-2 sm:mb-0">
                <span className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>Выбрать карту:</span>
                <Select 
                  value={selectedMap} 
                  onValueChange={setSelectedMap}
                >
                  <SelectTrigger className="w-[180px]" style={{ backgroundColor: COLORS.cardBackground, color: COLORS.textColor }}>
                    <SelectValue placeholder="Выберите карту" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: COLORS.cardBackground, color: COLORS.textColor, borderColor: COLORS.borderColor }}>
                    <SelectItem value="all">Все карты</SelectItem>
                    <SelectItem value="mirage">Mirage</SelectItem>
                    <SelectItem value="anubis">Anubis</SelectItem>
                    <SelectItem value="dust2">Dust2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card style={COMPONENT_STYLES.card}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="py-1 px-1 font-heading" style={{ color: COLORS.textColor }}>Статистика {currentMapStats.name}</CardTitle>
                  <Map className="h-5 w-5" style={{ color: COLORS.textColorSecondary }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}>
                        <th className="border p-2 text-left" style={{ borderColor: COLORS.borderColor }}>Общие показатели</th>
                        <th className="border p-2 text-right" style={{ borderColor: COLORS.borderColor }}></th>
                        <th className="border p-2 text-left" style={{ borderColor: COLORS.borderColor }}>CT</th>
                        <th className="border p-2 text-right" style={{ borderColor: COLORS.borderColor }}></th>
                        <th className="border p-2 text-left" style={{ borderColor: COLORS.borderColor }}>T</th>
                        <th className="border p-2 text-right" style={{ borderColor: COLORS.borderColor }}></th>
                      </tr>
                    </thead>
                    <tbody style={{ color: COLORS.textColor }}>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Количество праков</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.totalGames}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Количество раундов</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.roundsTotal}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Количество раундов</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.roundsTotal}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Победы</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.wins}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Победы в раундах</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.roundsWon}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Победы в раундах</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.roundsWon}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Поражении</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.losses}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Поражении в раундах</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.roundsLost}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Поражении в раундах</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.roundsLost}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Ничьи</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.draws}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.winRate}%</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.winRate}%</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.winRate}%</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Пистолетки</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.pistolRounds}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Пистолетки</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.pistolRounds}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Кол-во выигранных раундов</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.roundsTotal.wins}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>50%</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>50%</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Кол-во проигранных раундов</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.roundsTotal.losses}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds wins</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.avgWins}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds wins</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.avgWins}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Round avg win-rate</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.roundsTotal.winRate}%</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds lost</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.ctSide.avgLosses}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds lost</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.tSide.avgLosses}</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds wins</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.roundsTotal.avgWins}</td>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={4}>Скрипты</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>AVG rounds lost</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}>{currentMapStats.roundsTotal.avgLosses}</td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={2}>Скрипты</td>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={4}>Дефолты</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Дефолты</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={4}>Форсы</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Форсы</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={4}>Антифорсы</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Антифорсы</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-center" style={{ borderColor: COLORS.borderColor }} colSpan={4}>Доигровки</td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Доигровки</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                      <tr style={{ backgroundColor: COLORS.backgroundColor }}>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}>Win-rate %</td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2" style={{ borderColor: COLORS.borderColor }}></td>
                        <td className="border p-2 text-right" style={{ backgroundColor: `${COLORS.primary}19`, borderColor: COLORS.borderColor }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'reports' && (
          <ErrorBoundary>
            <TeamReports />
          </ErrorBoundary>
        )}

        {activeTab === 'correlations' && (
          <ErrorBoundary>
            <CorrelationAnalysis />
          </ErrorBoundary>
        )}

        {activeTab === 'advanced' && (
          <ErrorBoundary>
            <AdvancedAnalytics />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default Analytics; 