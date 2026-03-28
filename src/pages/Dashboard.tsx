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
  getAnalyticsTestStats,
  getBrainPerformanceSummary,
  getMyBaselineAssessment,
  getMyDailyQuestionnaire
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Users, TrendingUp, BarChart2, ListChecks, ChevronRight, Zap, SmilePlus, PieChart as PieChartIcon, Activity, Brain } from "lucide-react";
import type { BrainPerformanceSummary } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import { BalanceWheelChart } from "@/components/BalanceWheelChart";
import { useNavigate } from "react-router-dom";
import ROUTES from "@/lib/routes";
import DailyQuestionnairePanel from "@/components/questionnaires/DailyQuestionnairePanel";
import PlayerQuickStartPanel from "@/components/dashboard/PlayerQuickStartPanel";
import PlayerTestsPanel from "@/components/dashboard/PlayerTestsPanel";
import type { BaselineAssessment } from "@/types";
import BaselineAssessmentCard from "@/components/onboarding/BaselineAssessmentCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SubscriptionFeatureGate from "@/components/SubscriptionFeatureGate";

const BASELINE_REGISTER_MODAL_FLAG = "baselineAssessmentAfterRegister";

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
  const { user, refreshUser } = useAuth();
  const isStaff = user?.role === "staff";
  const hasPerformanceCoachCrmAccess = Boolean(user?.hasPerformanceCoachCrmAccess);
  const navigate = useNavigate();
  
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [testEntries, setTestEntries] = useState<TestEntry[]>([]);
  const [recentStats, setRecentStats] = useState<StatsData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brainSummary, setBrainSummary] = useState<BrainPerformanceSummary | null>(null);
  const [baselineAssessment, setBaselineAssessment] = useState<BaselineAssessment | null>(user?.baselineAssessment || null);
  const [dailyCheckDone, setDailyCheckDone] = useState(false);
  const [playerTab, setPlayerTab] = useState<string>(user?.baselineAssessmentCompleted ? "overview" : "quick-start");
  const [showBaselineRegistrationModal, setShowBaselineRegistrationModal] = useState(false);
  
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
    setBaselineAssessment(user?.baselineAssessment || null);
    setPlayerTab((current) => {
      if (current === "quick-start" && user?.baselineAssessmentCompleted) {
        return "overview";
      }

      if (!user?.baselineAssessmentCompleted) {
        return "quick-start";
      }

      return current || "overview";
    });
  }, [user?.baselineAssessmentCompleted, user?.baselineAssessment?.completedAt]);

  useEffect(() => {
    if (isStaff || typeof window === "undefined") {
      setShowBaselineRegistrationModal(false);
      return;
    }

    const shouldShow =
      sessionStorage.getItem(BASELINE_REGISTER_MODAL_FLAG) === "1" &&
      !user?.baselineAssessmentCompleted;

    setShowBaselineRegistrationModal(shouldShow);
  }, [isStaff, user?.baselineAssessmentCompleted]);

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
            const todayKey = new Date().toISOString().slice(0, 10);
            // Получаем данные о настроении из API
            const [moodResponse, testResponse] = await Promise.all([
              getAnalyticsMoodStats(),
              getAnalyticsTestStats(),
            ]);
            const [brainResponse, baselineResponse, dailyResponse] = hasPerformanceCoachCrmAccess
              ? await Promise.all([
                  getBrainPerformanceSummary(),
                  getMyBaselineAssessment(),
                  getMyDailyQuestionnaire(todayKey, todayKey)
                ])
              : [null, null, null];
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
            setBrainSummary(brainResponse?.data?.data || null);
            setBaselineAssessment(baselineResponse?.data?.data || user?.baselineAssessment || null);
            setDailyCheckDone(
              Boolean((dailyResponse?.data?.sleep?.length || 0) > 0 && (dailyResponse?.data?.screen?.length || 0) > 0)
            );
    
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
            setBrainSummary(null);
            setBaselineAssessment(user?.baselineAssessment || null);
            setDailyCheckDone(false);
            
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

  const chartCardStyle = {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.borderColor,
    boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)"
  };

  const chartGridProps = {
    stroke: COLORS.borderColor,
    strokeDasharray: "4 4"
  };

  const chartAxisProps = {
    stroke: COLORS.textColorSecondary,
    fontSize: 12,
    tickLine: false,
    axisLine: false
  };

  const chartTooltipStyle = {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.borderColor,
    color: COLORS.textColor
  };

  const moodDistributionData = isStaff
    ? [
        { name: 'Отличное', range: '8-10', value: playersMoodStats.filter((p: any) => p.mood >= 8 || p.value >= 8).length || 5, color: '#22c55e' },
        { name: 'Хорошее', range: '6-7', value: playersMoodStats.filter((p: any) => (p.mood >= 6 && p.mood < 8) || (p.value >= 6 && p.value < 8)).length || 8, color: '#38bdf8' },
        { name: 'Среднее', range: '4-5', value: playersMoodStats.filter((p: any) => (p.mood >= 4 && p.mood < 6) || (p.value >= 4 && p.value < 6)).length || 4, color: '#f59e0b' },
        { name: 'Плохое', range: '1-3', value: playersMoodStats.filter((p: any) => (p.mood >= 1 && p.mood < 4) || (p.value >= 1 && p.value < 4)).length || 2, color: '#f43f5e' }
      ]
    : [
        { name: 'Отличное', range: '8-10', value: moodEntries.filter(e => e.mood >= 8 || e.value >= 8).length || 0, color: '#22c55e' },
        { name: 'Хорошее', range: '6-7', value: moodEntries.filter(e => (e.mood >= 6 && e.mood < 8) || (e.value >= 6 && e.value < 8)).length || 0, color: '#38bdf8' },
        { name: 'Среднее', range: '4-5', value: moodEntries.filter(e => (e.mood >= 4 && e.mood < 6) || (e.value >= 4 && e.value < 6)).length || 0, color: '#f59e0b' },
        { name: 'Плохое', range: '1-3', value: moodEntries.filter(e => (e.mood >= 1 && e.mood < 4) || (e.value >= 1 && e.value < 4)).length || 0, color: '#f43f5e' }
      ];
  const moodDistributionTotal = moodDistributionData.reduce((sum, item) => sum + item.value, 0);
  const dominantMoodBucket = moodDistributionData.reduce((top, item) => (item.value > top.value ? item : top), moodDistributionData[0]);

  const energyDistributionData = [
    { day: 'Пн', энергия: isStaff ? (Math.random() * 3 + 6) : calcDayAvgEnergy(moodEntries, 1) },
    { day: 'Вт', энергия: isStaff ? (Math.random() * 3 + 6) : calcDayAvgEnergy(moodEntries, 2) },
    { day: 'Ср', энергия: isStaff ? (Math.random() * 3 + 5) : calcDayAvgEnergy(moodEntries, 3) },
    { day: 'Чт', энергия: isStaff ? (Math.random() * 3 + 5) : calcDayAvgEnergy(moodEntries, 4) },
    { day: 'Пт', энергия: isStaff ? (Math.random() * 3 + 4) : calcDayAvgEnergy(moodEntries, 5) },
    { day: 'Сб', энергия: isStaff ? (Math.random() * 3 + 7) : calcDayAvgEnergy(moodEntries, 6) },
    { day: 'Вс', энергия: isStaff ? (Math.random() * 3 + 7) : calcDayAvgEnergy(moodEntries, 0) }
  ];
  const nonZeroEnergyDays = energyDistributionData.filter((item) => item.энергия > 0);
  const averageEnergyLevel = nonZeroEnergyDays.length
    ? (nonZeroEnergyDays.reduce((sum, item) => sum + item.энергия, 0) / nonZeroEnergyDays.length).toFixed(1)
    : "0.0";
  const peakEnergyDay = nonZeroEnergyDays.length
    ? nonZeroEnergyDays.reduce((peak, item) => (item.энергия > peak.энергия ? item : peak), nonZeroEnergyDays[0])
    : null;
  const testsDone = Boolean(user?.completedTests || testEntries.length > 0);

  const handleBaselineCompleted = async (assessment?: BaselineAssessment | null) => {
    setBaselineAssessment(assessment || null);
    setPlayerTab("overview");
    sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
    setShowBaselineRegistrationModal(false);
    await refreshUser();
  };

  const handleSkipBaselineRegistrationModal = () => {
    sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
    setShowBaselineRegistrationModal(false);
    setPlayerTab("quick-start");
  };

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

      {!isStaff && (
        <Dialog
          open={showBaselineRegistrationModal}
          onOpenChange={(open) => {
            if (!open) {
              handleSkipBaselineRegistrationModal();
            }
          }}
        >
          <DialogContent
            className="max-h-[92vh] max-w-[1080px] overflow-y-auto border p-0"
            style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}
          >
            <DialogHeader className="border-b px-6 pb-4 pt-6" style={{ borderColor: COLORS.borderColor }}>
              <DialogTitle style={{ color: COLORS.textColor }}>
                Добро пожаловать. Давайте сразу соберём ваш стартовый профиль.
              </DialogTitle>
              <DialogDescription style={{ color: COLORS.textColorSecondary }}>
                Это базовое анкетирование показывается сразу после регистрации поверх интерфейса. Если сейчас не время, можно скипнуть и пройти его позже во вкладке «Быстрый старт».
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-6">
              <BaselineAssessmentCard
                initialAssessment={baselineAssessment}
                onCompleted={handleBaselineCompleted}
              />
            </div>
            <div className="flex justify-end border-t px-6 py-4" style={{ borderColor: COLORS.borderColor }}>
              <Button
                variant="outline"
                className="rounded-2xl"
                style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}
                onClick={handleSkipBaselineRegistrationModal}
              >
                Скип, пройти позже
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Tabs
        value={isStaff ? "overview" : playerTab}
        onValueChange={(value) => {
          if (!isStaff) {
            setPlayerTab(value);
          }
        }}
        className="space-y-4"
        style={{ color: COLORS.textColor }}
      >
        <TabsList
          className={`grid w-full p-1 ${isStaff ? "grid-cols-1 max-w-[220px]" : "grid-cols-4"}`}
          style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
        >
          <TabsTrigger 
            value="overview" 
            className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-800"
          >
            Обзор
          </TabsTrigger>
          {!isStaff && (
            <>
              <TabsTrigger
                value="quick-start"
                className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-800"
              >
                Быстрый старт
              </TabsTrigger>
              <TabsTrigger
                value="sleep"
                className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-800"
              >
                Сон
              </TabsTrigger>
              <TabsTrigger
                value="tests"
                className="text-sm px-4 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-800"
              >
                Тесты
              </TabsTrigger>
            </>
          )}
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

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium" style={{ color: COLORS.textColorSecondary }}>
                    Brain Lab
                  </CardTitle>
                  <Brain className="h-4 w-4" style={{ color: COLORS.primary }} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: COLORS.textColor }}>
                    {brainSummary?.brainPerformanceIndex != null ? brainSummary.brainPerformanceIndex.toFixed(1) : "Калибровка"}
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    {brainSummary
                      ? `${brainSummary.confidence} confidence · батарей ${brainSummary.validBatteryCount}`
                      : "Запустите Brain Lab на вкладке тестов"}
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
            <Card
              className="overflow-hidden"
              style={{
                background: "linear-gradient(155deg, rgba(26,32,44,1) 0%, rgba(21,31,51,1) 55%, rgba(15,34,63,0.96) 100%)",
                borderColor: COLORS.borderColor,
                boxShadow: "0 22px 40px -28px rgba(0,0,0,0.65)"
              }}
            >
              <CardHeader className="border-b border-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle style={{ color: COLORS.textColor }}>Распределение настроения</CardTitle>
                    <CardDescription style={{ color: COLORS.textColorSecondary }}>
                      {isStaff ? "Распределение настроения среди игроков" : "Ваше настроение по категориям"}
                    </CardDescription>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-[0.14em] uppercase text-slate-300">
                    <PieChartIcon className="mr-2 inline h-3.5 w-3.5 text-cyan-300" />
                    {moodDistributionTotal} записей
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <defs>
                        <linearGradient id="moodGlow" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#1f3b63" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <circle cx="50%" cy="50%" r="84" fill="url(#moodGlow)" />
                      <Pie
                        data={moodDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={104}
                        paddingAngle={3}
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth={2}
                        dataKey="value"
                        label={false}
                        labelLine={false}
                      >
                        {moodDistributionData.map((entry, index) => (
                          <Cell key={`mood-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <text x="50%" y="46%" textAnchor="middle" fill="#E5EEF9" fontSize="13" letterSpacing="1.8">
                        ДОМИНАНТА
                      </text>
                      <text x="50%" y="55%" textAnchor="middle" fill={dominantMoodBucket.color} fontSize="24" fontWeight="700">
                        {dominantMoodBucket.name}
                      </text>
                      <text x="50%" y="64%" textAnchor="middle" fill="#8FA3BF" fontSize="13">
                        {moodDistributionTotal ? `${Math.round((dominantMoodBucket.value / moodDistributionTotal) * 100)}% выборки` : "Пока нет данных"}
                      </text>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-3">
                    {moodDistributionData.map((item) => {
                      const share = moodDistributionTotal ? Math.round((item.value / moodDistributionTotal) * 100) : 0;
                      return (
                        <div
                          key={item.name}
                          className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: item.color, boxShadow: `0 0 18px ${item.color}55` }}
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.range}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-white">{share}%</p>
                              <p className="text-xs text-slate-400">{item.value} записей</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Гистограмма распределения энергии */}
            <Card
              className="overflow-hidden"
              style={{
                background: "linear-gradient(155deg, rgba(26,32,44,1) 0%, rgba(22,30,47,1) 55%, rgba(43,27,5,0.18) 100%)",
                borderColor: COLORS.borderColor,
                boxShadow: "0 22px 40px -28px rgba(0,0,0,0.65)"
              }}
            >
              <CardHeader className="border-b border-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle style={{ color: COLORS.textColor }}>Распределение энергии</CardTitle>
                    <CardDescription style={{ color: COLORS.textColorSecondary }}>
                      {isStaff ? "Уровни энергии по дням недели" : "Ваша энергия по дням недели"}
                    </CardDescription>
                  </div>
                  <div className="rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 text-xs font-medium tracking-[0.14em] uppercase text-amber-100">
                    <Zap className="mr-2 inline h-3.5 w-3.5" />
                    Среднее {averageEnergyLevel}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Пиковый день</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {peakEnergyDay ? peakEnergyDay.day : "Нет данных"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Пиковое значение</p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {peakEnergyDay ? peakEnergyDay.энергия.toFixed(1) : "0.0"}
                    </p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={energyDistributionData}
                    margin={{
                      top: 5,
                      right: 12,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient id="energyBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...chartGridProps} vertical={false} />
                    <XAxis dataKey="day" {...chartAxisProps} />
                    <YAxis {...chartAxisProps} domain={[0, 10]} tickCount={6} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Bar dataKey="энергия" fill="url(#energyBarGradient)" radius={[12, 12, 4, 4]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {!isStaff && (
          <TabsContent value="quick-start" className="space-y-4">
            <SubscriptionFeatureGate
              hasAccess={hasPerformanceCoachCrmAccess}
              title="Быстрый старт входит в PerformanceCoach CRM"
              description="Здесь собран onboarding игрока: базовая оценка, ежедневный recovery-check и переходы в тестовый контур. Раздел станет активным после покупки тарифа."
              minHeightClassName="min-h-[440px]"
            >
              <PlayerQuickStartPanel
                baselineAssessmentCompleted={Boolean(user?.baselineAssessmentCompleted)}
                baselineAssessment={baselineAssessment}
                sleepDoneToday={dailyCheckDone}
                testsDone={testsDone}
                onOpenSleepTab={() => setPlayerTab("sleep")}
                onOpenTests={() => navigate(`${ROUTES.TEST_TRACKER}?tab=brain`)}
                onBaselineCompleted={handleBaselineCompleted}
              />
            </SubscriptionFeatureGate>
          </TabsContent>
        )}

        {!isStaff && (
          <TabsContent value="sleep" className="space-y-4">
            <SubscriptionFeatureGate
              hasAccess={hasPerformanceCoachCrmAccess}
              title="Recovery Check входит в PerformanceCoach CRM"
              description="В этом разделе игрок каждый день фиксирует сон, экранное время и восстановление. После покупки тарифа блок станет доступен прямо внутри дашборда."
              minHeightClassName="min-h-[420px]"
            >
              <DailyQuestionnairePanel
                eyebrow="Recovery check"
                title="Сон и восстановление на сегодня"
                description="Сразу фиксируйте сон и экранное время: это самый быстрый ежедневный контур, который нужен игроку после захода."
                onSaved={async () => {
                  setDailyCheckDone(true);
                }}
              />
            </SubscriptionFeatureGate>
          </TabsContent>
        )}

        {!isStaff && (
          <TabsContent value="tests" className="space-y-4">
            <SubscriptionFeatureGate
              hasAccess={hasPerformanceCoachCrmAccess}
              title="Тестовый контур доступен после покупки"
              description="Здесь открываются переходы в Brain Lab, weekly-тесты и ежедневный self-check. Вкладка видна сразу, а рабочее содержимое включается после покупки PerformanceCoach CRM."
              minHeightClassName="min-h-[420px]"
            >
              <PlayerTestsPanel
                onOpenBrainLab={() => navigate(`${ROUTES.TEST_TRACKER}?tab=brain`)}
                onOpenWeeklyTests={() => navigate(`${ROUTES.TEST_TRACKER}?tab=weekly`)}
              />
            </SubscriptionFeatureGate>
          </TabsContent>
        )}
        
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
