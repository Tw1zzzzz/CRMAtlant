import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Link as LinkIcon, Calendar as CalendarIcon, Image, ExternalLink, Edit, Trash2, Sparkles, ClipboardList, Clock3, Monitor, Brain, Gauge, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TestEntry } from "@/types";
import { testRepository } from "@/lib/dataRepository";
import { createTestEntry, deleteTestEntry, getMyTestEntries, getTestsStateImpact } from "@/lib/api";
import { formatDate, getCurrentWeekRange, getWeekLabel, getPrevWeek, getNextWeek } from "@/utils/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { COLORS } from "@/styles/theme";
import { getReadableTestTypeLabel } from "@/utils/testTypeMetadata";
import axios from "axios";
import BrainLabPanel from "@/components/brain-lab/BrainLabPanel";

const predefinedTests = [
  {
    name: "Межличностные отношения",
    link: "https://psytests.org/classic/leary.html",
    isWeeklyTest: false
  }
];

type StateImpactSummary = {
  totals: {
    entries: number;
    scoredEntries: number;
    avgScore: number;
    avgStateIndex: number;
  };
  stateToResult: {
    fatigue: { low: number; mid: number; high: number };
    focus: { low: number; mid: number; high: number };
    stress: { low: number; mid: number; high: number };
  };
};

const TestTracker = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [name, setName] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isWeeklyTest, setIsWeeklyTest] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingTest, setEditingTest] = useState<TestEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"weekly" | "questionnaire">("questionnaire");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // РћРїСЂРѕСЃРЅРёРє (РЅРѕРІР°СЏ Р»РѕРіРёРєР° С‚Рµстов)
  const [qDate, setQDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [qSleepStart, setQSleepStart] = useState<string>("");
  const [qSleepEnd, setQSleepEnd] = useState<string>("");
  const [qSleep, setQSleep] = useState<string>("");
  const [qScreen, setQScreen] = useState<string>("");
  const [qScreenEntertainment, setQScreenEntertainment] = useState<string>("");
  const [qScreenCommunication, setQScreenCommunication] = useState<string>("");
  const [qScreenBrowser, setQScreenBrowser] = useState<string>("");
  const [qScreenStudy, setQScreenStudy] = useState<string>("");
  const [qSubmitting, setQSubmitting] = useState<boolean>(false);
  const [testType, setTestType] = useState<string>("generic");
  const [rawScore, setRawScore] = useState<string>("");
  const [scoreNormalized, setScoreNormalized] = useState<string>("");
  const [unit, setUnit] = useState<string>("%");
  const [durationSec, setDurationSec] = useState<string>("");
  const [attempts, setAttempts] = useState<string>("1");
  const [fatigue, setFatigue] = useState<string>("");
  const [focus, setFocus] = useState<string>("");
  const [stress, setStress] = useState<string>("");
  const [sleepHours, setSleepHours] = useState<string>("");
  const [snapshotMood, setSnapshotMood] = useState<string>("");
  const [snapshotEnergy, setSnapshotEnergy] = useState<string>("");
  const [matchType, setMatchType] = useState<string>("");
  const [contextMap, setContextMap] = useState<string>("");
  const [contextRole, setContextRole] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [testTypeFilter, setTestTypeFilter] = useState<string>("all");
  const [contextRoleFilter, setContextRoleFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [stateImpact, setStateImpact] = useState<StateImpactSummary | null>(null);
  
  const isStaff = user?.role === "staff";

  const parseOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseTimeToMinutes = (value: string) => {
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  };

  const getSleepHoursByRange = (from: string, to: string) => {
    const fromMinutes = parseTimeToMinutes(from);
    const toMinutes = parseTimeToMinutes(to);
    if (fromMinutes === null || toMinutes === null) return undefined;
    const diffMinutes = toMinutes >= fromMinutes
      ? toMinutes - fromMinutes
      : (24 * 60 - fromMinutes) + toMinutes;
    return Number((diffMinutes / 60).toFixed(2));
  };

  useEffect(() => {
    if (!qSleepStart || !qSleepEnd) return;
    const hours = getSleepHoursByRange(qSleepStart, qSleepEnd);
    if (hours === undefined) return;
    setQSleep(String(hours));
  }, [qSleepStart, qSleepEnd]);

  const submitQuestionnaire = async () => {
    try {
      setQSubmitting(true);
      const token = localStorage.getItem("token");
      const sleepByRange = qSleepStart && qSleepEnd ? getSleepHoursByRange(qSleepStart, qSleepEnd) : undefined;
      const sleepHours = parseOptionalNumber(qSleep) ?? sleepByRange;

      if ((qSleepStart && !qSleepEnd) || (!qSleepStart && qSleepEnd)) {
        toast({
          title: "Проверьте сон",
          description: "Заполните оба поля времени сна: и 'с', и 'до'.",
          variant: "destructive"
        });
        return;
      }

      const entertainment = parseOptionalNumber(qScreenEntertainment);
      const communication = parseOptionalNumber(qScreenCommunication);
      const browser = parseOptionalNumber(qScreenBrowser);
      const study = parseOptionalNumber(qScreenStudy);
      const hasBreakdown = [entertainment, communication, browser, study].some((v) => v !== undefined);
      const breakdownSum = (entertainment || 0) + (communication || 0) + (browser || 0) + (study || 0);
      const totalScreenTime = parseOptionalNumber(qScreen) ?? (hasBreakdown ? Number(breakdownSum.toFixed(2)) : undefined);

      if (totalScreenTime !== undefined && hasBreakdown && breakdownSum > totalScreenTime) {
        toast({
          title: "Ошибка экранного времени",
          description: `Сумма подкатегорий (${breakdownSum.toFixed(1)} ч) превышает общее экранное время (${totalScreenTime.toFixed(1)} ч).`,
          variant: "destructive"
        });
        return;
      }

      await axios.post(
        "/api/questionnaires/daily",
        {
          date: qDate,
          sleepHours,
          sleepStartTime: qSleepStart || undefined,
          sleepEndTime: qSleepEnd || undefined,
          screenTimeHours: totalScreenTime,
          screenBreakdown: hasBreakdown
            ? {
                entertainment,
                communication,
                browser,
                study
              }
            : undefined
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      toast({ title: "Сохранено", description: "Данные опросника сохранены" });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Ошибка сохранения";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setQSubmitting(false);
    }
  };
  
  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    const loadStateImpact = async () => {
      try {
        const now = new Date();
        const days = Number(periodFilter);
        const fromDate = new Date(now);
        fromDate.setDate(now.getDate() - days);

        const response = await getTestsStateImpact({
          from: fromDate.toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
          testType: testTypeFilter !== "all" ? testTypeFilter : undefined,
          role: contextRoleFilter !== "all" ? contextRoleFilter : undefined,
          source: sourceFilter !== "all" ? sourceFilter : undefined
        });

        setStateImpact(response.data);
      } catch (error) {
        console.error("Error loading tests state impact:", error);
        setStateImpact(null);
      }
    };

    if (user) {
      loadStateImpact();
    }
  }, [user, periodFilter, testTypeFilter, contextRoleFilter, sourceFilter]);
  
  const loadEntries = async () => {
    try {
      setIsLoading(true);
      
      if (user) {
        // Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ СЃ СЃРµСЂРІРµСЂР°
        try {
          const response = await getMyTestEntries();
          const serverEntries = response.data.map((entry: any) => ({
            ...entry,
            id: entry.id || entry._id,
            date: new Date(entry.date)
          }));
          setEntries(serverEntries);
          
          // РћР±РЅРѕРІР»СЏРµРј Р»РѕРєР°Р»СЊРЅРѕРµ С…СЂР°РЅРёР»РёС‰Рµ СЃ РґР°РЅРЅС‹РјРё СЃ СЃРµСЂРІРµСЂР°
          testRepository.updateFromServer(serverEntries);
          
          console.log('Test entries loaded from server');
        } catch (error) {
          console.error('Error loading test entries from server:', error);
          
          // Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃ СЃРµСЂРІРµСЂР°, РёСЃРїРѕР»СЊР·СѓРµРј Р»РѕРєР°Р»СЊРЅС‹Рµ РґР°РЅРЅС‹Рµ
          const localEntries = testRepository.getAll();
          setEntries(localEntries);
          
          toast({
            title: "Ошибка загрузки",
            description: "Не удалось загрузить записи с сервера, используются локальные данные.",
            variant: "destructive"
          });
        }
      } else {
        // Р•СЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ, РёСЃРїРѕР»СЊР·СѓРµРј Р»РѕРєР°Р»СЊРЅС‹Рµ РґР°РЅРЅС‹Рµ
        const localEntries = testRepository.getAll();
        setEntries(localEntries);
      }
    } catch (error) {
      console.error('Error loading test entries:', error);
      
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить записи о тестах.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setName("");
    setLink("");
    setScreenshotUrl("");
    setIsWeeklyTest(false);
    setEditingTest(null);
    setTestType("generic");
    setRawScore("");
    setScoreNormalized("");
    setUnit("%");
    setDurationSec("");
    setAttempts("1");
    setFatigue("");
    setFocus("");
    setStress("");
    setSleepHours("");
    setSnapshotMood("");
    setSnapshotEnergy("");
    setMatchType("");
    setContextMap("");
    setContextRole("");
  };
  
  const handlePrevWeek = () => {
    setCurrentWeek(getPrevWeek(currentWeek));
  };
  
  const handleNextWeek = () => {
    setCurrentWeek(getNextWeek(currentWeek));
  };
  
  const handleSubmit = async () => {
    if (!name && !testType) {
      toast({
        title: "Отсутствуют обязательные поля",
        description: "Заполните название теста или тип теста",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const newEntry: Omit<TestEntry, "id"> = {
        date: new Date(date),
        name,
        link,
        screenshotUrl: screenshotUrl || undefined,
        isWeeklyTest,
        testType,
        rawScore: rawScore ? Number(rawScore) : undefined,
        scoreNormalized: scoreNormalized ? Number(scoreNormalized) : undefined,
        unit: unit || undefined,
        durationSec: durationSec ? Number(durationSec) : undefined,
        attempts: attempts ? Number(attempts) : 1,
        stateSnapshot: {
          fatigue: fatigue ? Number(fatigue) : undefined,
          focus: focus ? Number(focus) : undefined,
          stress: stress ? Number(stress) : undefined,
          sleepHours: sleepHours ? Number(sleepHours) : undefined,
          mood: snapshotMood ? Number(snapshotMood) : undefined,
          energy: snapshotEnergy ? Number(snapshotEnergy) : undefined
        },
        context: {
          matchType: matchType || undefined,
          map: contextMap || undefined,
          role: contextRole || undefined
        },
        measuredAt: new Date(date).toISOString()
      };
      
      // РСЃРїРѕР»СЊР·СѓРµРј СЂРµРїРѕР·РёС‚РѕСЂРёР№ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РґР°РЅРЅС‹С…
      const savedEntry = testRepository.create(newEntry);
      
      // Р•СЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ, РїС‹С‚Р°РµРјСЃСЏ СЃСЂР°Р·Сѓ СЃРѕС…СЂР°РЅРёС‚СЊ РЅР° СЃРµСЂРІРµСЂРµ
      if (user) {
        try {
          const response = await createTestEntry(newEntry);
          console.log('Test entry saved to server:', response.data);
        } catch (error) {
          console.error('Error saving test entry to server (will be synced later):', error);
        }
      }
      
      // РћР±РЅРѕРІР»СЏРµРј СЃРїРёСЃРѕРє Р·Р°РїРёСЃРµР№
      await loadEntries();
      resetForm();
      
      toast({
        title: "Запись добавлена",
        description: "Запись о тесте успешно сохранена.",
      });
    } catch (error) {
      console.error('Error saving test entry:', error);
      
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить запись о тесте.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEdit = (test: TestEntry) => {
    setEditingTest(test);
    setName(test.name || "");
    setLink(test.link || "");
    setDate(test.date.toISOString().split('T')[0]);
    setIsWeeklyTest(test.isWeeklyTest);
    setTestType(test.testType || "generic");
    setRawScore(test.rawScore !== undefined ? String(test.rawScore) : "");
    setScoreNormalized(test.scoreNormalized !== undefined ? String(test.scoreNormalized) : "");
    setUnit(test.unit || "%");
    setDurationSec(test.durationSec !== undefined ? String(test.durationSec) : "");
    setAttempts(test.attempts !== undefined ? String(test.attempts) : "1");
    setFatigue(test.stateSnapshot?.fatigue !== undefined ? String(test.stateSnapshot.fatigue) : "");
    setFocus(test.stateSnapshot?.focus !== undefined ? String(test.stateSnapshot.focus) : "");
    setStress(test.stateSnapshot?.stress !== undefined ? String(test.stateSnapshot.stress) : "");
    setSleepHours(test.stateSnapshot?.sleepHours !== undefined ? String(test.stateSnapshot.sleepHours) : "");
    setSnapshotMood(test.stateSnapshot?.mood !== undefined ? String(test.stateSnapshot.mood) : "");
    setSnapshotEnergy(test.stateSnapshot?.energy !== undefined ? String(test.stateSnapshot.energy) : "");
    setMatchType(test.context?.matchType || "");
    setContextMap(test.context?.map || "");
    setContextRole(test.context?.role || "");
    setIsDialogOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    try {
      setIsLoading(true);

      if (user) {
        try {
          await deleteTestEntry(id);
        } catch (error) {
          console.error("Error deleting test entry on server:", error);
        }
      }
      
      // РЈРґР°Р»СЏРµРј Р·Р°РїРёСЃСЊ С‡РµСЂРµР· СЂРµРїРѕР·РёС‚РѕСЂРёР№
      testRepository.delete(id);
      
      // РћР±РЅРѕРІР»СЏРµРј СЃРїРёСЃРѕРє Р·Р°РїРёСЃРµР№
      await loadEntries();
      
      toast({
        title: "Запись удалена",
        description: "Запись о тесте успешно удалена."
      });
    } catch (error) {
      console.error('Error deleting test entry:', error);
    
    toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить запись о тесте.",
        variant: "destructive"
    });
    } finally {
      setIsLoading(false);
    }
  };
  
  const applyEntryFilters = (items: TestEntry[]) => {
    const days = Number(periodFilter);
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - days);

    return items.filter((test) => {
      const measuredAt = test.measuredAt ? new Date(test.measuredAt) : new Date(test.date);
      const inPeriod = measuredAt >= fromDate && measuredAt <= now;
      const byType = testTypeFilter === "all" || (test.testType || "generic") === testTypeFilter;
      const byRole = contextRoleFilter === "all" || test.context?.role === contextRoleFilter;
      const bySource = sourceFilter === "all" || (test.context?.source || "manual") === sourceFilter;
      return inPeriod && byType && byRole && bySource;
    });
  };

  const getWeekTests = () => {
    const { start, end } = getCurrentWeekRange(currentWeek);
    const weekEntries = entries.filter((test) => {
      const testDate = new Date(test.date);
      return testDate >= start && testDate <= end;
    });
    return applyEntryFilters(weekEntries);
  };
  
  const getWeeklyTests = () => {
    return getWeekTests().filter((test) => test.isWeeklyTest);
  };

  const filteredEntries = applyEntryFilters(entries);
  const weeklyTests = getWeeklyTests().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recommendedWeeklyTests = predefinedTests.filter((test) => test.isWeeklyTest);
  const recentTests = [...filteredEntries]
    .sort((a, b) => {
      const first = a.measuredAt ? new Date(a.measuredAt).getTime() : new Date(a.date).getTime();
      const second = b.measuredAt ? new Date(b.measuredAt).getTime() : new Date(b.date).getTime();
      return second - first;
    })
    .slice(0, 3);
  const scoredEntries = filteredEntries.filter((test) => typeof test.scoreNormalized === "number");
  const averageNormalizedScore = scoredEntries.length > 0
    ? Number((scoredEntries.reduce((sum, test) => sum + (test.scoreNormalized || 0), 0) / scoredEntries.length).toFixed(1))
    : null;
  const currentWeekTestsCount = getWeekTests().length;
  const questionnaireBreakdownSum = (parseFloat(qScreenEntertainment) || 0) +
    (parseFloat(qScreenCommunication) || 0) +
    (parseFloat(qScreenBrowser) || 0) +
    (parseFloat(qScreenStudy) || 0);
  const questionnaireTotalScreen = parseFloat(qScreen) || 0;
  const hasQuestionnaireTotal = qScreen.trim() !== "";
  const isQuestionnaireExceeded = hasQuestionnaireTotal && questionnaireBreakdownSum > questionnaireTotalScreen;
  const selectedDateLabel = formatDate(new Date(date), "d MMMM yyyy");
  const qDateLabel = formatDate(new Date(qDate), "d MMMM yyyy");
  const fieldStyle = {
    backgroundColor: "rgba(255,255,255,0.04)",
    color: COLORS.textColor,
    borderColor: "rgba(255,255,255,0.08)"
  };

  const getTestTypeLabel = (value?: string) => {
    return getReadableTestTypeLabel(value);
  };

  return (
    <div className="container mx-auto py-4">
      <div className="space-y-6">
        <section
          className="overflow-hidden rounded-[32px] border px-5 py-6 md:px-7"
          style={{
            background: "linear-gradient(135deg, rgba(53, 144, 255, 0.18), rgba(0, 227, 150, 0.1) 45%, rgba(17, 24, 39, 0.96))",
            borderColor: "rgba(96, 165, 250, 0.32)",
            boxShadow: "0 36px 100px -68px rgba(53, 144, 255, 0.95)"
          }}
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em]"
                style={{
                  backgroundColor: "rgba(11, 16, 32, 0.38)",
                  border: "1px solid rgba(125, 211, 252, 0.2)",
                  color: "#B6F0FF"
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Performance Lab
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold md:text-4xl" style={{ color: COLORS.textColor }}>
                  Тесты и ежедневный self-check в одном рабочем контуре
                </h1>
                <p className="max-w-2xl text-sm leading-7 md:text-base" style={{ color: "rgba(226, 232, 240, 0.82)" }}>
                  Здесь удобно вести результаты тестов, быстро возвращаться к еженедельным заданиям и фиксировать повседневный контекст, который потом влияет на аналитику.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:min-w-[420px]">
              <div className="rounded-[22px] border p-4" style={{ backgroundColor: "rgba(9, 14, 26, 0.34)", borderColor: "rgba(148, 163, 184, 0.18)" }}>
                <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(191, 219, 254, 0.78)" }}>Записей</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{filteredEntries.length}</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(226, 232, 240, 0.68)" }}>за выбранный период</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ backgroundColor: "rgba(9, 14, 26, 0.34)", borderColor: "rgba(148, 163, 184, 0.18)" }}>
                <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(191, 219, 254, 0.78)" }}>Средний score</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{averageNormalizedScore ?? "-"}</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(226, 232, 240, 0.68)" }}>по сохранённым результатам</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ backgroundColor: "rgba(9, 14, 26, 0.34)", borderColor: "rgba(148, 163, 184, 0.18)" }}>
                <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(191, 219, 254, 0.78)" }}>Эта неделя</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{currentWeekTestsCount}</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(226, 232, 240, 0.68)" }}>тестов в текущем окне</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ backgroundColor: "rgba(9, 14, 26, 0.34)", borderColor: "rgba(148, 163, 184, 0.18)" }}>
                <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "rgba(191, 219, 254, 0.78)" }}>State index</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{stateImpact?.totals.avgStateIndex ?? "-"}</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(226, 232, 240, 0.68)" }}>связь состояния и результата</div>
              </div>
            </div>
          </div>
        </section>

        {!isStaff && <BrainLabPanel />}

        <section
          className="rounded-[28px] border p-5 md:p-6"
          style={{
            background: "linear-gradient(160deg, rgba(26, 32, 44, 0.96), rgba(17, 24, 39, 0.96))",
            borderColor: "rgba(96, 165, 250, 0.16)"
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em]" style={{ color: COLORS.textColorSecondary }}>
                Аналитический фильтр
              </div>
              <p className="text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                Отсекайте период, типы тестов и игровой контекст, чтобы быстрее находить полезные паттерны.
              </p>
            </div>
            {!isStaff && (
              <Button
                onClick={() => {
                  resetForm();
                  setDate(new Date().toISOString().split("T")[0]);
                  setIsDialogOpen(true);
                }}
                className="h-12 rounded-2xl px-5"
                style={{ backgroundColor: COLORS.primary, color: "white" }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Добавить тест
              </Button>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label style={{ color: COLORS.textColor }}>Период</Label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3"
                style={fieldStyle}
              >
                <option value="7">7 дней</option>
                <option value="30">30 дней</option>
                <option value="90">90 дней</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: COLORS.textColor }}>Тип теста</Label>
              <select
                value={testTypeFilter}
                onChange={(e) => setTestTypeFilter(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3"
                style={fieldStyle}
              >
                <option value="all">Все типы</option>
                <option value="generic">{getTestTypeLabel("generic")}</option>
                <option value="reaction">{getTestTypeLabel("reaction")}</option>
                <option value="aim">{getTestTypeLabel("aim")}</option>
                <option value="cognitive">{getTestTypeLabel("cognitive")}</option>
                <option value="visual_search">{getTestTypeLabel("visual_search")}</option>
                <option value="go_no_go">{getTestTypeLabel("go_no_go")}</option>
                <option value="n_back_2">{getTestTypeLabel("n_back_2")}</option>
                <option value="stroop_switch">{getTestTypeLabel("stroop_switch")}</option>
                <option value="spatial_span">{getTestTypeLabel("spatial_span")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: COLORS.textColor }}>Контекст / роль</Label>
              <select
                value={contextRoleFilter}
                onChange={(e) => setContextRoleFilter(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3"
                style={fieldStyle}
              >
                <option value="all">Все роли</option>
                <option value="entry">Entry</option>
                <option value="support">Support</option>
                <option value="awp">AWP</option>
                <option value="igl">IGL</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label style={{ color: COLORS.textColor }}>Источник</Label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3"
                style={fieldStyle}
              >
                <option value="all">Все источники</option>
                <option value="manual">Ручной ввод</option>
                <option value="brain_lab">Brain Lab</option>
              </select>
            </div>
          </div>

          {stateImpact && (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>
                  <Gauge className="h-3.5 w-3.5" />
                  Средний score
                </div>
                <div className="mt-3 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{stateImpact.totals.avgScore}</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>
                  <Brain className="h-3.5 w-3.5" />
                  Индекс состояния
                </div>
                <div className="mt-3 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{stateImpact.totals.avgStateIndex}</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  Фокус high
                </div>
                <div className="mt-3 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{stateImpact.stateToResult.focus.high}</div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>
                  <Clock3 className="h-3.5 w-3.5" />
                  Усталость high
                </div>
                <div className="mt-3 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{stateImpact.stateToResult.fatigue.high}</div>
              </div>
            </div>
          )}
        </section>

        <Tabs
          defaultValue="questionnaire"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "weekly" | "questionnaire")}
          className="space-y-5"
        >
          <TabsList
            className="grid h-auto w-full grid-cols-2 rounded-[22px] border p-1.5 md:w-[420px]"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <TabsTrigger
              value="weekly"
              className="rounded-[16px] px-4 py-3 text-sm"
              style={{
                color: activeTab === "weekly" ? COLORS.textColor : COLORS.textColorSecondary,
                backgroundColor: activeTab === "weekly" ? "rgba(53, 144, 255, 0.18)" : "transparent"
              }}
            >
              Еженедельные тесты
            </TabsTrigger>
            <TabsTrigger
              value="questionnaire"
              className="rounded-[16px] px-4 py-3 text-sm"
              style={{
                color: activeTab === "questionnaire" ? COLORS.textColor : COLORS.textColorSecondary,
                backgroundColor: activeTab === "questionnaire" ? "rgba(0, 227, 150, 0.14)" : "transparent"
              }}
            >
              Ежедневный опросник
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <section
                className="rounded-[28px] border p-5 md:p-6"
                style={{
                  background: "linear-gradient(150deg, rgba(53, 144, 255, 0.12), rgba(26, 32, 44, 0.95) 65%)",
                  borderColor: "rgba(96, 165, 250, 0.2)"
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: COLORS.textColorSecondary }}>
                      <ClipboardList className="h-3.5 w-3.5" />
                      Рабочая неделя
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold" style={{ color: COLORS.textColor }}>
                      Планируйте обязательные тесты без лишнего трения
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
                      В одном месте видны рекомендованные задания, текущая неделя и уже внесённые результаты. Это уменьшает шанс забыть weekly-check.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full px-2 py-1.5" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <Button variant="outline" size="sm" onClick={handlePrevWeek} className="rounded-full" style={{ borderColor: COLORS.borderColor, color: COLORS.primary, backgroundColor: "transparent" }}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Назад
                    </Button>
                    <span className="px-2 text-sm font-medium" style={{ color: COLORS.textColor }}>{getWeekLabel(currentWeek)}</span>
                    <Button variant="outline" size="sm" onClick={handleNextWeek} className="rounded-full" style={{ borderColor: COLORS.borderColor, color: COLORS.primary, backgroundColor: "transparent" }}>
                      Вперёд
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: COLORS.textColorSecondary }}>В этой неделе</div>
                    <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{currentWeekTestsCount}</div>
                    <div className="mt-1 text-sm" style={{ color: COLORS.textColorSecondary }}>всего тестовых записей</div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: COLORS.textColorSecondary }}>Weekly</div>
                    <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.textColor }}>{weeklyTests.length}</div>
                    <div className="mt-1 text-sm" style={{ color: COLORS.textColorSecondary }}>результатов за неделю</div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: COLORS.textColorSecondary }}>Последний ввод</div>
                    <div className="mt-2 text-base font-semibold" style={{ color: COLORS.textColor }}>
                      {recentTests[0] ? formatDate(recentTests[0].date, "d MMMM") : "-"}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: COLORS.textColorSecondary }}>самая свежая запись</div>
                  </div>
                </div>
              </section>

              <section
                className="rounded-[28px] border p-5 md:p-6"
                style={{
                  background: "linear-gradient(150deg, rgba(0, 227, 150, 0.1), rgba(17, 24, 39, 0.95) 68%)",
                  borderColor: "rgba(52, 211, 153, 0.2)"
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(0, 227, 150, 0.12)", borderColor: "rgba(0, 227, 150, 0.26)", color: "#7EF3D1" }}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: COLORS.textColorSecondary }}>Рекомендуемые weekly</div>
                    <h3 className="mt-1 text-xl font-semibold" style={{ color: COLORS.textColor }}>Быстрый доступ к заданиям</h3>
                  </div>
                </div>

                {recommendedWeeklyTests.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {recommendedWeeklyTests.map((test, index) => (
                      <div key={`weekly-card-${index}`} className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-lg font-semibold" style={{ color: COLORS.textColor }}>{test.name}</div>
                            <div className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                              Откройте тест и сразу занесите результат в систему, чтобы weekly-ритм не терялся.
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <a href={test.link} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" className="rounded-2xl" style={{ border: `1px solid ${COLORS.borderColor}`, color: COLORS.primary, backgroundColor: "rgba(255,255,255,0.03)" }}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Открыть
                              </Button>
                            </a>
                            {!isStaff && (
                              <Button
                                className="rounded-2xl"
                                style={{ backgroundColor: COLORS.primary, color: "white" }}
                                onClick={() => {
                                  setName(test.name);
                                  setLink(test.link);
                                  setIsWeeklyTest(true);
                                  setDate(new Date().toISOString().split("T")[0]);
                                  setIsDialogOpen(true);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Результат
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-dashed p-5" style={{ borderColor: "rgba(0, 227, 150, 0.22)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <p className="text-sm font-medium" style={{ color: COLORS.textColor }}>Список weekly-тестов пока не заполнен</p>
                    <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                      Пока можно заносить собственные еженедельные тесты вручную, а позже мы сможем оформить отдельный curated-набор.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {weeklyTests.length === 0 ? (
              <section
                className="rounded-[28px] border p-8 text-center"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: COLORS.borderColor }}
              >
                <ClipboardList className="mx-auto h-12 w-12" style={{ color: COLORS.primary }} />
                <h3 className="mt-4 text-xl font-semibold" style={{ color: COLORS.textColor }}>На эту неделю пока нет записанных weekly-тестов</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
                  Когда появятся первые результаты, они будут собраны здесь в более удобном карточном виде, а не в тяжёлой таблице.
                </p>
                {!isStaff && (
                  <Button
                    className="mt-5 rounded-2xl"
                    style={{ backgroundColor: COLORS.primary, color: "white" }}
                    onClick={() => {
                      resetForm();
                      setIsWeeklyTest(true);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить weekly-тест
                  </Button>
                )}
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {weeklyTests.map((test) => (
                  <article
                    key={test.id}
                    className="rounded-[26px] border p-5"
                    style={{
                      background: "linear-gradient(155deg, rgba(53, 144, 255, 0.1), rgba(17, 24, 39, 0.96) 70%)",
                      borderColor: "rgba(96, 165, 250, 0.18)"
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: COLORS.textColorSecondary }}>
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {formatDate(test.date, "d MMMM")}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold" style={{ color: COLORS.textColor }}>{test.name || "Без названия"}</h3>
                      </div>
                      <div className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "rgba(0, 227, 150, 0.14)", color: "#7EF3D1" }}>
                        {getTestTypeLabel(test.testType)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>Score</div>
                        <div className="mt-1 text-xl font-semibold" style={{ color: COLORS.textColor }}>
                          {typeof test.scoreNormalized === "number" ? `${test.scoreNormalized}${test.unit || "%"}` : "-"}
                        </div>
                      </div>
                      <div className="rounded-[18px] border px-4 py-3" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>Попыток</div>
                        <div className="mt-1 text-xl font-semibold" style={{ color: COLORS.textColor }}>{test.attempts || 1}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm" style={{ color: COLORS.textColorSecondary }}>
                      {test.durationSec && (
                        <span className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          {Math.round(test.durationSec / 60)} мин
                        </span>
                      )}
                      {test.context?.role && (
                        <span className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          {test.context.role}
                        </span>
                      )}
                      {test.context?.map && (
                        <span className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                          {test.context.map}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {test.link && (
                          <a href={test.link} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="rounded-2xl" style={{ color: COLORS.primary, border: `1px solid ${COLORS.borderColor}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {test.screenshotUrl && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-2xl" style={{ color: COLORS.primary, border: `1px solid ${COLORS.borderColor}`, backgroundColor: "rgba(255,255,255,0.03)" }}>
                                <Image className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                              <DialogHeader>
                                <DialogTitle style={{ color: COLORS.textColor }}>Скриншот теста: {test.name}</DialogTitle>
                              </DialogHeader>
                              <img src={test.screenshotUrl} alt={test.name} className="w-full rounded-md" />
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {!isStaff && (
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="rounded-2xl" style={{ color: COLORS.primary, border: `1px solid ${COLORS.borderColor}`, backgroundColor: "rgba(255,255,255,0.03)" }} onClick={() => handleEdit(test)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="rounded-2xl" style={{ color: COLORS.danger, border: `1px solid ${COLORS.borderColor}`, backgroundColor: "rgba(255,255,255,0.03)" }} onClick={() => handleDelete(test.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            )}
          </TabsContent>

          <TabsContent value="questionnaire" className="space-y-5">
            <section
              className="rounded-[28px] border p-5 md:p-6"
              style={{
                background: "linear-gradient(150deg, rgba(0, 227, 150, 0.1), rgba(17, 24, 39, 0.96) 68%)",
                borderColor: "rgba(16, 185, 129, 0.2)"
              }}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: COLORS.textColorSecondary }}>
                    <Brain className="h-3.5 w-3.5" />
                    Daily self-check
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold" style={{ color: COLORS.textColor }}>
                      Ежедневный опросник без ощущения тяжёлой формы
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
                      Разбил ввод на понятные блоки: сон, экранное время и итоговый контроль суммы. Так заполнять быстрее, а проверять себя проще.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
                  <div className="rounded-[20px] border px-4 py-3" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>Дата</div>
                    <div className="mt-1 text-base font-semibold" style={{ color: COLORS.textColor }}>{qDateLabel}</div>
                  </div>
                  <div className="rounded-[20px] border px-4 py-3" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>Сон</div>
                    <div className="mt-1 text-base font-semibold" style={{ color: COLORS.textColor }}>{qSleep || "-"}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="space-y-5">
                <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(53, 144, 255, 0.12)", borderColor: "rgba(53, 144, 255, 0.26)", color: COLORS.primary }}>
                        <Clock3 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle style={{ color: COLORS.textColor }}>Сон и восстановление</CardTitle>
                        <CardDescription style={{ color: COLORS.textColorSecondary }}>
                          Заполните диапазон сна или скорректируйте часы вручную.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label style={{ color: COLORS.textColor }}>Дата</Label>
                      <Input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон: с</Label>
                        <Input type="time" value={qSleepStart} onChange={(e) => setQSleepStart(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон: до</Label>
                        <Input type="time" value={qSleepEnd} onChange={(e) => setQSleepEnd(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      </div>
                    </div>
                    <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                      <Label style={{ color: COLORS.textColor }}>Сон (часы, авто или вручную)</Label>
                      <Input
                        value={qSleep}
                        onChange={(e) => setQSleep(e.target.value)}
                        inputMode="decimal"
                        placeholder="Например: 7.5"
                        className="mt-3 rounded-2xl"
                        style={fieldStyle}
                      />
                      <p className="mt-3 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                        Если вы задали время сна `с` и `до`, система уже подсказывает продолжительность. Поле можно оставить как есть или скорректировать вручную.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(0, 227, 150, 0.12)", borderColor: "rgba(0, 227, 150, 0.26)", color: "#7EF3D1" }}>
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle style={{ color: COLORS.textColor }}>Экранное время</CardTitle>
                        <CardDescription style={{ color: COLORS.textColorSecondary }}>
                          Общее время и аккуратная детализация по категориям.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label style={{ color: COLORS.textColor }}>Общее экранное время</Label>
                      <Input
                        value={qScreen}
                        onChange={(e) => setQScreen(e.target.value)}
                        inputMode="decimal"
                        placeholder="Можно оставить пустым, если заполнена детализация"
                        className="rounded-2xl"
                        style={fieldStyle}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input value={qScreenEntertainment} onChange={(e) => setQScreenEntertainment(e.target.value)} inputMode="decimal" placeholder="Развлечения" className="rounded-2xl" style={fieldStyle} />
                      <Input value={qScreenCommunication} onChange={(e) => setQScreenCommunication(e.target.value)} inputMode="decimal" placeholder="Общение" className="rounded-2xl" style={fieldStyle} />
                      <Input value={qScreenBrowser} onChange={(e) => setQScreenBrowser(e.target.value)} inputMode="decimal" placeholder="Браузер" className="rounded-2xl" style={fieldStyle} />
                      <Input value={qScreenStudy} onChange={(e) => setQScreenStudy(e.target.value)} inputMode="decimal" placeholder="Учёба / работа" className="rounded-2xl" style={fieldStyle} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)" }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(164, 108, 255, 0.12)", borderColor: "rgba(164, 108, 255, 0.26)", color: "#C4A5FF" }}>
                      <Gauge className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle style={{ color: COLORS.textColor }}>Контроль заполнения</CardTitle>
                      <CardDescription style={{ color: COLORS.textColorSecondary }}>
                        Перед сохранением сразу видно итог по категориям и возможные ошибки.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>Сумма подкатегорий</div>
                    <div className="mt-2 text-3xl font-semibold" style={{ color: COLORS.textColor }}>
                      {questionnaireBreakdownSum > 0 ? `${questionnaireBreakdownSum.toFixed(1)} ч` : "-"}
                    </div>
                    <div className="mt-2 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                      {hasQuestionnaireTotal
                        ? `Общее время задано: ${questionnaireTotalScreen.toFixed(1)} ч`
                        : "Можно не задавать общее время, если заполнена детализация по категориям."}
                    </div>
                  </div>

                  <div
                    className="rounded-[22px] border p-4"
                    style={{
                      borderColor: isQuestionnaireExceeded ? "rgba(255, 69, 96, 0.3)" : "rgba(0, 227, 150, 0.24)",
                      backgroundColor: isQuestionnaireExceeded ? "rgba(255, 69, 96, 0.1)" : "rgba(0, 227, 150, 0.08)"
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: COLORS.textColor }}>
                      {questionnaireBreakdownSum === 0
                        ? "Заполните хотя бы одну категорию или общее экранное время"
                        : isQuestionnaireExceeded
                          ? "Сумма подкатегорий превышает общее экранное время"
                          : "Данные выглядят согласованно"}
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                      {questionnaireBreakdownSum === 0
                        ? "Как только появятся данные, этот блок сразу покажет, всё ли логично сходится."
                        : hasQuestionnaireTotal
                          ? `${questionnaireBreakdownSum.toFixed(1)} ч из ${questionnaireTotalScreen.toFixed(1)} ч общего времени`
                          : "Система будет использовать сумму категорий как итоговое экранное время."}
                    </p>
                  </div>

                  <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>
                      <ClipboardList className="h-3.5 w-3.5" />
                      Что мы сохраняем
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                      <li>Дата среза: {qDateLabel}</li>
                      <li>Сон: {qSleep || "не указан"}</li>
                      <li>Экранное время: {qScreen || (questionnaireBreakdownSum > 0 ? `${questionnaireBreakdownSum.toFixed(1)} ч по детализации` : "не указано")}</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button onClick={submitQuestionnaire} disabled={qSubmitting || isQuestionnaireExceeded} className="h-12 w-full rounded-2xl" style={{ backgroundColor: COLORS.primary, color: "white" }}>
                    {qSubmitting ? "Сохранение..." : "Сохранить опросник"}
                  </Button>
                </CardFooter>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden border p-0 sm:max-w-[760px]"
          style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
        >
          <div
            className="absolute inset-x-0 top-0 h-40"
            style={{ background: "linear-gradient(180deg, rgba(53, 144, 255, 0.18), rgba(53, 144, 255, 0))" }}
          />
          <DialogHeader className="relative space-y-3 border-b px-6 pb-4 pt-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: COLORS.textColorSecondary }}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {selectedDateLabel}
            </div>
            <DialogTitle style={{ color: COLORS.textColor }}>
              {editingTest ? "Редактировать тест" : "Добавить тест"}
            </DialogTitle>
            <DialogDescription style={{ color: COLORS.textColorSecondary }}>
              {editingTest
                ? "Обновите результат, метрики и контекст, чтобы аналитика оставалась чистой."
                : "Соберите тест в одном месте: базовая информация, score, состояние и игровой контекст."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="space-y-5">
                  <div className="rounded-[24px] border p-5" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(53, 144, 255, 0.12)", borderColor: "rgba(53, 144, 255, 0.26)", color: COLORS.primary }}>
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold" style={{ color: COLORS.textColor }}>Базовая информация</div>
                        <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                          Что за тест, когда проходили и относится ли он к weekly-ритму.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" style={{ color: COLORS.textColor }}>Название теста</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="link" style={{ color: COLORS.textColor }}>Ссылка</Label>
                        <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="date" style={{ color: COLORS.textColor }}>Дата</Label>
                          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="testType" style={{ color: COLORS.textColor }}>Тип теста</Label>
                          <Input id="testType" value={testType} onChange={(e) => setTestType(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                        </div>
                      </div>
                      <div className="rounded-[20px] border px-4 py-3" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium" style={{ color: COLORS.textColor }}>Еженедельный тест</div>
                            <div className="mt-1 text-sm" style={{ color: COLORS.textColorSecondary }}>
                              {isWeeklyTest ? "Запись попадёт в weekly-контур." : "Запись останется обычным тестом."}
                            </div>
                          </div>
                          <Switch id="weekly-test" checked={isWeeklyTest} onCheckedChange={setIsWeeklyTest} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border p-5" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(0, 227, 150, 0.12)", borderColor: "rgba(0, 227, 150, 0.26)", color: "#7EF3D1" }}>
                        <Gauge className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold" style={{ color: COLORS.textColor }}>Результат теста</div>
                        <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                          Основные метрики, которые потом участвуют в сравнении и аналитике.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Input placeholder="Raw score" value={rawScore} onChange={(e) => setRawScore(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Score normalized (0-100)" value={scoreNormalized} onChange={(e) => setScoreNormalized(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Unit (%)" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Duration sec" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} inputMode="numeric" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Attempts" value={attempts} onChange={(e) => setAttempts(e.target.value)} inputMode="numeric" className="rounded-2xl md:col-span-2" style={fieldStyle} />
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[24px] border p-5" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(164, 108, 255, 0.12)", borderColor: "rgba(164, 108, 255, 0.26)", color: "#C4A5FF" }}>
                        <Brain className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold" style={{ color: COLORS.textColor }}>Срез состояния</div>
                        <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                          Что было с ресурсом и концентрацией в момент выполнения.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <Input placeholder="Fatigue (0-10)" value={fatigue} onChange={(e) => setFatigue(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Focus (0-10)" value={focus} onChange={(e) => setFocus(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Stress (0-10)" value={stress} onChange={(e) => setStress(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Sleep hours" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Mood (0-10)" value={snapshotMood} onChange={(e) => setSnapshotMood(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Energy (0-10)" value={snapshotEnergy} onChange={(e) => setSnapshotEnergy(e.target.value)} inputMode="decimal" className="rounded-2xl" style={fieldStyle} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border p-5" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ backgroundColor: "rgba(253, 186, 116, 0.12)", borderColor: "rgba(253, 186, 116, 0.26)", color: "#FDBA74" }}>
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold" style={{ color: COLORS.textColor }}>Игровой контекст</div>
                        <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textColorSecondary }}>
                          Если тест связан с конкретной ролью, картой или типом игры, лучше зафиксировать это сразу.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4">
                      <Input placeholder="Match type" value={matchType} onChange={(e) => setMatchType(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Map" value={contextMap} onChange={(e) => setContextMap(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                      <Input placeholder="Role" value={contextRole} onChange={(e) => setContextRole(e.target.value)} className="rounded-2xl" style={fieldStyle} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter
            className="border-t px-6 py-4"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "rgba(11, 16, 32, 0.72)",
              backdropFilter: "blur(16px)"
            }}
          >
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}
            >
              Отмена
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              className="rounded-2xl"
              style={{ backgroundColor: COLORS.primary, color: "white" }}
            >
              {editingTest ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestTracker;
