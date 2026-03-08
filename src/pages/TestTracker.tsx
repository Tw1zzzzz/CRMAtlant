import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Link as LinkIcon, Calendar as CalendarIcon, Image, ExternalLink, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TestEntry } from "@/types";
import { testRepository } from "@/lib/dataRepository";
import { createTestEntry, deleteTestEntry, getMyTestEntries, getTestsStateImpact } from "@/lib/api";
import { formatDate, getCurrentWeekRange, getWeekLabel, getPrevWeek, getNextWeek } from "@/utils/dateUtils";
import { fileToDataUrl, validateImageFile } from "@/utils/fileUtils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import axios from "axios";

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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"weekly" | "questionnaire">("questionnaire");
  const [isStaffView, setIsStaffView] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // РћРїСЂРѕСЃРЅРёРє (РЅРѕРІР°СЏ Р»РѕРіРёРєР° С‚Рµстов)
  const [qDate, setQDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [qMood, setQMood] = useState<string>("");
  const [qEnergy, setQEnergy] = useState<string>("");
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
  const [stateImpact, setStateImpact] = useState<StateImpactSummary | null>(null);
  
  const isStaff = user?.role === "staff";
  const canEdit = user?.role === "player";

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

      await axios.post(
        "/api/questionnaires/daily",
        {
          date: qDate,
          mood: parseOptionalNumber(qMood),
          energy: parseOptionalNumber(qEnergy),
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
          role: contextRoleFilter !== "all" ? contextRoleFilter : undefined
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
  }, [user, periodFilter, testTypeFilter, contextRoleFilter]);
  
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
      setIsAddingEntry(false);
      
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
      return inPeriod && byType && byRole;
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

  return (
    <div className="container mx-auto py-4 performance-page">
      <div className="flex flex-col space-y-6">
        <Card className="performance-hero" style={COMPONENT_STYLES.card}>
          <CardHeader>
            <span className="performance-eyebrow">Performance Lab</span>
            <CardTitle className="performance-title" style={COMPONENT_STYLES.text.title}>Тесты</CardTitle>
            <CardDescription className="performance-subtitle" style={COMPONENT_STYLES.text.description}>
              Управление результатами тестирования и опросов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="space-y-1">
                <Label style={{ color: COLORS.textColor }}>Период</Label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 bg-transparent performance-native-select"
                >
                  <option value="7">7 дней</option>
                  <option value="30">30 дней</option>
                  <option value="90">90 дней</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label style={{ color: COLORS.textColor }}>Тип теста</Label>
                <select
                  value={testTypeFilter}
                  onChange={(e) => setTestTypeFilter(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 bg-transparent performance-native-select"
                >
                  <option value="all">Все</option>
                  <option value="generic">Generic</option>
                  <option value="reaction">Reaction</option>
                  <option value="aim">Aim</option>
                  <option value="cognitive">Cognitive</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label style={{ color: COLORS.textColor }}>Контекст / роль</Label>
                <select
                  value={contextRoleFilter}
                  onChange={(e) => setContextRoleFilter(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 bg-transparent performance-native-select"
                >
                  <option value="all">Все</option>
                  <option value="entry">Entry</option>
                  <option value="support">Support</option>
                  <option value="awp">AWP</option>
                  <option value="igl">IGL</option>
                </select>
              </div>
            </div>

            {stateImpact && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <Card style={COMPONENT_STYLES.card}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Средний score</p>
                    <p className="text-2xl font-semibold">{stateImpact.totals.avgScore}</p>
                  </CardContent>
                </Card>
                <Card style={COMPONENT_STYLES.card}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Индекс состояния</p>
                    <p className="text-2xl font-semibold">{stateImpact.totals.avgStateIndex}</p>
                  </CardContent>
                </Card>
                <Card style={COMPONENT_STYLES.card}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Фокус (high)</p>
                    <p className="text-2xl font-semibold">{stateImpact.stateToResult.focus.high}</p>
                  </CardContent>
                </Card>
                <Card style={COMPONENT_STYLES.card}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Усталость (high)</p>
                    <p className="text-2xl font-semibold">{stateImpact.stateToResult.fatigue.high}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Tabs 
              defaultValue="questionnaire" 
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "weekly" | "questionnaire")}
            >
              <TabsList className="mb-4" style={COMPONENT_STYLES.tabs.list}>
                <TabsTrigger 
                  value="weekly"
                  style={{ 
                    color: activeTab === 'weekly' ? COLORS.textColor : COLORS.textColorSecondary, 
                    backgroundColor: activeTab === 'weekly' ? COLORS.primary : 'transparent'
                  }}
                >
                  Еженедельные тесты
                </TabsTrigger>
                <TabsTrigger 
                  value="questionnaire"
                  style={{ 
                    color: activeTab === 'questionnaire' ? COLORS.textColor : COLORS.textColorSecondary, 
                    backgroundColor: activeTab === 'questionnaire' ? COLORS.primary : 'transparent'
                  }}
                >
                  Опросник
                </TabsTrigger>
              </TabsList>
              <TabsContent value="weekly">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.textColor }}>Рекомендуемые еженедельные тесты</h3>
                  <Card style={COMPONENT_STYLES.card}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ borderColor: COLORS.borderColor }}>
                          <TableHead style={{ color: COLORS.textColor }}>Название теста</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Ссылка</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {predefinedTests.filter(test => test.isWeeklyTest).map((test, index) => (
                          <TableRow key={`weekly-${index}`} style={{ borderColor: COLORS.borderColor }}>
                            <TableCell className="font-medium" style={{ color: COLORS.textColor }}>{test.name}</TableCell>
                            <TableCell>
                              <a
                                href={test.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center"
                                style={{ color: COLORS.primary }}
                              >
                                <ExternalLink className="h-4 w-4 mr-1 text-white" />
                                Открыть тест
                              </a>
                            </TableCell>
                            <TableCell>
                              {!isStaff && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                                  onClick={() => {
                                    setName(test.name);
                                    setLink(test.link);
                                    setIsWeeklyTest(test.isWeeklyTest);
                                    setDate(new Date().toISOString().split('T')[0]);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1 text-white" />
                                  Добавить результат
                                </Button>
                              )}
                              {isStaff && (
                                <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Только для игроков</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                {getWeeklyTests().length === 0 ? (
                  <div className="text-center py-8 rounded-lg" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, border: `1px solid ${COLORS.borderColor}` }}>
                    <Image className="h-12 w-12 mx-auto mb-2 text-white" />
                    <p style={{ color: COLORS.textColorSecondary }}>Нет еженедельных тестов на эту неделю</p>
                    {!isStaff && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                        onClick={() => {
                          resetForm();
                          setIsWeeklyTest(true);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4 text-white" />
                        Добавить еженедельный тест
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md" style={{ border: `1px solid ${COLORS.borderColor}` }}>
                    <div className="grid grid-cols-12 p-4 font-medium" style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor }}>
                      <div className="col-span-3">Дата</div>
                      <div className="col-span-4">Название теста</div>
                      <div className="col-span-3">Ссылка / Скриншот</div>
                      <div className="col-span-2">Действия</div>
                    </div>
                    
                    {getWeeklyTests()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((test) => (
                        <div
                          key={test.id}
                          className="grid grid-cols-12 p-4 items-center"
                          style={{ borderTop: `1px solid ${COLORS.borderColor}`, color: COLORS.textColor }}
                        >
                          <div className="col-span-3 text-sm">
                            {formatDate(test.date)}
                          </div>
                          <div className="col-span-4 font-medium">
                            {test.name}
                          </div>
                          <div className="col-span-3 flex space-x-2">
                            <a
                              href={test.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                              style={{ color: COLORS.primary }}
                            >
                              <ExternalLink className="h-4 w-4 text-white" />
                            </a>
                            {test.screenshotUrl && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" style={{ color: COLORS.primary }}>
                                    <Image className="h-4 w-4 text-white" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                                  <DialogHeader>
                                    <DialogTitle style={{ color: COLORS.textColor }}>Скриншот теста: {test.name}</DialogTitle>
                                  </DialogHeader>
                                  <img
                                    src={test.screenshotUrl}
                                    alt={test.name}
                                    className="w-full h-auto rounded-md"
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          <div className="col-span-2 flex space-x-2">
                            {!isStaff && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.primary }}
                                  onClick={() => handleEdit(test)}
                                >
                                  <Edit className="h-4 w-4 text-white" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.danger }}
                                  onClick={() => handleDelete(test.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </Button>
                              </>
                            )}
                            {isStaff && (
                              <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Просмотр</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questionnaire">
                <Card style={COMPONENT_STYLES.card}>
                  <CardHeader>
                    <CardTitle style={COMPONENT_STYLES.text.title}>Ежедневный опросник</CardTitle>
                    <CardDescription style={COMPONENT_STYLES.text.description}>
                      Настроение, энергия, диапазон сна и детализация экранного времени
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label style={{ color: COLORS.textColor }}>Дата</Label>
                      <Input
                        type="date"
                        value={qDate}
                        onChange={(e) => setQDate(e.target.value)}
                        style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Настроение (1-10)</Label>
                        <Input
                          value={qMood}
                          onChange={(e) => setQMood(e.target.value)}
                          inputMode="numeric"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Энергия (1-10)</Label>
                        <Input
                          value={qEnergy}
                          onChange={(e) => setQEnergy(e.target.value)}
                          inputMode="numeric"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон: с</Label>
                        <Input
                          type="time"
                          value={qSleepStart}
                          onChange={(e) => setQSleepStart(e.target.value)}
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон: до</Label>
                        <Input
                          type="time"
                          value={qSleepEnd}
                          onChange={(e) => setQSleepEnd(e.target.value)}
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон (часы, авто/ручной)</Label>
                        <Input
                          value={qSleep}
                          onChange={(e) => setQSleep(e.target.value)}
                          inputMode="decimal"
                          placeholder="Например: 7.5"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Экранное время (часы, общее)</Label>
                        <Input
                          value={qScreen}
                          onChange={(e) => setQScreen(e.target.value)}
                          inputMode="decimal"
                          placeholder="Можно оставить пустым, если заполнена детализация"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label style={{ color: COLORS.textColor }}>Экранное время: на что ушло время (часы)</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          value={qScreenEntertainment}
                          onChange={(e) => setQScreenEntertainment(e.target.value)}
                          inputMode="decimal"
                          placeholder="Развлечения (игры, видео)"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                        <Input
                          value={qScreenCommunication}
                          onChange={(e) => setQScreenCommunication(e.target.value)}
                          inputMode="decimal"
                          placeholder="Общение (мессенджеры, соцсети)"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                        <Input
                          value={qScreenBrowser}
                          onChange={(e) => setQScreenBrowser(e.target.value)}
                          inputMode="decimal"
                          placeholder="Браузер"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                        <Input
                          value={qScreenStudy}
                          onChange={(e) => setQScreenStudy(e.target.value)}
                          inputMode="decimal"
                          placeholder="Учёба / работа"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={submitQuestionnaire} disabled={qSubmitting}>
                      {qSubmitting ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.textColor }}>
              {editingTest ? "Редактировать тест" : "Добавить тест"}
            </DialogTitle>
            <DialogDescription style={{ color: COLORS.textColorSecondary }}>
              {editingTest ? "Измените информацию о пройденном тесте" : "Заполните информацию о пройденном тесте"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right" style={{ color: COLORS.textColor }}>
                Название
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="link" className="text-right" style={{ color: COLORS.textColor }}>
                Ссылка
              </Label>
              <Input
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right" style={{ color: COLORS.textColor }}>
                Дата
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="weekly-test"
                className="text-right"
                style={{ color: COLORS.textColor }}
              >
                Еженедельный тест
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Switch
                  id="weekly-test"
                  checked={isWeeklyTest}
                  onCheckedChange={setIsWeeklyTest}
                />
                <Label htmlFor="weekly-test" style={{ color: COLORS.textColorSecondary }}>
                  {isWeeklyTest ? "Еженедельный" : "Ежедневный"}
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="testType" className="text-right" style={{ color: COLORS.textColor }}>
                Тип теста
              </Label>
              <Input
                id="testType"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Raw score"
                value={rawScore}
                onChange={(e) => setRawScore(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Score normalized (0-100)"
                value={scoreNormalized}
                onChange={(e) => setScoreNormalized(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="Unit (%)"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Duration sec"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                inputMode="numeric"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Attempts"
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
                inputMode="numeric"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="Fatigue (0-10)"
                value={fatigue}
                onChange={(e) => setFatigue(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Focus (0-10)"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Stress (0-10)"
                value={stress}
                onChange={(e) => setStress(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="Sleep hours"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Mood (0-10)"
                value={snapshotMood}
                onChange={(e) => setSnapshotMood(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Energy (0-10)"
                value={snapshotEnergy}
                onChange={(e) => setSnapshotEnergy(e.target.value)}
                inputMode="decimal"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                placeholder="Match type"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Map"
                value={contextMap}
                onChange={(e) => setContextMap(e.target.value)}
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
              <Input
                placeholder="Role"
                value={contextRole}
                onChange={(e) => setContextRole(e.target.value)}
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
          </div>
          <DialogFooter>
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
              style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}
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
