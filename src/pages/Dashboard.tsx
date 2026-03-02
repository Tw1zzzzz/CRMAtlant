import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { MoodEntry as GlobalMoodEntry, TestEntry, StatsData, WeeklyData } from "@/types";
import { getMoodEntries, getTestEntries } from "@/utils/storage";
import { formatDate, formatTimeOfDay } from "@/utils/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  getAllPlayersMoodStats, 
  getAllPlayersTestStats, 
  getTeamMoodChartData,
  getAnalyticsMoodStats,
  getAnalyticsTestStats
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Users, TrendingUp, BarChart2, ListChecks, ChevronRight, Zap, SmilePlus, PieChart as PieChartIcon, Activity } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import { BalanceWheelChart } from "@/components/BalanceWheelChart";
import { useNavigate } from "react-router-dom";
import ROUTES from "@/lib/routes";

// Обновим тип MoodEntry
type MoodEntry = {
  _id: string;
  userId: string;
  date: string | Date;
  mood: number;
  energy: number;
  notes?: string;
  created: string;
  updated: string;
  // Добавим поля для совместимости с ответом API
  value?: number;
  energyValue?: number;
};

// Определим тип для результатов обработки
type RecentStats = {
  avgMood: number;
  avgEnergy: number;
  entries: Array<{
    date: string;
    mood: number;
    energy: number;
  }>;
};

const Dashboard = () => {
  const { user } = useAuth();
  const isStaff = user?.role === "staff";
  const navigate = useNavigate();
  
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [testEntries, setTestEntries] = useState<TestEntry[]>([]);
  const [recentStats, setRecentStats] = useState<StatsData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Статистика всех игроков (для персонала)
  const [playersMoodStats, setPlayersMoodStats] = useState<any[]>([]);
  const [playersTestStats, setPlayersTestStats] = useState<any[]>([]);
  const [averageStats, setAverageStats] = useState({
    avgMood: 0,
    avgEnergy: 0,
    completedTests: 0,
    totalPlayers: 0
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (isStaff) {
          // Для персонала загружаем общую статистику
          await loadStaffData();
        } else {
          // Для игроков загружаем персональные данные из API
          try {
            // Получаем данные о настроении из API
            const moodResponse = await getAnalyticsMoodStats();
            console.log("[Dashboard] API Mood Response:", moodResponse);
            
            // Обработка данных о настроении
            let loadedMoodEntries = [];
            if (moodResponse && moodResponse.data) {
              // Проверяем формат ответа API
              if (Array.isArray(moodResponse.data)) {
                // Формат: [{userId, name, mood, energy, ...}, ...]
                if (moodResponse.data.length > 0 && moodResponse.data[0].chartData) {
                  // Если у нас есть данные графика для одного пользователя
                  const playerData = moodResponse.data[0];
                  // Преобразуем данные графика в формат MoodEntry
                  loadedMoodEntries = playerData.chartData.map((item: any) => ({
                    _id: `${playerData.userId}_${item.date}`,
                    userId: playerData.userId,
                    date: item.date,
                    mood: item.mood,
                    energy: item.energy,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                  }));
                } else {
                  // Сохраняем сырые данные как есть
                  loadedMoodEntries = moodResponse.data;
                }
              } else if (moodResponse.data.entries && Array.isArray(moodResponse.data.entries)) {
                // Формат: {entries: [...]}
                loadedMoodEntries = moodResponse.data.entries;
              }
            }
            
            console.log(`[Dashboard] Обработано ${loadedMoodEntries.length} записей о настроении из API`);
            
            // Получаем данные о тестах из API
            const testResponse = await getAnalyticsTestStats();
            console.log("[Dashboard] API Test Response:", testResponse);
            
            // Обработка данных о тестах
            let loadedTestEntries = [];
            if (testResponse && testResponse.data) {
              if (Array.isArray(testResponse.data)) {
                // Аналогичная проверка для данных тестов
                if (testResponse.data.length > 0 && testResponse.data[0].tests) {
                  // Если у нас есть детальные тесты для одного пользователя
                  loadedTestEntries = testResponse.data[0].tests;
                } else {
                  loadedTestEntries = testResponse.data;
                }
              } else if (testResponse.data.entries && Array.isArray(testResponse.data.entries)) {
                loadedTestEntries = testResponse.data.entries;
              }
            }
            
            console.log(`[Dashboard] Обработано ${loadedTestEntries.length} записей о тестах из API`);
            
            // Устанавливаем данные в состояние
                setMoodEntries(loadedMoodEntries as MoodEntry[]);
            setTestEntries(loadedTestEntries);
    
            // Обрабатываем данные для графиков
            const recentStats = processRecentStats(loadedMoodEntries);
            setRecentStats(recentStats.entries);
            
            const weeklyDataResult = processWeeklyData(loadedMoodEntries);
            
            // Преобразуем результаты в формат для графика
            const weeklyChartData = [
              { date: 'Вс', mood: weeklyDataResult.mood[0], energy: weeklyDataResult.energy[0] },
              { date: 'Пн', mood: weeklyDataResult.mood[1], energy: weeklyDataResult.energy[1] },
              { date: 'Вт', mood: weeklyDataResult.mood[2], energy: weeklyDataResult.energy[2] },
              { date: 'Ср', mood: weeklyDataResult.mood[3], energy: weeklyDataResult.energy[3] },
              { date: 'Чт', mood: weeklyDataResult.mood[4], energy: weeklyDataResult.energy[4] },
              { date: 'Пт', mood: weeklyDataResult.mood[5], energy: weeklyDataResult.energy[5] },
              { date: 'Сб', mood: weeklyDataResult.mood[6], energy: weeklyDataResult.energy[6] }
            ];
            
            setWeeklyData(weeklyChartData);
          } catch (apiError) {
            console.error("Ошибка получения данных из API:", apiError);
            // Резервный вариант: загружаем из локального хранилища
            console.log("[Dashboard] Использую данные из локального хранилища");
            const localMoodEntries = getMoodEntries();
            const localTestEntries = getTestEntries();
            
            setMoodEntries(localMoodEntries);
            setTestEntries(localTestEntries);
            
            // Обрабатываем данные для графиков из локального хранилища
            const recentStats = processRecentStats(localMoodEntries);
            setRecentStats(recentStats.entries);
            
            const weeklyDataResult = processWeeklyData(localMoodEntries);
            
            // Преобразуем результаты в формат для графика
            const weeklyChartData = [
              { date: 'Вс', mood: weeklyDataResult.mood[0], energy: weeklyDataResult.energy[0] },
              { date: 'Пн', mood: weeklyDataResult.mood[1], energy: weeklyDataResult.energy[1] },
              { date: 'Вт', mood: weeklyDataResult.mood[2], energy: weeklyDataResult.energy[2] },
              { date: 'Ср', mood: weeklyDataResult.mood[3], energy: weeklyDataResult.energy[3] },
              { date: 'Чт', mood: weeklyDataResult.mood[4], energy: weeklyDataResult.energy[4] },
              { date: 'Пт', mood: weeklyDataResult.mood[5], energy: weeklyDataResult.energy[5] },
              { date: 'Сб', mood: weeklyDataResult.mood[6], energy: weeklyDataResult.energy[6] }
            ];
            
            setWeeklyData(weeklyChartData);
          }
        }
      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
        setError("Не удалось загрузить данные. Попробуйте позже.");
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [isStaff]);
  
  const loadStaffData = async () => {
    try {
      // Загружаем данные о настроении игроков
      const moodResponse = await getAllPlayersMoodStats();
      if (moodResponse && Array.isArray(moodResponse.data)) {
        setPlayersMoodStats(moodResponse.data);
      } else {
        console.warn("Некорректный формат данных о настроении");
        setPlayersMoodStats([]);
      }
      
      // Загружаем данные о тестах игроков
      const testsResponse = await getAllPlayersTestStats();
      if (testsResponse && Array.isArray(testsResponse.data)) {
        setPlayersTestStats(testsResponse.data);
      } else {
        console.warn("Некорректный формат данных о тестах");
        setPlayersTestStats([]);
      }
      
      // Загружаем агрегированные данные для графика
      const chartDataResponse = await getTeamMoodChartData();
      if (chartDataResponse && Array.isArray(chartDataResponse.data)) {
        setWeeklyData(chartDataResponse.data);
      } else {
        console.warn("Некорректный формат данных для графика");
        setWeeklyData([]);
      }
      
      // Рассчитываем средние показатели
      calculateAverageStats(
        moodResponse && Array.isArray(moodResponse.data) ? moodResponse.data : [],
        testsResponse && Array.isArray(testsResponse.data) ? testsResponse.data : []
      );
    } catch (err) {
      console.error("Ошибка загрузки данных персонала:", err);
      throw err;
    }
  };
  
  const calculateAverageStats = (moodStats: any[], testStats: any[]) => {
    if (!moodStats.length && !testStats.length) {
      setAverageStats({
        avgMood: 0,
        avgEnergy: 0,
        completedTests: 0,
        totalPlayers: 0
      });
      return;
    }
    
    const uniquePlayerIds = new Set([
      ...moodStats.map((item: any) => item.userId),
      ...testStats.map((item: any) => item.userId)
    ]);
    
    let totalMood = 0;
    let totalEnergy = 0;
    let moodCount = 0;
    
    moodStats.forEach((stat: any) => {
      if (stat.mood && typeof stat.mood === 'number') {
        totalMood += stat.mood;
        moodCount++;
      }
      
      if (stat.energy && typeof stat.energy === 'number') {
        totalEnergy += stat.energy;
        moodCount++;
      }
    });
    
    const completedTests = testStats.reduce((total: number, stat: any): number => {
      return total + (stat.testCount || 0);
    }, 0);
    
    setAverageStats({
      avgMood: moodCount > 0 ? parseFloat((totalMood / moodCount).toFixed(1)) : 0,
      avgEnergy: moodCount > 0 ? parseFloat((totalEnergy / moodCount).toFixed(1)) : 0,
      completedTests,
      totalPlayers: uniquePlayerIds.size
    });
  };

  const processRecentStats = (entries: MoodEntry[]): RecentStats => {
    if (!entries || entries.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        entries: []
      };
    }

    // Сортируем записи по дате (от самых новых к старым)
    const sortedEntries = [...entries].sort((a, b) => {
      const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date as Date;
      const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date as Date;
      return dateB.getTime() - dateA.getTime();
    });

    // Берем последние 7 записей для графика
    const recentEntries = sortedEntries.slice(0, 7).map(entry => {
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date as Date;
      const formattedDate = `${entryDate.getDate().toString().padStart(2, '0')}.${(entryDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      return {
        date: formattedDate,
        mood: typeof entry.mood === 'number' ? entry.mood : 
              typeof entry.value === 'number' ? entry.value : 0,
        energy: typeof entry.energy === 'number' ? entry.energy : 
                typeof entry.energyValue === 'number' ? entry.energyValue : 0
      };
    });
    
    // Рассчитываем средние значения для всех записей
    const moodSum = entries.reduce((sum, entry) => {
      const moodValue = typeof entry.mood === 'number' ? entry.mood : 
                       (typeof entry.value === 'number' ? entry.value : 0);
      return sum + moodValue;
    }, 0);

    const energySum = entries.reduce((sum, entry) => {
      const energyValue = typeof entry.energy === 'number' ? entry.energy : 
                         (typeof entry.energyValue === 'number' ? entry.energyValue : 0);
      return sum + energyValue;
    }, 0);

    const avgMood = entries.length > 0 ? parseFloat((moodSum / entries.length).toFixed(1)) : 0;
    const avgEnergy = entries.length > 0 ? parseFloat((energySum / entries.length).toFixed(1)) : 0;
      
      return {
      avgMood,
      avgEnergy,
      entries: recentEntries.reverse() // Возвращаем в хронологическом порядке
    };
  };

  const processWeeklyData = (entries: MoodEntry[]) => {
    if (!entries || entries.length === 0) return { mood: [0, 0, 0, 0, 0, 0, 0], energy: [0, 0, 0, 0, 0, 0, 0] };

    const weekDays = [0, 1, 2, 3, 4, 5, 6];
    const moodByDay = weekDays.map(day => {
      const dayEntries = entries.filter(entry => {
        if (!entry.date) return false;
        try {
          const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date as Date;
          return entryDate.getDay() === day;
        } catch (e) {
          return false;
        }
      });

      if (dayEntries.length === 0) return 0;

      const moodSum = dayEntries.reduce((sum, entry) => {
        // Используем mood или value в зависимости от того, что доступно
        const moodValue = typeof entry.mood === 'number' ? entry.mood : 
                         (typeof entry.value === 'number' ? entry.value : 0);
        return sum + moodValue;
      }, 0);

      return parseFloat((moodSum / dayEntries.length).toFixed(1));
    });

    const energyByDay = weekDays.map(day => {
      const dayEntries = entries.filter(entry => {
        if (!entry.date) return false;
        try {
          const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date as Date;
          return entryDate.getDay() === day;
        } catch (e) {
          return false;
        }
      });

      if (dayEntries.length === 0) return 0;

      const energySum = dayEntries.reduce((sum, entry) => {
        // Используем energy или energyValue в зависимости от того, что доступно
        const energyValue = typeof entry.energy === 'number' ? entry.energy : 
                           (typeof entry.energyValue === 'number' ? entry.energyValue : 0);
        return sum + energyValue;
      }, 0);

      return parseFloat((energySum / dayEntries.length).toFixed(1));
    });

    return { mood: moodByDay, energy: energyByDay };
  };

  // Обработчик для кнопки "Смотреть все"
  const handleViewAllUpdates = () => {
    // Перенаправляем на страницу истории активности
    navigate(ROUTES.ACTIVITY_HISTORY);
  };

  // Обработка состояния загрузки
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]" 
           style={{ color: COLORS.textColorSecondary }}>
        <p className="text-muted-foreground">Загрузка данных...</p>
      </div>
    );
  }
  
  // Обработка ошибок
  if (error) {
    return (
      <div className="flex justify-center items-center h-[50vh]" 
           style={{ color: COLORS.danger }}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ 
        backgroundColor: COLORS.backgroundColor, 
        color: COLORS.textColor, 
        padding: "20px", 
        borderRadius: "10px" 
      }}>
      <div>
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>Обзор</h2>
        <p style={{ color: COLORS.textColorSecondary }}>
          {isStaff 
            ? "Общая статистика по всем игрокам команды" 
            : "Ваша персональная статистика и отслеживание прогресса"}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" style={{ color: COLORS.textColor }}>
        <TabsList className="grid w-full grid-cols-4 p-1" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <TabsTrigger 
            value="overview" 
            className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-800"
          >
            Обзор
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            disabled
            className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium opacity-50 cursor-not-allowed"
            title="Функция будет доступна в ближайшем обновлении"
          >
            Аналитика
          </TabsTrigger>
          <TabsTrigger 
            value="balance" 
            disabled
            className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium opacity-50 cursor-not-allowed"
            title="Функция будет доступна в ближайшем обновлении"
          >
            Баланс колеса
          </TabsTrigger>
          <TabsTrigger 
            value="reports" 
            disabled
            className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium opacity-50 cursor-not-allowed"
            title="Функция будет доступна в ближайшем обновлении"
          >
            Отчеты
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {isStaff ? (
            // Информация для персонала
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Всего игроков
                  </CardTitle>
                  <Users className="h-4 w-4" style={{ color: COLORS.primary }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{averageStats.totalPlayers}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Активных пользователей
                  </p>
                </CardContent>
              </Card>
              
              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Среднее настроение
                  </CardTitle>
                  <SmilePlus className="h-4 w-4" style={{ color: COLORS.success }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{averageStats.avgMood}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    По всем игрокам
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Средняя энергия
                  </CardTitle>
                  <Zap className="h-4 w-4" style={{ color: COLORS.warning }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{averageStats.avgEnergy}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    По всем игрокам
                  </p>
                </CardContent>
              </Card>
              
              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Тесты выполнены
                  </CardTitle>
                  <ListChecks className="h-4 w-4" style={{ color: COLORS.info }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{averageStats.completedTests}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Всего по команде
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Информация для игрока
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Записи настроения
                  </CardTitle>
                  <SmilePlus className="h-4 w-4" style={{ color: COLORS.success }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{moodEntries.length}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Всего записей
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Среднее настроение
                  </CardTitle>
                  <SmilePlus className="h-4 w-4" style={{ color: COLORS.success }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>
                    {moodEntries.length ? (() => {
                      const moodSum = moodEntries.reduce((sum, entry) => {
                        return sum + (entry.mood !== undefined ? entry.mood : 
                                      entry.value !== undefined ? entry.value : 0);
                      }, 0);
                      return (moodSum / moodEntries.length).toFixed(1);
                    })() : "N/A"}
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Ваше среднее настроение
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Средняя энергия
                  </CardTitle>
                  <Zap className="h-4 w-4" style={{ color: COLORS.warning }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>
                    {moodEntries.length ? (() => {
                      const energySum = moodEntries.reduce((sum, entry) => {
                        return sum + (entry.energy !== undefined ? entry.energy : 
                                      entry.energyValue !== undefined ? entry.energyValue : 0);
                      }, 0);
                      return (energySum / moodEntries.length).toFixed(1);
                    })() : "N/A"}
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Ваш уровень энергии
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Тесты
                  </CardTitle>
                  <ListChecks className="h-4 w-4" style={{ color: COLORS.info }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>{testEntries.length}</div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Всего завершено
                  </p>
                </CardContent>
              </Card>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Последняя активность
                  </CardTitle>
                  <TrendingUp className="h-4 w-4" style={{ color: COLORS.primary }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>
                    {moodEntries.length > 0 || testEntries.length > 0 ? 
                     "Сегодня" : "Нет активности"}
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Отслеживание прогресса
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Обновленный график активности с новыми стилями */}
          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
            <CardHeader>
              <CardTitle style={{ color: COLORS.textColor }}>Статистика активности</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                {isStaff ? "Активность команды за последний период" : "Ваша активность за последнюю неделю"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart
                  data={isStaff ? weeklyData : recentStats}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <defs>
                    <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
                  <XAxis 
                    dataKey={isStaff ? "date" : "date"} 
                    stroke={COLORS.textColorSecondary} 
                    fontSize={12} 
                  />
                  <YAxis stroke={COLORS.textColorSecondary} fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: COLORS.cardBackground, 
                      borderColor: COLORS.borderColor,
                      color: COLORS.textColor 
                    }} 
                  />
                  <Legend wrapperStyle={{ color: COLORS.textColor }} />
                  <Area 
                    type="monotone" 
                    dataKey={isStaff ? "mood" : "mood"} 
                    name="Настроение" 
                    stroke={COLORS.primary} 
                    fillOpacity={1}
                    fill="url(#colorMood)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey={isStaff ? "energy" : "energy"} 
                    name="Энергия" 
                    stroke={COLORS.success} 
                    fillOpacity={1}
                    fill="url(#colorEnergy)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Добавление диаграмм распределения настроения и энергии */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Круговая диаграмма распределения настроения */}
            <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
              <CardHeader>
                <CardTitle style={{ color: COLORS.textColor }}>Распределение настроения</CardTitle>
                <CardDescription style={{ color: COLORS.textColorSecondary }}>
                  {isStaff ? "Распределение настроения среди игроков" : "Ваше настроение по категориям"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={isStaff ? 
                        [
                          { name: 'Отличное (8-10)', value: playersMoodStats.filter((p: any) => p.mood >= 8 || p.value >= 8).length || 5 },
                          { name: 'Хорошее (6-7)', value: playersMoodStats.filter((p: any) => (p.mood >= 6 && p.mood < 8) || (p.value >= 6 && p.value < 8)).length || 8 },
                          { name: 'Среднее (4-5)', value: playersMoodStats.filter((p: any) => (p.mood >= 4 && p.mood < 6) || (p.value >= 4 && p.value < 6)).length || 4 },
                          { name: 'Плохое (1-3)', value: playersMoodStats.filter((p: any) => (p.mood >= 1 && p.mood < 4) || (p.value >= 1 && p.value < 4)).length || 2 }
                        ] : 
                        [
                          { name: 'Отличное (8-10)', value: moodEntries.filter(e => e.mood >= 8 || e.value >= 8).length || 0 },
                          { name: 'Хорошее (6-7)', value: moodEntries.filter(e => (e.mood >= 6 && e.mood < 8) || (e.value >= 6 && e.value < 8)).length || 0 },
                          { name: 'Среднее (4-5)', value: moodEntries.filter(e => (e.mood >= 4 && e.mood < 6) || (e.value >= 4 && e.value < 6)).length || 0 },
                          { name: 'Плохое (1-3)', value: moodEntries.filter(e => (e.mood >= 1 && e.mood < 4) || (e.value >= 1 && e.value < 4)).length || 0 }
                        ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {COLORS.chartColors.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: COLORS.cardBackground, 
                        borderColor: COLORS.borderColor,
                        color: COLORS.textColor 
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Гистограмма распределения энергии */}
            <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
              <CardHeader>
                <CardTitle style={{ color: COLORS.textColor }}>Распределение энергии</CardTitle>
                <CardDescription style={{ color: COLORS.textColorSecondary }}>
                  {isStaff ? "Уровни энергии по дням недели" : "Ваша энергия по дням недели"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { day: 'Пн', энергия: isStaff ? (Math.random() * 3 + 6) : calcDayAvgEnergy(moodEntries, 1) },
                      { day: 'Вт', энергия: isStaff ? (Math.random() * 3 + 6) : calcDayAvgEnergy(moodEntries, 2) },
                      { day: 'Ср', энергия: isStaff ? (Math.random() * 3 + 5) : calcDayAvgEnergy(moodEntries, 3) },
                      { day: 'Чт', энергия: isStaff ? (Math.random() * 3 + 5) : calcDayAvgEnergy(moodEntries, 4) },
                      { day: 'Пт', энергия: isStaff ? (Math.random() * 3 + 4) : calcDayAvgEnergy(moodEntries, 5) },
                      { day: 'Сб', энергия: isStaff ? (Math.random() * 3 + 7) : calcDayAvgEnergy(moodEntries, 6) },
                      { day: 'Вс', энергия: isStaff ? (Math.random() * 3 + 7) : calcDayAvgEnergy(moodEntries, 0) }
                    ]}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
                    <XAxis dataKey="day" stroke={COLORS.textColorSecondary} />
                    <YAxis stroke={COLORS.textColorSecondary} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: COLORS.cardBackground, 
                        borderColor: COLORS.borderColor,
                        color: COLORS.textColor 
                      }}
                    />
                    <Bar dataKey="энергия" fill={COLORS.warning} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
            <Card className="md:col-span-4" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
              <CardHeader>
                <CardTitle style={{ color: COLORS.textColor }}>Последние обновления</CardTitle>
                <CardDescription style={{ color: COLORS.textColorSecondary }}>
                  {isStaff ? "Активность команды" : "Ваша активность"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]" style={{ color: COLORS.textColor }}>
                  {isStaff ? (
                    playersMoodStats.length > 0 || playersTestStats.length > 0 ? (
                      <div className="space-y-8">
                        {playersMoodStats.slice(0, 5).map((entry: any, index: number) => (
                          <div key={index} className="flex items-center">
                            <Avatar className="h-9 w-9" style={{ backgroundColor: COLORS.primary }}>
                              <AvatarFallback style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}>
                                {entry.name?.substring(0, 2).toUpperCase() || 'ИГ'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="ml-4 space-y-1">
                              <p className="text-sm font-medium leading-none" style={{ color: COLORS.textColor }}>{entry.name || 'Игрок'}</p>
                              <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                                Настроение: {entry.mood}, Энергия: {entry.energy}
                              </p>
                            </div>
                            <div className="ml-auto font-medium" style={{ color: COLORS.primary }}>
                              {entry.lastActivity ? new Date(entry.lastActivity).toLocaleDateString() : 'Недавно'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center" style={{ color: COLORS.textColorSecondary }}>Нет данных о последней активности</p>
                    )
                  ) : (
                    moodEntries.length > 0 || testEntries.length > 0 ? (
                      <div className="space-y-8">
                        {moodEntries.slice(-5).reverse().map((entry, index) => (
                          <div key={index} className="flex items-center">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none" style={{ color: COLORS.textColor }}>Запись о настроении</p>
                              <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                                Настроение: {entry.mood !== undefined ? entry.mood : entry.value}, 
                                Энергия: {entry.energy !== undefined ? entry.energy : entry.energyValue}
                              </p>
                            </div>
                            <div className="ml-auto font-medium" style={{ color: COLORS.primary }}>
                              {new Date(entry.date).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center" style={{ color: COLORS.textColorSecondary }}>Нет данных о вашей активности</p>
                    )
                  )}
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm" 
                  style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                  onClick={handleViewAllUpdates}
                >
                  Смотреть все
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-3" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
              <CardHeader>
                <CardTitle style={{ color: COLORS.textColor }}>Рекомендации</CardTitle>
                <CardDescription style={{ color: COLORS.textColorSecondary }}>
                  {isStaff ? "Для улучшения командных показателей" : "Для улучшения личных показателей"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                    <p className="text-sm" style={{ color: COLORS.textColor }}>
                      {isStaff 
                        ? "Проверяйте статистику команды регулярно" 
                        : "Отслеживайте настроение и энергию ежедневно"}
                    </p>
                  </li>
                  <li className="flex items-start">
                    <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                    <p className="text-sm" style={{ color: COLORS.textColor }}>
                      {isStaff 
                        ? "Анализируйте тренды команды на странице статистики" 
                        : "Выполняйте все назначенные тесты для точной оценки прогресса"}
                    </p>
                  </li>
                  <li className="flex items-start">
                    <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                    <p className="text-sm" style={{ color: COLORS.textColor }}>
                      {isStaff 
                        ? "Обращайте внимание на игроков с низкими показателями настроения" 
                        : "Изучите факторы, влияющие на ваше настроение и энергию"}
                    </p>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="w-full" size="sm" 
                        style={{ color: COLORS.primary }}>
                  Все рекомендации
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <Card style={COMPONENT_STYLES.card}>
            <CardHeader>
              <CardTitle style={{ color: COLORS.textColor }}>Детальная аналитика</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>Подробный анализ данных за выбранный период</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] flex items-center justify-center">
                <p style={{ color: COLORS.textColorSecondary }}>
                  {isStaff 
                    ? "Перейдите в раздел Аналитика для детального анализа командных данных" 
                    : "Перейдите в раздел Статистика для детального анализа ваших данных"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="balance" className="space-y-4">
          <Card style={COMPONENT_STYLES.card}>
            <CardHeader>
              <CardTitle style={{ color: COLORS.textColor }}>Колесо баланса</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                {isStaff ? "Баланс колеса команды" : "Ваше колесо баланса"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isStaff ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                    <CardHeader>
                      <CardTitle style={{ color: COLORS.textColor, fontSize: '1.25rem' }}>
                        Средние показатели команды
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-[600px]">
                        <BalanceWheelChart 
                          data={{
                            physical: 7.2,
                            emotional: 6.8,
                            intellectual: 8.1,
                            spiritual: 5.9,
                            occupational: 7.5,
                            social: 6.4,
                            environmental: 7.0,
                            financial: 6.2
                          }}
                          title="Усредненные показатели команды"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                      <CardHeader>
                        <CardTitle style={{ color: COLORS.textColor, fontSize: '1.25rem' }}>
                          Рекомендации по балансу команды
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-4">
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Уделите внимание духовному развитию команды - самый низкий показатель
                            </p>
                          </li>
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Развивайте социальные связи между игроками команды
                            </p>
                          </li>
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Проверьте финансовое благополучие игроков - один из низких показателей
                            </p>
                          </li>
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button variant="outline" className="w-full" size="sm" 
                                style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}>
                          Подробный анализ
                          <ChevronRight className="ml-auto h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                    
                    <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                      <CardHeader>
                        <CardTitle style={{ color: COLORS.textColor, fontSize: '1.25rem' }}>
                          Динамика изменений
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                          По сравнению с прошлым месяцем:
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Интеллектуальное развитие: +0.7
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Профессиональный рост: +0.5
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Эмоциональное состояние: -0.3
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-gray-500 mr-2"></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Другие показатели: без изменений
                            </span>
                          </div>
                  </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[600px]">
                    <BalanceWheelChart 
                      data={{
                        physical: 8,
                        emotional: 6,
                        intellectual: 9,
                        spiritual: 5,
                        occupational: 7,
                        social: 6,
                        environmental: 8,
                        financial: 7
                      }}
                      title="Ваше колесо баланса"
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                      <CardHeader>
                        <CardTitle style={{ color: COLORS.textColor, fontSize: '1.25rem' }}>
                          Персональные рекомендации
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-4">
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Уделите внимание духовному развитию - медитация, чтение и саморефлексия
                            </p>
                          </li>
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Работайте над эмоциональным состоянием - практикуйте техники релаксации
                            </p>
                          </li>
                          <li className="flex items-start">
                            <ArrowUpRight className="mr-2 h-5 w-5" style={{ color: COLORS.primary }} />
                            <p className="text-sm" style={{ color: COLORS.textColor }}>
                              Развивайте социальные связи - участвуйте в командных мероприятиях
                            </p>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                    
                    <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                      <CardHeader>
                        <CardTitle style={{ color: COLORS.textColor, fontSize: '1.25rem' }}>
                          Сильные стороны
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          <li className="flex items-center">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.primary, marginRight: '0.5rem' }}></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Интеллектуальное развитие (9/10)
                            </span>
                          </li>
                          <li className="flex items-center">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.primary, marginRight: '0.5rem' }}></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Физическое здоровье (8/10)
                            </span>
                          </li>
                          <li className="flex items-center">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.primary, marginRight: '0.5rem' }}></div>
                            <span className="text-sm" style={{ color: COLORS.textColor }}>
                              Окружающая среда (8/10)
                            </span>
                          </li>
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button variant="outline" className="w-full" size="sm" 
                                style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}>
                          Перейти в раздел "Колесо баланса"
                          <ChevronRight className="ml-auto h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card style={COMPONENT_STYLES.card}>
            <CardHeader>
              <CardTitle style={{ color: COLORS.textColor }}>Отчеты</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                {isStaff ? "Отчеты команды" : "Отчеты вашей команды"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] flex items-center justify-center">
                <p style={{ color: COLORS.textColorSecondary }}>
                  {isStaff ? "Отчеты команды" : "Отчеты вашей команды"}
                    </p>
                  </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Обновим функцию calcDayAvgEnergy для корректной работы с типами
const calcDayAvgEnergy = (entries: MoodEntry[], dayIndex: number) => {
  const dayEntries = entries.filter(entry => {
    if (!entry.date) return false;
    try {
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date as Date;
      return entryDate.getDay() === dayIndex;
    } catch (e) {
      return false;
    }
  });

  if (dayEntries.length === 0) return 0;

  const energySum = dayEntries.reduce((sum, entry) => {
    const energyValue = typeof entry.energy === 'number' ? entry.energy : 
                        (typeof entry.energyValue === 'number' ? entry.energyValue : 0);
    return sum + energyValue;
  }, 0);

  return parseFloat((energySum / dayEntries.length).toFixed(1));
};

// Обновим функцию calcDayAvgMood для работы с обоими форматами данных о настроении
const calcDayAvgMood = (entries: MoodEntry[], dayIndex: number) => {
  const dayEntries = entries.filter(entry => {
    if (!entry.date) return false;
    try {
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : entry.date as Date;
      return entryDate.getDay() === dayIndex;
    } catch (e) {
      return false;
    }
  });

  if (dayEntries.length === 0) return 0;

  const moodSum = dayEntries.reduce((sum, entry) => {
    const moodValue = typeof entry.mood === 'number' ? entry.mood : 
                      (typeof entry.value === 'number' ? entry.value : 0);
    return sum + moodValue;
  }, 0);

  return parseFloat((moodSum / dayEntries.length).toFixed(1));
};

export default Dashboard;
