import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Brain,
  Camera,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Droplets,
  Grid2X2,
  ImageIcon,
  Home,
  List,
  LogOut,
  Moon,
  Plus,
  Salad,
  ShieldAlert,
  Sun,
  Timer,
  User,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  completeBrainTestAttempt,
  getDailyQuestionnaireStatus,
  getBrainPerformanceSummary,
  getBrainTestsCatalog,
  getMyNutritionEntries,
  getNutritionTeamSummary,
  getPlayers,
  getTeamSleepSummary,
  startBrainTestAttempt,
  submitDailyQuestionnaire,
  submitNutritionEntry,
  type NutritionEntry,
  type NutritionMealType,
  type NutritionQuality,
  type NutritionTeamSummary,
  type TeamSleepSummary
} from "@/lib/api";
import { getCalendarEvents } from "@/lib/calendarApi";
import ROUTES from "@/lib/routes";
import { COLORS } from "@/styles/theme";
import { getImageUrl } from "@/utils/imageUtils";
import { getMyPlayerDashboard, getPlayerDashboard, type PlayerDashboardData } from "@/utils/api/playerDashboard";
import atlantMiniLogoWhite from "@/assets/atlant-mini-logo-white.svg";
import type { BrainAttemptResult, BrainAttemptStartResponse, BrainCatalogResponse, BrainPerformanceSummary, CalendarEvent } from "@/types";

type MobileTab = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type PlayerListItem = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  playerType?: string;
  completedTests?: boolean;
  completedBalanceWheel?: boolean;
  createdAt?: string;
};

type MoodTimeOfDay = "morning" | "afternoon" | "evening";

type MoodEnergySlot = {
  mood: number;
  energy: number;
};

type NutritionPeriod = "День" | "Неделя" | "Месяц";

type MobileBrainStimulus = {
  id: number;
  type: "go" | "no_go";
};

type MobileBrainResponse = {
  stimulusId: number;
  type: "go" | "no_go";
  rtMs: number | null;
  tapped: boolean;
};

const dateKeyFromDate = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const todayKey = () => dateKeyFromDate(new Date());
const mobileQueryFreshness = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false
};

const shiftDateKey = (dateKey: string, offsetDays: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offsetDays);
  return dateKeyFromDate(date);
};

const addDaysToDate = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const formatUpcomingEventDate = (event: CalendarEvent) => {
  const start = new Date(event.startAt);
  const now = new Date();
  const today = dateKeyFromDate(now);
  const tomorrow = dateKeyFromDate(addDaysToDate(now, 1));
  const eventDay = dateKeyFromDate(start);
  const dayLabel = eventDay === today
    ? "Сегодня"
    : eventDay === tomorrow
      ? "Завтра"
      : new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(start);

  if (event.allDay) {
    return `${dayLabel}, весь день`;
  }

  return `${dayLabel}, ${new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(start)}`;
};

function useTodayKey() {
  const [day, setDay] = useState(todayKey);

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNextDayRefresh = () => {
      const now = new Date();
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 2, 0);
      timeoutId = window.setTimeout(() => {
        setDay(todayKey());
        scheduleNextDayRefresh();
      }, Math.max(1000, nextDay.getTime() - now.getTime()));
    };

    scheduleNextDayRefresh();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return day;
}
const clampScore = (value: number | null | undefined) => (typeof value === "number" ? Math.round(value) : null);
const currentMoodTimeOfDay = (): MoodTimeOfDay => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
};

const mealLabels: Record<NutritionMealType, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус"
};

const qualityLabels: Record<NutritionQuality, string> = {
  good: "Хорошо",
  normal: "Нормально",
  heavy: "Тяжело",
  skipped: "Пропустил"
};

const moodTimeLabels: Record<MoodTimeOfDay, { title: string; hint: string; icon: ComponentType<{ className?: string }> }> = {
  morning: { title: "Утро", hint: "после сна", icon: Sun },
  afternoon: { title: "День", hint: "до/после тренировки", icon: Activity },
  evening: { title: "Вечер", hint: "после игровых задач", icon: Moon }
};

const mealVisuals: Record<NutritionMealType, { icon: ComponentType<{ className?: string }>; gradient: string; glow: string }> = {
  breakfast: {
    icon: Salad,
    gradient: "linear-gradient(145deg, rgba(245,158,11,0.92), rgba(132,78,12,0.95))",
    glow: "rgba(245,158,11,0.28)"
  },
  lunch: {
    icon: Utensils,
    gradient: "linear-gradient(145deg, rgba(249,115,22,0.92), rgba(127,29,29,0.95))",
    glow: "rgba(249,115,22,0.25)"
  },
  dinner: {
    icon: Moon,
    gradient: "linear-gradient(145deg, rgba(59,130,246,0.92), rgba(30,41,91,0.95))",
    glow: "rgba(59,130,246,0.24)"
  },
  snack: {
    icon: Droplets,
    gradient: "linear-gradient(145deg, rgba(6,182,212,0.92), rgba(14,116,144,0.95))",
    glow: "rgba(6,182,212,0.24)"
  }
};

const scoreColor = (value: number | null) => {
  if (value == null) return COLORS.textColorSecondary;
  if (value >= 75) return COLORS.success;
  if (value >= 55) return COLORS.warning;
  return COLORS.danger;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const response = "response" in error ? error.response : undefined;
    if (typeof response === "object" && response !== null && "data" in response) {
      const data = response.data;
      if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
        return data.message;
      }
    }
  }
  return fallback;
};

export default function MobileApp() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <MobileLoading />;
  }

  if (!user) {
    return <Navigate to={ROUTES.WELCOME} replace />;
  }

  const startPath = user.role === "staff" ? "/mobile/staff/team" : "/mobile/player/today";

  return (
    <MobileShell
      userName={user.name}
      userRole={user.role === "staff" ? "staff" : "player"}
      hasTeamCalendar={user.role === "staff" && user.playerType === "team" && Boolean(user.teamId)}
      onLogout={logout}
    >
      <Routes>
        <Route index element={<Navigate to={startPath} replace />} />
        <Route path="player/today" element={<PlayerToday />} />
        <Route path="player/checkin" element={<PlayerCheckin />} />
        <Route path="player/cognitive" element={<PlayerCognitive />} />
        <Route path="player/nutrition" element={<PlayerNutrition />} />
        <Route path="player/metrics" element={<PlayerMetrics />} />
        <Route path="player/profile" element={<MobileProfile onLogout={logout} />} />
        <Route path="staff/team" element={<StaffTeam />} />
        <Route path="staff/nutrition" element={<StaffNutrition />} />
        <Route path="staff/analytics" element={<StaffAnalytics />} />
        <Route path="staff/players" element={<StaffPlayers />} />
        <Route path="staff/profile" element={<MobileProfile onLogout={logout} />} />
        <Route path="*" element={<Navigate to={startPath} replace />} />
      </Routes>
    </MobileShell>
  );
}

function MobileShell({
  children,
  userName,
  userRole,
  hasTeamCalendar,
  onLogout
}: {
  children: ReactNode;
  userName: string;
  userRole: "player" | "staff";
  hasTeamCalendar: boolean;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const today = useTodayKey();
  const upcomingRangeEnd = shiftDateKey(today, 30);
  const headerEventQuery = useQuery({
    queryKey: ["mobile", "staff", "header-team-calendar", today, upcomingRangeEnd],
    queryFn: () => getCalendarEvents({
      scope: "team",
      from: new Date().toISOString(),
      to: addDaysToDate(new Date(), 30).toISOString()
    }),
    enabled: userRole === "staff" && hasTeamCalendar,
    ...mobileQueryFreshness
  });
  const fullCheckinMode = userRole === "player" && location.pathname === "/mobile/player/checkin" && location.search.includes("flow=full");
  const immersiveMode = fullCheckinMode || (userRole === "player" && location.pathname === "/mobile/player/cognitive");
  const nextHeaderEvent = (headerEventQuery.data || [])
    .filter((event) => new Date(event.endAt).getTime() >= Date.now())
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0] || null;
  const tabs: MobileTab[] = userRole === "staff"
    ? [
        { label: "Команда", href: "/mobile/staff/team", icon: Users },
        { label: "Питание", href: "/mobile/staff/nutrition", icon: Salad },
        { label: "Аналитика", href: "/mobile/staff/analytics", icon: BarChart3 },
        { label: "Игроки", href: "/mobile/staff/players", icon: Activity },
        { label: "Профиль", href: "/mobile/staff/profile", icon: User }
      ]
    : [
        { label: "Сегодня", href: "/mobile/player/today", icon: Home },
        { label: "Состояние", href: "/mobile/player/checkin", icon: Activity },
        { label: "Чек-ин", href: "/mobile/player/checkin?flow=full", icon: Plus },
        { label: "Питание", href: "/mobile/player/nutrition", icon: Salad },
        { label: "Профиль", href: "/mobile/player/profile", icon: User }
      ];

  return (
    <div className="min-h-[100dvh] bg-[#080B18] text-white">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#14162D]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 top-56 h-80 w-80 rounded-full bg-violet-500/16 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />

        {!immersiveMode ? <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#14162D]/88 px-4 pb-3 pt-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#293056] bg-[#1C1F3B]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06]">
                  <img src={atlantMiniLogoWhite} alt="" className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200/80">
                  CRMATLANT
                </span>
                <span className="rounded-md border border-blue-400/20 bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-blue-200">
                  {userRole === "staff" ? "тренер" : "игрок"}
                </span>
              </div>
              <div className="mt-1 truncate text-xl font-bold tracking-[-0.02em]">{userName}</div>
            </div>
            {userRole === "staff" ? (
              <HeaderUpcomingEvent event={nextHeaderEvent} isLoading={hasTeamCalendar && headerEventQuery.isLoading} />
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#293056] bg-[#1C1F3B]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              aria-label="Выйти"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header> : null}

        <main className={`relative z-10 flex-1 overflow-y-auto ${immersiveMode ? "px-0 pb-0 pt-0" : "px-4 pb-28 pt-4"}`}>
          {children}
        </main>

        {!immersiveMode ? <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] bg-[linear-gradient(180deg,transparent,#14162D_28%)] px-3 pb-4 pt-5">
          <div className="grid grid-cols-5 gap-1 rounded-[24px] border border-[#293056] bg-[#1C1F3B]/85 p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
            {tabs.map((tab) => {
              const centerAction = userRole === "player" && tab.href.includes("flow=full");
              const active = !centerAction && location.pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    centerAction
                      ? "relative -mt-4 flex min-h-14 flex-col items-center justify-start text-white"
                      : `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[9.5px] font-semibold transition ${
                          active ? "bg-blue-500/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" : "text-slate-400"
                        }`
                  }
                >
                  {centerAction ? (
                    <>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 shadow-[0_12px_26px_rgba(59,130,246,0.34),inset_0_1px_0_rgba(255,255,255,0.22)]">
                        <Icon className="h-7 w-7" />
                      </span>
                    </>
                  ) : (
                    <>
                      {active ? <span className="absolute top-1 h-0.5 w-5 rounded-full bg-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.8)]" /> : null}
                      <Icon className={`h-5 w-5 ${active ? "text-blue-300" : ""}`} />
                      <span>{tab.label}</span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </nav> : null}
      </div>
    </div>
  );
}

function HeaderUpcomingEvent({ event, isLoading }: { event: CalendarEvent | null; isLoading: boolean }) {
  const title = isLoading ? "Календарь" : event?.title || "Нет событий";
  const detail = isLoading ? "загрузка" : event ? formatUpcomingEventDate(event) : "30 дней";

  return (
    <div className="hidden w-[112px] shrink-0 rounded-2xl border border-blue-300/16 bg-blue-400/10 px-2.5 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] min-[380px]:block">
      <div className="flex items-center justify-end gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-blue-200/80">
        <CalendarDays className="h-3 w-3" />
        Ближайшее
      </div>
      <div className="mt-0.5 truncate text-[11px] font-semibold leading-4 text-white">{title}</div>
      <div className="truncate text-[9px] leading-3 text-slate-300">{detail}</div>
    </div>
  );
}

function PlayerToday() {
  const navigate = useNavigate();
  const today = useTodayKey();
  const statusQuery = useQuery({
    queryKey: ["mobile", "daily-status", today],
    queryFn: async () => (await getDailyQuestionnaireStatus(today)).data,
    ...mobileQueryFreshness
  });
  const nutritionQuery = useQuery({
    queryKey: ["mobile", "nutrition", "my", today],
    queryFn: async () => (await getMyNutritionEntries(today, today)).data.data,
    ...mobileQueryFreshness
  });
  const dashboardQuery = useQuery({
    queryKey: ["mobile", "dashboard", "me"],
    queryFn: getMyPlayerDashboard,
    ...mobileQueryFreshness
  });

  const readiness = clampScore(dashboardQuery.data?.data?.scores.readiness);
  const brainScore = clampScore(dashboardQuery.data?.data?.scores.brainPerformance);
  const meals = nutritionQuery.data || [];
  const checkinDone = Boolean(statusQuery.data?.completed);
  const moodDone = Boolean(statusQuery.data?.moodDone);

  return (
    <div className="space-y-4">
      <ReadinessHero
        title={readiness == null ? "Собрать картину дня" : "Готовность сегодня"}
        value={readiness}
        subtitle={checkinDone ? "Чек-ин заполнен" : "Заполните сон и состояние, чтобы обновить показатель"}
      />

      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={ClipboardCheck}
          label={checkinDone ? "Обновить чек-ин" : "Заполнить чек-ин"}
          description={checkinDone ? "Можно скорректировать данные дня" : "Сон, энергия, стресс"}
          onClick={() => navigate("/mobile/player/checkin")}
        />
        <QuickAction
          icon={Utensils}
          label="Добавить питание"
          description={`${meals.length} записей сегодня`}
          onClick={() => navigate("/mobile/player/nutrition")}
        />
      </div>

      <button
        type="button"
        onClick={() => navigate("/mobile/player/cognitive")}
        className="flex w-full items-center gap-4 rounded-[24px] border border-[#293056] bg-[linear-gradient(145deg,rgba(28,31,59,0.96),rgba(20,30,58,0.9))] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.99]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/14 text-cyan-300">
          <Brain className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-white">Когнитивный тест</div>
          <div className="mt-1 text-sm text-slate-400">1 минута · реакция и контроль</div>
        </div>
        <span className="text-sm font-semibold text-blue-300">старт</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-blue-300" />
      </button>

      <SectionTitle title="Сегодняшние показатели" />
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={Moon} label="Сон" value={statusQuery.data?.sleepDone ? "есть" : "-"} />
        <MetricTile icon={Activity} label="Состояние" value={moodDone ? "3/3" : "-"} />
        <MetricTile icon={Salad} label="Питание" value={`${meals.length}`} />
      </div>

      <MobilePanel title="План на день">
        <StatusRow done={checkinDone} label="Ежедневный чек-ин" hint={checkinDone ? "сохранён" : "сон, экран и 3 состояния"} />
        <StatusRow done={meals.length > 0} label="Питание" hint={meals.length ? `${meals.length} приёма` : "нет записей"} />
        <StatusRow done={brainScore != null} label="Когнитивный тест" hint={brainScore != null ? `${brainScore}/100` : "1 минута, реакция и контроль"} />
        <StatusRow done={readiness != null} label="Готовность" hint={readiness != null ? `${readiness}/100` : "нужны данные"} last />
      </MobilePanel>
    </div>
  );
}

const MOBILE_GO_NO_GO_TOTAL = 30;
const MOBILE_GO_NO_GO_STIMULUS_MS = 900;
const MOBILE_GO_NO_GO_GAP_MS = 650;

const createGoNoGoStimuli = (total = MOBILE_GO_NO_GO_TOTAL): MobileBrainStimulus[] => {
  const noGoCount = Math.max(6, Math.round(total * 0.25));
  const stimuli: MobileBrainStimulus[] = [
    ...Array.from({ length: total - noGoCount }, (_, index) => ({ id: index + 1, type: "go" as const })),
    ...Array.from({ length: noGoCount }, (_, index) => ({ id: total - noGoCount + index + 1, type: "no_go" as const }))
  ];

  for (let index = stimuli.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [stimuli[index], stimuli[swapIndex]] = [stimuli[swapIndex], stimuli[index]];
  }

  if (stimuli[0]?.type === "no_go") {
    const firstGoIndex = stimuli.findIndex((stimulus) => stimulus.type === "go");
    if (firstGoIndex > 0) {
      [stimuli[0], stimuli[firstGoIndex]] = [stimuli[firstGoIndex], stimuli[0]];
    }
  }

  return stimuli.map((stimulus, index) => ({ ...stimulus, id: index + 1 }));
};

const medianValue = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const coefficientOfVariation = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!average) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Number((Math.sqrt(variance) / average).toFixed(4));
};

const pct = (part: number, total: number) => (total ? Number(((part / total) * 100).toFixed(1)) : 0);

const buildGoNoGoRawMetrics = (responses: MobileBrainResponse[], durationMs: number) => {
  const goResponses = responses.filter((response) => response.type === "go");
  const noGoResponses = responses.filter((response) => response.type === "no_go");
  const hitRts = goResponses
    .filter((response) => response.tapped && typeof response.rtMs === "number")
    .map((response) => response.rtMs as number);
  const hits = hitRts.length;
  const omissionErrors = goResponses.length - hits;
  const commissionErrors = noGoResponses.filter((response) => response.tapped).length;
  const correctNoGo = noGoResponses.length - commissionErrors;

  return {
    goAccuracyPct: pct(hits, goResponses.length),
    noGoAccuracyPct: pct(correctNoGo, noGoResponses.length),
    medianRtMs: medianValue(hitRts),
    rtCv: coefficientOfVariation(hitRts),
    commissionErrors,
    omissionErrors,
    durationMs,
    visibilityHiddenMs: 0,
    fastResponseRatio: pct(hitRts.filter((rt) => rt < 120).length, hitRts.length) / 100,
    totalStimuli: responses.length,
    goTotal: goResponses.length,
    noGoTotal: noGoResponses.length
  };
};

const getMobileBrainClientMeta = () => ({
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  userAgent: navigator.userAgent,
  deviceType: "mobile"
});

function PlayerCognitive() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"intro" | "running" | "saving" | "result">("intro");
  const [stimuli, setStimuli] = useState<MobileBrainStimulus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<BrainAttemptResult | null>(null);
  const [lastMetrics, setLastMetrics] = useState<ReturnType<typeof buildGoNoGoRawMetrics> | null>(null);
  const [errorText, setErrorText] = useState("");
  const respondedRef = useRef(false);
  const stimulusStartedAtRef = useRef(0);
  const responsesRef = useRef<MobileBrainResponse[]>([]);
  const runStartedAtRef = useRef(0);

  const catalogQuery = useQuery({
    queryKey: ["mobile", "brain", "catalog"],
    queryFn: async () => (await getBrainTestsCatalog()).data as BrainCatalogResponse,
    ...mobileQueryFreshness
  });
  const summaryQuery = useQuery({
    queryKey: ["mobile", "brain", "summary"],
    queryFn: async () => {
      try {
        const response = await getBrainPerformanceSummary(30);
        return response.data.data as BrainPerformanceSummary;
      } catch {
        return null;
      }
    },
    ...mobileQueryFreshness
  });

  const goNoGoCatalog = catalogQuery.data?.tests.find((test) => test.testKey === "go_no_go");
  const goNoGoSummary = summaryQuery.data?.tests.find((test) => test.testKey === "go_no_go");
  const activeStimulus = phase === "running" ? stimuli[currentIndex] : null;
  const progress = stimuli.length ? Math.min(((currentIndex + 1) / stimuli.length) * 100, 100) : 0;

  const completeRun = useCallback(async (responses: MobileBrainResponse[]) => {
    if (!attemptId) return;

    const durationMs = Math.max(1, Math.round(performance.now() - runStartedAtRef.current));
    const rawMetrics = buildGoNoGoRawMetrics(responses, durationMs);
    setLastMetrics(rawMetrics);
    setPhase("saving");

    try {
      const response = await completeBrainTestAttempt(attemptId, {
        rawMetrics,
        clientMeta: getMobileBrainClientMeta(),
        context: {
          source: "mobile_brain_lab",
          notes: "go_no_go_mobile_touch"
        }
      });
      setResult(response.data.data as BrainAttemptResult);
      setPhase("result");
      await queryClient.invalidateQueries({ queryKey: ["mobile"] });
      toast({ title: "Тест сохранён", description: "Результат сохранён и появится в вашей аналитике." });
    } catch (error: unknown) {
      setErrorText(getErrorMessage(error, "Не удалось сохранить когнитивный тест"));
      setPhase("intro");
    }
  }, [attemptId, queryClient, toast]);

  useEffect(() => {
    if (phase !== "running") return;

    if (currentIndex >= stimuli.length) {
      void completeRun(responsesRef.current);
      return;
    }

    const stimulus = stimuli[currentIndex];
    respondedRef.current = false;
    stimulusStartedAtRef.current = performance.now();

    let gapTimer: number | undefined;
    const stimulusTimer = window.setTimeout(() => {
      if (!respondedRef.current) {
        responsesRef.current = [
          ...responsesRef.current,
          {
            stimulusId: stimulus.id,
            type: stimulus.type,
            rtMs: null,
            tapped: false
          }
        ];
      }

      gapTimer = window.setTimeout(() => {
        setCurrentIndex((index) => index + 1);
      }, MOBILE_GO_NO_GO_GAP_MS);
    }, MOBILE_GO_NO_GO_STIMULUS_MS);

    return () => {
      window.clearTimeout(stimulusTimer);
      if (gapTimer) window.clearTimeout(gapTimer);
    };
  }, [completeRun, currentIndex, phase, stimuli]);

  const startTest = async () => {
    setErrorText("");
    setResult(null);
    setLastMetrics(null);

    try {
      const response = await startBrainTestAttempt({
        testKey: "go_no_go",
        clientMeta: getMobileBrainClientMeta()
      });
      const startData = response.data as BrainAttemptStartResponse;
      const nextStimuli = createGoNoGoStimuli();
      responsesRef.current = [];
      runStartedAtRef.current = performance.now();
      setAttemptId(startData.attemptId);
      setStimuli(nextStimuli);
      setCurrentIndex(0);
      setPhase("running");
    } catch (error: unknown) {
      setErrorText(getErrorMessage(error, "Не удалось запустить когнитивный тест"));
    }
  };

  const handleStimulusTap = () => {
    if (!activeStimulus || respondedRef.current) return;

    respondedRef.current = true;
    responsesRef.current = [
      ...responsesRef.current,
      {
        stimulusId: activeStimulus.id,
        type: activeStimulus.type,
        rtMs: Math.max(1, Math.round(performance.now() - stimulusStartedAtRef.current)),
        tapped: true
      }
    ];
  };

  const close = () => navigate("/mobile/player/today");

  if (phase === "running" || phase === "saving") {
    const isNoGo = activeStimulus?.type === "no_go";

    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#080B18] px-5 pb-6 pt-8 text-white">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={close}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1F3B]"
            aria-label="Закрыть тест"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#252A4D]">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="w-14 text-right text-lg font-semibold text-slate-400">{Math.min(currentIndex + 1, stimuli.length)}/{stimuli.length || MOBILE_GO_NO_GO_TOTAL}</div>
        </div>

        <div className="mt-14">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Go / No-Go</div>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white">{phase === "saving" ? "Сохраняем результат" : isNoGo ? "Красный круг" : "Зеленый круг"}</h1>
          <p className="mt-3 text-lg leading-7 text-slate-300">{phase === "saving" ? "Сохраняем результат" : isNoGo ? "Не тапай, удержись" : "Тапни как можно быстрее"}</p>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          {phase === "saving" ? (
            <div className="rounded-[32px] border border-[#293056] bg-[#1C1F3B] p-8 text-center">
              <Brain className="mx-auto h-14 w-14 animate-pulse text-blue-300" />
              <div className="mt-5 text-xl font-bold">Анализируем попытку</div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStimulusTap}
              className={`flex h-56 w-56 items-center justify-center rounded-full border text-4xl font-black shadow-[0_28px_80px_rgba(0,0,0,0.35)] transition active:scale-95 ${
                isNoGo
                  ? "border-rose-300/60 bg-rose-500 text-white shadow-rose-500/20"
                  : "border-emerald-300/60 bg-emerald-500 text-white shadow-emerald-500/20"
              }`}
              aria-label={isNoGo ? "Красный круг, не нажимать" : "Зеленый круг, нажать"}
            >
              <Circle className="h-24 w-24 fill-current" />
            </button>
          )}
        </div>

        <div className="rounded-[24px] border border-[#293056] bg-[#1C1F3B] p-4 text-center text-sm leading-6 text-slate-300">
          Зеленый круг: тап. Красный круг: удержись. Это короткий тест реакции и контроля импульса.
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const accuracy = lastMetrics ? Math.round((lastMetrics.goAccuracyPct + lastMetrics.noGoAccuracyPct) / 2) : null;
    const reaction = lastMetrics?.medianRtMs;
    const score = clampScore(result?.rawCompositeScore);

    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#080B18] px-5 pb-6 pt-8 text-white">
        <MobileCognitiveTopbar title="Когнитивный тест" onClose={close} />
        <div className="mt-10 rounded-[30px] border border-[#293056] bg-[linear-gradient(145deg,rgba(35,39,72,0.96),rgba(28,31,59,0.9))] p-6 text-center">
          <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(135deg,#9B8CFF,#3B82F6)] text-white shadow-[0_20px_52px_rgba(59,130,246,0.28)]">
            <CheckCircle2 className="h-12 w-12" />
          </span>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-white">Тест сохранен</h1>
          <p className="mt-3 text-base leading-6 text-slate-300">Результат сохранён. Тренер увидит его в вашей аналитике.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <CognitiveStat label="Очки" value={score == null ? "—" : `${score}`} />
          <CognitiveStat label="Точность" value={accuracy == null ? "—" : `${accuracy}%`} />
          <CognitiveStat label="Реакция" value={reaction == null ? "—" : `${reaction} мс`} />
          <CognitiveStat label="Статус" value={result?.validityStatus === "invalid" ? "повторить" : "зачтено"} />
        </div>

        {errorText ? <AlertBanner text={errorText} tone="warning" /> : null}

        <div className="mt-auto space-y-3 pt-8">
          <Button onClick={startTest} className="h-16 w-full rounded-[24px] bg-[#1C1F3B] text-lg font-semibold text-white hover:bg-[#252A4D]">
            Пройти еще раз
          </Button>
          <Button onClick={close} className="h-16 w-full rounded-[24px] bg-blue-500 text-lg font-semibold text-white hover:bg-blue-400">
            Готово <ChevronRight className="ml-2 h-6 w-6" />
          </Button>
        </div>
      </div>
    );
  }

  const baselineBpi = summaryQuery.data?.brainPerformanceIndex;
  const baselineGoNoGo = goNoGoSummary?.latestRawScore;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#080B18] px-5 pb-48 pt-8 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(155,140,255,0.22),transparent_68%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_70%)] blur-3xl" />

      <div className="relative">
        <MobileCognitiveTopbar title="Когнитивный тест" onClose={close} />

        <section className="relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(140deg,rgba(70,55,140,0.55),rgba(28,31,59,0.92)_55%,rgba(20,24,48,0.96))] p-5 shadow-[0_24px_72px_-32px_rgba(59,130,246,0.45)]">
          <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(155,140,255,0.5),transparent_70%)]" />
          <div aria-hidden className="absolute -left-8 -bottom-12 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35),transparent_70%)]" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#9B8CFF,#3B82F6)] text-white shadow-[0_18px_44px_rgba(59,130,246,0.42)]">
              <Brain className="h-9 w-9" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/85">Когнитивный модуль</div>
              <h1 className="mt-1 text-[28px] font-black leading-[1.05] tracking-[-0.04em] text-white">
                {goNoGoCatalog?.title || "Go / No-Go"}
              </h1>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-300/90">
                {goNoGoCatalog?.shortDescription || "Реакция и тормозной контроль"}
              </p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-200/85">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1">≈ {MOBILE_GO_NO_GO_TOTAL} стимулов</span>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1">60 сек</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-emerald-100/90">Только тап</span>
          </div>
        </section>

        <div className="mt-6 mb-3 flex items-baseline justify-between">
          <SectionTitle title="Правила" />
          <span className="text-[11px] text-slate-500">2 стимула</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <CognitiveRuleCircle tone="go" label="ЗЕЛЁНЫЙ" hint="тапни быстро" />
          <CognitiveRuleCircle tone="nogo" label="КРАСНЫЙ" hint="не тапай" />
        </div>
        <div className="mt-2.5 flex items-center gap-3 rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300">
            <Timer className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-[13px] leading-5 text-slate-300">
            <span className="font-semibold text-white">60 секунд непрерывно</span>
            <span className="text-slate-400"> — без пауз и подсказок.</span>
          </div>
        </div>

        <div className="mt-6 mb-3 flex items-baseline justify-between">
          <SectionTitle title="Твои показатели" />
          <span className="text-[11px] text-slate-500">за 30 дней</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BaselineStat
            label="Индекс"
            hint="общая форма"
            value={baselineBpi == null ? null : Math.round(baselineBpi)}
          />
          <BaselineStat
            label="Реакция и контроль"
            hint="последний результат"
            value={baselineGoNoGo == null ? null : Math.round(baselineGoNoGo)}
            unit="%"
          />
        </div>

        {errorText ? <div className="mt-4"><AlertBanner text={errorText} tone="warning" /></div> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-[linear-gradient(180deg,rgba(8,11,24,0)_0%,rgba(8,11,24,0.94)_24%,#080B18_54%)] px-5 pb-6 pt-10">
        <div className="mb-3 flex items-start gap-3 rounded-[20px] border border-blue-300/18 bg-blue-500/12 px-4 py-3 text-left shadow-[0_16px_36px_rgba(59,130,246,0.16)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
          <p className="text-[12px] font-medium leading-5 text-blue-50">
            Перед стартом: сядь удобно, убери отвлечения и держи устройство одной рукой.
          </p>
        </div>
        <Button
          onClick={startTest}
          disabled={catalogQuery.isLoading}
          className="group relative h-16 w-full overflow-hidden rounded-[24px] border-0 bg-[linear-gradient(135deg,#5B82FF,#3B82F6)] text-xl font-semibold text-white shadow-[0_18px_44px_rgba(59,130,246,0.42)] transition-transform active:translate-y-[1px] hover:bg-[#3B82F6] disabled:opacity-70"
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
          <span className="relative inline-flex items-center justify-center gap-2">
            {catalogQuery.isLoading ? "Загрузка..." : <>Начать тест <ChevronRight className="h-6 w-6" /></>}
          </span>
        </Button>
      </div>
    </div>
  );
}

function MobileCognitiveTopbar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onClose}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1F3B] text-white"
        aria-label="Закрыть"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="min-w-0 flex-1 text-center text-xl font-bold text-white">{title}</div>
      <div className="h-12 w-12" />
    </div>
  );
}

function CognitiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#293056] bg-[#1C1F3B] p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-white">{value}</div>
    </div>
  );
}

function CognitiveRuleCircle({ tone, label, hint }: { tone: "go" | "nogo"; label: string; hint: string }) {
  const isGo = tone === "go";
  const accent = isGo
    ? {
        circle: "bg-[radial-gradient(circle_at_30%_30%,#6EF49A,#10B981_55%,#0B7A55_100%)]",
        ring: "ring-emerald-400/45",
        glow: "shadow-[0_18px_44px_rgba(16,185,129,0.32)]",
        chip: "bg-emerald-400/15 text-emerald-200 border-emerald-300/25",
        action: "ТАП"
      }
    : {
        circle: "bg-[radial-gradient(circle_at_30%_30%,#FF8A98,#F43F5E_55%,#9F1239_100%)]",
        ring: "ring-rose-400/45",
        glow: "shadow-[0_18px_44px_rgba(244,63,94,0.32)]",
        chip: "bg-rose-400/15 text-rose-200 border-rose-300/25",
        action: "СТОП"
      };

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[linear-gradient(160deg,rgba(28,31,59,0.92),rgba(20,24,48,0.94))] px-3.5 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.18em] ${accent.chip}`}>{label}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">{accent.action}</span>
      </div>
      <div className="mt-3 flex items-center justify-center">
        <span aria-hidden className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-[#181B33] ${accent.ring} ${accent.glow}`}>
          <span className={`block h-full w-full rounded-full ${accent.circle}`} />
          {!isGo && (
            <span className="absolute h-[3px] w-[58%] -rotate-45 rounded-full bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          )}
        </span>
      </div>
      <div className="mt-3 text-center text-[12px] leading-4 text-slate-300">{hint}</div>
    </div>
  );
}

function BaselineStat({ label, hint, value, unit }: { label: string; hint: string; value: number | null; unit?: string }) {
  const hasValue = value != null;
  return (
    <div className={`relative overflow-hidden rounded-[22px] border p-3.5 ${hasValue ? "border-white/[0.08] bg-[linear-gradient(160deg,rgba(28,31,59,0.95),rgba(20,24,48,0.96))]" : "border-dashed border-white/10 bg-white/[0.025]"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{hint}</span>
      </div>
      {hasValue ? (
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-[28px] font-black leading-none tracking-[-0.04em] text-white">{value}</span>
          {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
        </div>
      ) : (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[28px] font-black leading-none tracking-[-0.04em] text-slate-600">—</span>
          <span className="text-[11px] font-medium text-slate-500">нет данных</span>
        </div>
      )}
    </div>
  );
}

function PlayerCheckin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const date = useTodayKey();
  const [sleepHours, setSleepHours] = useState(7);
  const [moodByTime, setMoodByTime] = useState<Record<MoodTimeOfDay, MoodEnergySlot>>({
    morning: { mood: 7, energy: 7 },
    afternoon: { mood: 7, energy: 7 },
    evening: { mood: 7, energy: 7 }
  });
  const [quickTimeOfDay, setQuickTimeOfDay] = useState<MoodTimeOfDay>(() => currentMoodTimeOfDay());
  const [quickMetric, setQuickMetric] = useState<keyof MoodEnergySlot>("mood");
  const [stress, setStress] = useState(4);
  const [focus, setFocus] = useState(7);
  const fatigue = 4;
  const readinessSelfScore = 7;
  const [screenTimeHours, setScreenTimeHours] = useState("6");
  const [wizardStep, setWizardStep] = useState(0);
  const [bodyTags, setBodyTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const fullCheckinOpen = searchParams.get("flow") === "full";

  const updateMoodSlot = (timeOfDay: MoodTimeOfDay, field: keyof MoodEnergySlot, value: number) => {
    setMoodByTime((current) => ({
      ...current,
      [timeOfDay]: {
        ...current[timeOfDay],
        [field]: value
      }
    }));
  };

  const mutation = useMutation({
    mutationFn: () => submitDailyQuestionnaire({
      date,
      moodByTime,
      stress,
      fatigue,
      focus,
      readinessSelfScore,
      painNote: [
        bodyTags.length ? `Самочувствие: ${bodyTags.join(", ")}` : "",
        note.trim()
      ].filter(Boolean).join(". ") || undefined,
      sleepHours,
      screenTimeHours: screenTimeHours ? Number(screenTimeHours) : undefined
    }),
    onSuccess: async () => {
      toast({ title: "Сохранено", description: "Чек-ин обновлен" });
      setSearchParams({});
      setWizardStep(0);
      await queryClient.invalidateQueries({ queryKey: ["mobile"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Не удалось сохранить",
        description: getErrorMessage(error, "Проверьте данные и попробуйте еще раз"),
        variant: "destructive"
      });
    }
  });

  const quickStateMutation = useMutation({
    mutationFn: () => submitDailyQuestionnaire({
      date,
      moodByTime: {
        [quickTimeOfDay]: moodByTime[quickTimeOfDay]
      }
    }),
    onSuccess: async () => {
      toast({ title: "Состояние сохранено", description: `${moodTimeLabels[quickTimeOfDay].title}: настроение и энергия обновлены` });
      await queryClient.invalidateQueries({ queryKey: ["mobile"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Не удалось сохранить состояние",
        description: getErrorMessage(error, "Проверьте данные и попробуйте еще раз"),
        variant: "destructive"
      });
    }
  });

  return (
    <div className="space-y-4">
      {fullCheckinOpen ? (
        <FullCheckinWizard
          step={wizardStep}
          moodByTime={moodByTime}
          stress={stress}
          focus={focus}
          sleepHours={sleepHours}
          screenTimeHours={screenTimeHours}
          bodyTags={bodyTags}
          note={note}
          isSaving={mutation.isPending}
          onClose={() => {
            setSearchParams({});
            setWizardStep(0);
          }}
          onBack={() => setWizardStep((current) => Math.max(current - 1, 0))}
          onNext={() => setWizardStep((current) => Math.min(current + 1, 7))}
          onSubmit={() => mutation.mutate()}
          onMoodChange={(value) => updateMoodSlot("morning", "mood", value)}
          onEnergyChange={(value) => updateMoodSlot("morning", "energy", value)}
          onSleepHoursChange={setSleepHours}
          onStressChange={setStress}
          onFocusChange={setFocus}
          onScreenTimeChange={(value) => setScreenTimeHours(value)}
          onToggleBodyTag={(tag) => {
            setBodyTags((current) => (
              current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
            ));
          }}
          onNoteChange={setNote}
        />
      ) : null}

      <PageHeading title="Состояние" description="Быстрая запись настроения и энергии отдельно от полного чек-ина." />

      <DailyStateRecorder
        moodByTime={moodByTime}
        selectedTime={quickTimeOfDay}
        selectedMetric={quickMetric}
        isSaving={quickStateMutation.isPending}
        onSelectTime={setQuickTimeOfDay}
        onSelectMetric={setQuickMetric}
        onChangeValue={(value) => updateMoodSlot(quickTimeOfDay, quickMetric, value)}
        onSave={() => quickStateMutation.mutate()}
      />

      <MobilePanel title="Полный чек-ин">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/16 text-blue-200">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">8 шагов: сон, стресс, фокус, экран и заметка</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">Запускается через центральный плюс снизу.</div>
          </div>
        </div>
        <Button
          onClick={() => setSearchParams({ flow: "full" })}
          className="mt-4 h-12 w-full rounded-2xl bg-blue-500 text-base font-semibold text-white hover:bg-blue-400"
        >
          Пройти чек-ин <ChevronRight className="ml-1 h-5 w-5" />
        </Button>
      </MobilePanel>

      <MobilePanel title="Сегодня">
        <CompactMoodSummary moodByTime={moodByTime} onSelectTime={setQuickTimeOfDay} />
      </MobilePanel>
    </div>
  );
}

function FullCheckinWizard({
  step,
  moodByTime,
  stress,
  focus,
  sleepHours,
  screenTimeHours,
  bodyTags,
  note,
  isSaving,
  onClose,
  onBack,
  onNext,
  onSubmit,
  onMoodChange,
  onEnergyChange,
  onSleepHoursChange,
  onStressChange,
  onFocusChange,
  onScreenTimeChange,
  onToggleBodyTag,
  onNoteChange
}: {
  step: number;
  moodByTime: Record<MoodTimeOfDay, MoodEnergySlot>;
  stress: number;
  focus: number;
  sleepHours: number;
  screenTimeHours: string;
  bodyTags: string[];
  note: string;
  isSaving: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onMoodChange: (value: number) => void;
  onEnergyChange: (value: number) => void;
  onSleepHoursChange: (value: number) => void;
  onStressChange: (value: number) => void;
  onFocusChange: (value: number) => void;
  onScreenTimeChange: (value: string) => void;
  onToggleBodyTag: (tag: string) => void;
  onNoteChange: (value: string) => void;
}) {
  const totalSteps = 8;
  const morning = moodByTime.morning;
  const isLast = step === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-[#080B18] text-white">
      <div className="px-5 pb-3 pt-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={step === 0 ? onClose : onBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1F3B] text-white"
            aria-label={step === 0 ? "Закрыть чек-ин" : "Назад"}
          >
            {step === 0 ? <X className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
          </button>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: totalSteps }, (_, index) => (
              <span
                key={index}
                className={`h-1 rounded-full ${index <= step ? "bg-blue-500" : "bg-[#252A4D]"} ${index === step ? "bg-white" : ""}`}
                style={{ flex: 1 }}
              />
            ))}
          </div>
          <div className="w-12 text-right text-lg font-semibold text-slate-400">{step + 1}/{totalSteps}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3">
        {step === 0 ? (
          <WizardGradientScale
            eyebrow="Шаг 1 · Настроение"
            title="Как настроение?"
            subtitle="Один штрих — задаст тон дню"
            value={morning.mood}
            onChange={onMoodChange}
            label={moodLabel(morning.mood)}
          />
        ) : null}
        {step === 1 ? (
          <WizardEnergyStep value={morning.energy} onChange={onEnergyChange} />
        ) : null}
        {step === 2 ? (
          <WizardSleepStep value={sleepHours} onChange={onSleepHoursChange} />
        ) : null}
        {step === 3 ? (
          <WizardNumberGrid
            eyebrow="Шаг 4 · Стресс"
            title="Уровень стресса?"
            subtitle="Это не оценка, это просто сигнал"
            value={stress}
            onChange={onStressChange}
            lowLabel="спокойно"
            highLabel="напряженно"
            tone="orange"
            hint={stress >= 7 ? "Высокая нагрузка. Подумай о коротком восстановлении." : "Сигнал в рабочей зоне."}
          />
        ) : null}
        {step === 4 ? (
          <WizardFocusStep value={focus} onChange={onFocusChange} />
        ) : null}
        {step === 5 ? (
          <WizardScreenStep value={screenTimeHours} onChange={onScreenTimeChange} />
        ) : null}
        {step === 6 ? (
          <WizardTagsStep selected={bodyTags} onToggle={onToggleBodyTag} />
        ) : null}
        {step === 7 ? (
          <WizardNoteStep value={note} onChange={onNoteChange} />
        ) : null}
      </div>

      <div className="px-5 pb-6 pt-1">
        <Button
          onClick={isLast ? onSubmit : onNext}
          disabled={isSaving}
          className="h-16 w-full rounded-[24px] border-2 border-white/80 bg-blue-500 text-xl font-semibold text-white shadow-[0_16px_34px_rgba(59,130,246,0.28)] hover:bg-blue-400"
        >
          {isSaving ? "Сохранение..." : isLast ? "Завершить" : <>Дальше <ChevronRight className="ml-2 h-6 w-6" /></>}
        </Button>
      </div>
    </div>
  );
}

function WizardGradientScale({
  eyebrow,
  title,
  subtitle,
  value,
  onChange,
  label
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div>
      <WizardHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mt-6 rounded-[30px] bg-[linear-gradient(135deg,#b74736_0%,#ef9b12_24%,#16c7e9_55%,#22c55e_76%,#7c75c8_100%)] p-5">
        <div className="flex min-h-44 items-center justify-center text-8xl font-black text-white">{value}</div>
      </div>
      <ScoreButtons value={value} onChange={onChange} />
      <div className="mt-4 text-center text-xl text-white">{label}</div>
    </div>
  );
}

function WizardEnergyStep({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const options = [
    { value: 2, label: "Истощен" },
    { value: 4, label: "Уставший" },
    { value: 6, label: "Норма" },
    { value: 8, label: "Бодрый" },
    { value: 10, label: "Полностью заряжен" }
  ];
  const selected = options.reduce((closest, option) => (
    Math.abs(option.value - value) < Math.abs(closest.value - value) ? option : closest
  ), options[0]);

  return (
    <div>
      <WizardHeading eyebrow="Шаг 2 · Энергия" title="Сколько энергии?" subtitle="От тяги к подушке до горы свернуть" />
      <div className="mt-10 grid grid-cols-5 gap-3">
        {options.map((option) => {
          const active = selected.value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-h-32 flex-col items-center justify-center rounded-[24px] border text-4xl transition ${
                active ? "border-emerald-400 bg-emerald-500/12 text-emerald-400 shadow-[0_20px_40px_rgba(16,185,129,0.18)]" : "border-[#293056] bg-[#1C1F3B] text-slate-600"
              }`}
            >
              ⚡
            </button>
          );
        })}
      </div>
      <div className="mt-8 rounded-[26px] border border-emerald-400/24 bg-emerald-500/8 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/18 text-2xl font-bold text-emerald-400">{selected.value}</span>
          <div>
            <div className="text-xl font-bold text-white">{selected.label}</div>
            <div className="mt-1 text-lg text-slate-400">{selected.value}/10 по шкале энергии</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardSleepStep({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <WizardHeading eyebrow="Шаг 3 · Сон" title="Как спалось?" subtitle="Часы — округлим, главное общая картина" />
      <div className="mt-8 rounded-[30px] border border-violet-300/18 bg-[#232346] p-8 text-center">
        <Moon className="mx-auto h-10 w-10 text-violet-300" />
        <div className="mt-8 text-8xl font-black text-white">{value}<span className="ml-3 text-3xl font-semibold text-slate-300">ч</span></div>
        <div className="mt-5 text-xl text-slate-400">{value >= 7 ? "В пределах нормы" : "Маловато для восстановления"}</div>
      </div>
      <div className="mt-8 grid grid-cols-7 gap-3">
        {[4, 5, 6, 7, 8, 9, 10].map((hour) => (
          <button
            key={hour}
            type="button"
            onClick={() => onChange(hour)}
            className={`h-16 rounded-2xl text-2xl font-bold ${value === hour ? "bg-violet-400 text-[#111429]" : "bg-[#1C1F3B] text-white"}`}
          >
            {hour}
          </button>
        ))}
      </div>
    </div>
  );
}

function WizardNumberGrid({
  eyebrow,
  title,
  subtitle,
  value,
  onChange,
  lowLabel,
  highLabel,
  tone,
  hint
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  tone: "orange" | "blue";
  hint: string;
}) {
  return (
    <div>
      <WizardHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mt-10 grid grid-cols-5 gap-3">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`h-24 rounded-[22px] border text-3xl font-semibold ${
              score === value
                ? tone === "orange" ? "border-orange-300 bg-orange-400 text-[#111429]" : "border-blue-300 bg-blue-500 text-white"
                : "border-[#293056] bg-[#1C1F3B] text-slate-300"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-between text-lg">
        <span className={tone === "orange" ? "text-emerald-400" : "text-slate-400"}>{lowLabel}</span>
        <span className={tone === "orange" ? "text-rose-400" : "text-slate-400"}>{highLabel}</span>
      </div>
      <div className="mt-8 rounded-[26px] border border-[#293056] bg-[#1C1F3B] p-5 text-xl leading-8 text-white">{hint}</div>
    </div>
  );
}

function WizardFocusStep({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <WizardHeading eyebrow="Шаг 5 · Концентрация" title="Насколько собран?" subtitle="Концентрация и ясность мыслей" />
      <div className="mt-10 flex justify-center">
        <div
          className="flex h-56 w-56 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#22B8D6 ${value * 10}%, #252A4D 0)` }}
        >
          <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full bg-[#080B18]">
            <div className="text-7xl font-black text-white">{value}</div>
            <div className="mt-2 text-lg uppercase text-slate-500">из 10</div>
          </div>
        </div>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mobile-range mt-10" />
      <div className="mt-2 flex justify-between text-lg text-slate-500">
        <span>рассеян</span>
        <span>в потоке</span>
      </div>
    </div>
  );
}

function WizardScreenStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = [
    { value: "1.5", label: "<2 ч", note: "мало" },
    { value: "3", label: "2-4 ч", note: "умеренно" },
    { value: "5", label: "4-6 ч", note: "много" },
    { value: "7", label: "6-8 ч", note: "очень много" },
    { value: "9", label: ">8 ч", note: "перебор" }
  ];
  return (
    <div>
      <WizardHeading eyebrow="Шаг 6 · Экранное время" title="Экранное время" subtitle="Примерно за день" />
      <div className="mt-10 space-y-4">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex h-20 w-full items-center justify-between rounded-[22px] border px-5 text-left ${
                active ? "border-white bg-white text-[#111429]" : "border-[#293056] bg-[#1C1F3B] text-white"
              }`}
            >
              <span className="text-2xl font-bold">{option.label}</span>
              <span className="text-xl text-slate-400">{option.note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WizardTagsStep({ selected, onToggle }: { selected: string[]; onToggle: (tag: string) => void }) {
  const tags = ["Все ок", "Голова", "Простуда", "Мышцы", "ЖКТ", "Поясница", "Аллергия", "Сильно устал"];
  return (
    <div>
      <WizardHeading eyebrow="Шаг 7 · Самочувствие" title="Самочувствие тела" subtitle="Если что-то беспокоит — отметь" />
      <div className="mt-10 flex flex-wrap gap-3">
        {tags.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`rounded-[22px] border px-5 py-4 text-xl ${
                active ? "border-rose-400 bg-rose-500/12 text-rose-300" : "border-[#293056] bg-transparent text-slate-300"
              }`}
            >
              {active ? "• " : ""}{tag}
            </button>
          );
        })}
      </div>
      <p className="mt-8 text-lg leading-8 text-slate-400">Можно выбрать несколько. Тренеру видна общая готовность, детали остаются у тебя.</p>
    </div>
  );
}

function WizardNoteStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const tags = ["тяжелая тренировка", "мало пил воды", "хорошо выспался", "стрессовый день", "долгая дорога"];
  return (
    <div>
      <WizardHeading eyebrow="Шаг 8 · Заметка" title="Хочешь добавить?" subtitle="Одной строкой, для себя завтрашнего" />
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 200))}
        placeholder="стрессовый день"
        className="mt-10 min-h-52 rounded-[28px] border-[#293056] bg-[#1C1F3B] p-6 text-2xl text-white placeholder:text-slate-400"
      />
      <div className="mt-4 text-lg text-slate-500">{value.length}/200</div>
      <SectionTitle title="Быстрые теги" />
      <div className="mt-4 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(value ? `${value}, ${tag}`.slice(0, 200) : tag)}
            className="rounded-[22px] border border-[#293056] bg-[#1C1F3B] px-5 py-3 text-lg text-slate-300"
          >
            + {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreButtons({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-6 grid grid-cols-10 gap-1.5">
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={`flex h-11 items-center justify-center rounded-xl text-base font-bold ${
            score === value ? "bg-white text-[#111429]" : "bg-[#1C1F3B] text-slate-300"
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}

function WizardHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-white">{title}</h1>
      <p className="mt-3 text-lg leading-7 text-slate-300">{subtitle}</p>
    </div>
  );
}

function PlayerNutrition() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const today = useTodayKey();
  const [mealType, setMealType] = useState<NutritionMealType>("breakfast");
  const [quality, setQuality] = useState<NutritionQuality>("normal");
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [satiety, setSatiety] = useState(3);
  const [hydration, setHydration] = useState(3);
  const [comment, setComment] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");

  const entriesQuery = useQuery({
    queryKey: ["mobile", "nutrition", "my", today],
    queryFn: async () => (await getMyNutritionEntries(today, today)).data.data,
    ...mobileQueryFreshness
  });
  const entries = entriesQuery.data || [];
  const goodEntries = entries.filter((entry) => entry.quality === "good").length;
  const avgHydration = entries.length
    ? Math.round((entries.reduce((sum, entry) => sum + entry.hydration, 0) / entries.length) * 10) / 10
    : null;
  const missingToday = entries.length === 0;
  const photoRequired = quality !== "skipped";

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  const mutation = useMutation({
    mutationFn: () => submitNutritionEntry({
      date: today,
      time,
      mealType,
      quality,
      satiety,
      hydration,
      comment: comment || undefined,
      photo: photoFile
    }),
    onSuccess: async () => {
      toast({ title: "Питание сохранено", description: "Запись добавлена в дневник" });
      setComment("");
      setPhotoFile(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      await queryClient.invalidateQueries({ queryKey: ["mobile", "nutrition"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Не удалось сохранить питание",
        description: getErrorMessage(error, "Проверьте данные"),
        variant: "destructive"
      });
    }
  });

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Нужна фотография", description: "Выберите изображение еды", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Фото слишком большое", description: "Максимальный размер 8MB", variant: "destructive" });
      return;
    }
    setPhotoFile(file);
  };

  const submitNutrition = () => {
    if (photoRequired && !photoFile) {
      toast({ title: "Добавьте фото еды", description: "Тренер должен видеть, что именно вы съели", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Питание" description="Что заносит игрок сегодня: приемы еды, качество и вода." />
      <PeriodTabs active="Сегодня" options={["Сегодня", "Неделя", "Месяц"]} />
      <FilterPills
        active={mealLabels[mealType]}
        options={Object.entries(mealLabels).map(([value, label]) => ({
          label,
          icon: mealVisuals[value as NutritionMealType].icon,
          onClick: () => setMealType(value as NutritionMealType)
        }))}
      />

      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={Utensils} label="Сегодня" value={`${entries.length}`} tone="amber" />
        <MetricTile icon={CheckCircle2} label="Качеств." value={entries.length ? `${Math.round((goodEntries / entries.length) * 100)}%` : "-"} tone="green" />
        <MetricTile icon={Droplets} label="Вода" value={avgHydration == null ? "-" : `${avgHydration}`} tone="sky" />
      </div>

      <AlertBanner
        tone={missingToday ? "warning" : "success"}
        text={missingToday ? "Сегодня еще нет записей питания" : `Сегодня внесено ${entries.length} записей питания`}
      />

      <MealQuickCards activeMeal={mealType} onSelect={setMealType} />

      <NutritionEntriesList entries={entries} />

      <MobilePanel title="Быстрая запись">
        <div className="space-y-4">
          <FoodPhotoPicker
            inputRef={photoInputRef}
            photoFile={photoFile}
            previewUrl={photoPreviewUrl}
            required={photoRequired}
            onPick={handlePhotoChange}
            onClear={() => {
              setPhotoFile(null);
              if (photoInputRef.current) {
                photoInputRef.current.value = "";
              }
            }}
          />
          <Segmented
            value={quality}
            options={Object.entries(qualityLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => setQuality(value as NutritionQuality)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Время">
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mobile-input" />
            </Field>
            <Field label="Прием">
              <div className="flex min-h-11 items-center rounded-2xl border border-[#293056] bg-[#171A34] px-3 text-sm font-semibold text-white">
                {mealLabels[mealType]}
              </div>
            </Field>
          </div>
          <RangeControl label="Сытость" value={satiety} onChange={setSatiety} max={5} />
          <RangeControl label="Вода" value={hydration} onChange={setHydration} max={5} />
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Комментарий по желанию"
            className="min-h-20 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
          />
        </div>
      </MobilePanel>

      <Button
        onClick={submitNutrition}
        disabled={mutation.isPending}
        className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-semibold text-white hover:bg-emerald-400"
      >
        {mutation.isPending ? "Сохранение..." : "Добавить питание"}
      </Button>
    </div>
  );
}

function PlayerMetrics() {
  const dashboardQuery = useQuery({
    queryKey: ["mobile", "dashboard", "me"],
    queryFn: getMyPlayerDashboard,
    ...mobileQueryFreshness
  });
  const dashboard = dashboardQuery.data?.data;
  const readiness = clampScore(dashboard?.scores.readiness);

  return (
    <div className="space-y-4">
      <PageHeading title="Метрики" description="Ключевые показатели без лишних таблиц." />
      <ReadinessHero title="Готовность за 7 дней" value={readiness} subtitle={dashboardQuery.isLoading ? "Загрузка..." : "Сводная оценка формы"} />
      <DashboardMini dashboard={dashboard} />
    </div>
  );
}

function useNeedsTeamSetup() {
  const { user } = useAuth();
  return Boolean(user && user.role === "staff" && user.playerType === "team" && !user.teamId);
}

function TeamSetupRequired({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <PageHeading title={title} description="Тренерский профиль ещё не привязан к команде — поэтому список игроков пуст." />
      <MobilePanel title="Нужно настроить команду">
        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <p>Создайте команду и пригласите игроков — после этого сводки заполнятся автоматически.</p>
          <ul className="ml-4 list-disc space-y-1 text-slate-400">
            <li>Откройте раздел «Команды»</li>
            <li>Нажмите «Создать команду»</li>
            <li>Скопируйте код приглашения и отправьте игрокам</li>
          </ul>
        </div>
      </MobilePanel>
    </div>
  );
}

function StaffTeam() {
  const needsTeamSetup = useNeedsTeamSetup();
  const today = useTodayKey();
  const playersQuery = useQuery({
    queryKey: ["mobile", "staff", "players"],
    queryFn: async () => (await getPlayers()).data as PlayerListItem[],
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const nutritionQuery = useQuery({
    queryKey: ["mobile", "staff", "nutrition-summary", today],
    queryFn: async () => (await getNutritionTeamSummary(today)).data,
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const players = playersQuery.data || [];
  const dashboardQueries = useQueries({
    queries: players.slice(0, 8).map((player) => {
      const id = player._id || player.id || "";
      return {
        queryKey: ["mobile", "staff", "dashboard", id],
        queryFn: () => getPlayerDashboard(id),
        enabled: Boolean(id) && !needsTeamSetup,
        ...mobileQueryFreshness
      };
    })
  });

  if (needsTeamSetup) {
    return <TeamSetupRequired title="Готовность команды" />;
  }

  const dashboards = dashboardQueries
    .map((query, index) => ({
      player: players[index],
      data: query.data?.data
    }))
    .filter((item) => item.player);

  const avgReadiness = dashboards.length
    ? Math.round(dashboards.reduce((sum, item) => sum + (item.data?.scores.readiness || 0), 0) / dashboards.length)
    : null;

  const riskPlayers = dashboards
    .filter((item) => {
      const readiness = item.data?.scores.readiness;
      return typeof readiness === "number" && readiness < 60;
    })
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <ReadinessHero title="Готовность команды" value={avgReadiness} subtitle={`${players.length} игроков в зоне видимости`} />
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={Users} label="Игроки" value={`${players.length}`} />
        <MetricTile icon={ClipboardCheck} label="Питание" value={`${nutritionQuery.data?.playersWithEntries || 0}/${nutritionQuery.data?.totalPlayers || players.length}`} />
        <MetricTile icon={ShieldAlert} label="Риск" value={`${riskPlayers.length}`} />
      </div>

      <MobilePanel title="Требуют внимания">
        {riskPlayers.length ? (
          riskPlayers.map((item) => (
            <PlayerRow
              key={item.player._id || item.player.id}
              name={item.player.name || "Игрок"}
              detail={`Готовность ${clampScore(item.data?.scores.readiness) ?? "-"}`}
              score={clampScore(item.data?.scores.readiness)}
            />
          ))
        ) : (
          <EmptyText text="Критичных просадок по readiness не найдено." />
        )}
      </MobilePanel>
    </div>
  );
}

function aggregateNutritionSummaries(summaries: NutritionTeamSummary[], fallbackDate: string): NutritionTeamSummary {
  if (!summaries.length) {
    return {
      success: true,
      date: fallbackDate,
      totalPlayers: 0,
      playersWithEntries: 0,
      totalEntries: 0,
      players: [],
      recentEntries: []
    };
  }

  const players = new Map<string, NutritionTeamSummary["players"][number]>();
  const recentEntries = summaries.flatMap((summary) => summary.recentEntries);

  for (const summary of summaries) {
    for (const player of summary.players) {
      const current = players.get(player.userId);
      players.set(player.userId, {
        ...player,
        entriesCount: (current?.entriesCount || 0) + player.entriesCount,
        goodCount: (current?.goodCount || 0) + player.goodCount,
        heavyCount: (current?.heavyCount || 0) + player.heavyCount,
        skippedCount: (current?.skippedCount || 0) + player.skippedCount,
        lastEntryAt: current?.lastEntryAt || player.lastEntryAt
      });
    }
  }

  const playersList = Array.from(players.values()).sort((left, right) => left.name.localeCompare(right.name));

  return {
    success: true,
    date: summaries[0]?.date || fallbackDate,
    totalPlayers: playersList.length,
    playersWithEntries: playersList.filter((player) => player.entriesCount > 0).length,
    totalEntries: recentEntries.length,
    players: playersList,
    recentEntries: recentEntries
      .slice()
      .sort((left, right) => {
        const leftDate = typeof left.date === "string" ? left.date.slice(0, 10) : "";
        const rightDate = typeof right.date === "string" ? right.date.slice(0, 10) : "";
        return `${rightDate} ${right.time}`.localeCompare(`${leftDate} ${left.time}`);
      })
  };
}

function buildStaffNutritionHref(period: NutritionPeriod, playerId: string, viewMode: "grid" | "list" = "grid") {
  const params = new URLSearchParams();
  params.set("period", period);
  params.set("view", viewMode);
  if (playerId !== "all") {
    params.set("player", playerId);
  }
  return `/mobile/staff/nutrition?${params.toString()}`;
}

function StaffNutrition() {
  const needsTeamSetup = useNeedsTeamSetup();
  const today = useTodayKey();
  const [searchParams] = useSearchParams();
  const periodParam = searchParams.get("period");
  const playerParam = searchParams.get("player");
  const viewParam = searchParams.get("view");
  const activePeriod: NutritionPeriod =
    periodParam === "Неделя" || periodParam === "Месяц" || periodParam === "День"
      ? periodParam
      : "День";
  const selectedPlayerId = playerParam || "all";
  const viewMode: "grid" | "list" = viewParam === "list" ? "list" : "grid";
  const periodDays = activePeriod === "День" ? 1 : activePeriod === "Неделя" ? 7 : 30;
  const periodDates = useMemo(
    () => Array.from({ length: periodDays }, (_, index) => shiftDateKey(today, -index)),
    [periodDays, today]
  );
  const summaryQueries = useQueries({
    queries: periodDates.map((date) => ({
      queryKey: ["mobile", "staff", "nutrition-summary", date],
      queryFn: async () => (await getNutritionTeamSummary(date)).data,
      enabled: !needsTeamSetup,
      ...mobileQueryFreshness
    }))
  });
  const summaries = summaryQueries
    .map((query) => query.data)
    .filter((item): item is NutritionTeamSummary => Boolean(item));
  const summary = useMemo(
    () => aggregateNutritionSummaries(summaries, today),
    [summaries, today]
  );
  const isLoading = summaryQueries.some((query) => query.isLoading);
  const isError = summaryQueries.some((query) => query.isError);
  const selectedPlayer = summary.players.find((player) => player.userId === selectedPlayerId);
  const filteredEntries = selectedPlayerId === "all"
    ? summary.recentEntries
    : summary.recentEntries.filter((entry) => entry.player?.userId === selectedPlayerId);

  if (needsTeamSetup) {
    return <TeamSetupRequired title="Питание игроков" />;
  }
  const missing = summary.players.filter((player) => player.entriesCount === 0);
  const visibleMissing = selectedPlayerId === "all"
    ? missing
    : missing.filter((player) => player.userId === selectedPlayerId);
  const periodHint = activePeriod === "День" ? "сегодня" : activePeriod === "Неделя" ? "за 7 дней" : "за 30 дней";
  const staffNutritionStatus = isLoading
    ? "Загружаем питание игроков"
    : isError
      ? "Не удалось загрузить сводку питания"
      : visibleMissing.length
        ? `${activePeriod === "День" ? "Сегодня" : "За период"} не занесли: ${visibleMissing.map((player) => player.name).slice(0, 2).join(", ")}`
        : selectedPlayer
          ? `${selectedPlayer.name}: питание внесено ${periodHint}`
          : `Все игроки внесли питание ${periodHint}`;

  return (
    <div className="space-y-4">
      <PageHeading title="Питание игроков" description="Кто заносит питание и где есть пропуски." />
      <PeriodTabs
        active={activePeriod}
        options={["День", "Неделя", "Месяц"]}
        hrefForOption={(period) => buildStaffNutritionHref(period as NutritionPeriod, selectedPlayerId, viewMode)}
        viewMode={viewMode}
        hrefForView={(nextViewMode) => buildStaffNutritionHref(activePeriod, selectedPlayerId, nextViewMode)}
      />
      <FilterPills
        active={selectedPlayerId}
        options={[
          { value: "all", label: "Все", icon: Users, href: buildStaffNutritionHref(activePeriod, "all", viewMode) },
          ...summary.players.slice(0, 8).map((player) => ({
            value: player.userId,
            label: player.name,
            icon: User,
            href: buildStaffNutritionHref(activePeriod, player.userId, viewMode)
          }))
        ]}
      />
      <NutritionTeamSummaryPanel summary={summary} />
      <AlertBanner
        tone={!visibleMissing.length && !isError ? "success" : "warning"}
        text={staffNutritionStatus}
      />
      <StaffNutritionEntries
        entries={filteredEntries}
        isLoading={isLoading}
        viewMode={viewMode}
        emptyText={activePeriod === "День" ? "Сегодня еще нет записей питания с фото." : "За выбранный период нет записей питания с фото."}
      />
      <MobilePanel title={activePeriod === "День" ? "Сегодня не внесли" : "За период не внесли"}>
        {isLoading ? (
          <EmptyText text="Загружаем список игроков..." />
        ) : isError ? (
          <EmptyText text="Нет доступа к тренерской сводке или сервер временно недоступен." />
        ) : visibleMissing.length ? (
          visibleMissing.map((player) => (
            <PlayerRow key={player.userId} name={player.name} detail={player.email} score={null} />
          ))
        ) : (
          <EmptyText text={selectedPlayer ? "У выбранного игрока есть запись питания." : "Все игроки уже внесли хотя бы одну запись."} />
        )}
      </MobilePanel>
    </div>
  );
}

function StaffAnalytics() {
  const needsTeamSetup = useNeedsTeamSetup();
  const today = useTodayKey();
  const periodDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateKey(today, -index)).reverse(),
    [today]
  );
  const sleepQuery = useQuery({
    queryKey: ["mobile", "staff", "sleep-summary", periodDates[0], periodDates[periodDates.length - 1]],
    queryFn: async () => (await getTeamSleepSummary(periodDates[0], periodDates[periodDates.length - 1])).data,
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const summaryQueries = useQueries({
    queries: periodDates.map((date) => ({
      queryKey: ["mobile", "staff", "nutrition-summary", date],
      queryFn: async () => (await getNutritionTeamSummary(date)).data,
      enabled: !needsTeamSetup,
      ...mobileQueryFreshness
    }))
  });
  const todaySummary = summaryQueries[summaryQueries.length - 1]?.data;
  const weekSummaries = summaryQueries
    .map((query) => query.data)
    .filter((item): item is NutritionTeamSummary => Boolean(item));
  const isLoading = summaryQueries.some((query) => query.isLoading);
  const isError = summaryQueries.some((query) => query.isError);

  if (needsTeamSetup) {
    return <TeamSetupRequired title="Аналитика" />;
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Аналитика" description="Заполненность, питание, сон и зоны риска по команде." />
      <NutritionTeamSummaryPanel summary={todaySummary} />
      {isError ? (
        <AlertBanner tone="warning" text="Не удалось загрузить аналитические показатели. Проверьте доступ к команде или соединение." />
      ) : null}
      <TeamSleepAnalyticsPanel summary={sleepQuery.data} isLoading={sleepQuery.isLoading} />
      <StaffAnalyticsCharts
        todaySummary={todaySummary}
        weekSummaries={weekSummaries}
        periodDates={periodDates}
        isLoading={isLoading}
      />
    </div>
  );
}

function StaffPlayers() {
  const needsTeamSetup = useNeedsTeamSetup();
  const today = useTodayKey();
  const [searchParams] = useSearchParams();
  const periodDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDateKey(today, -index)).reverse(),
    [today]
  );
  const playersQuery = useQuery({
    queryKey: ["mobile", "staff", "players"],
    queryFn: async () => (await getPlayers()).data as PlayerListItem[],
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const nutritionQuery = useQuery({
    queryKey: ["mobile", "staff", "players", "nutrition-summary", today],
    queryFn: async () => (await getNutritionTeamSummary(today)).data,
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const sleepQuery = useQuery({
    queryKey: ["mobile", "staff", "players", "sleep-summary", periodDates[0], periodDates[periodDates.length - 1]],
    queryFn: async () => (await getTeamSleepSummary(periodDates[0], periodDates[periodDates.length - 1])).data,
    enabled: !needsTeamSetup,
    ...mobileQueryFreshness
  });
  const players = playersQuery.data || [];
  const requestedPlayerId = searchParams.get("player") || "";
  const focusedPlayerId = players.some((player) => (player._id || player.id) === requestedPlayerId)
    ? requestedPlayerId
    : players[0]?._id || players[0]?.id || "";
  const focusedPlayer = players.find((player) => (player._id || player.id) === focusedPlayerId);
  const focusedDashboardQuery = useQuery({
    queryKey: ["mobile", "staff", "players", "dashboard", focusedPlayerId],
    queryFn: () => getPlayerDashboard(focusedPlayerId),
    enabled: Boolean(focusedPlayerId && !needsTeamSetup),
    ...mobileQueryFreshness
  });
  const nutritionByPlayer = new Map(
    (nutritionQuery.data?.players || []).map((player) => [player.userId, player])
  );
  const focusedNutrition = nutritionByPlayer.get(focusedPlayerId);
  const focusedSleep = sleepQuery.data?.players.find((player) => player.userId === focusedPlayerId);
  const playersWithNutrition = players.filter((player) => {
    const playerId = player._id || player.id || "";
    return (nutritionByPlayer.get(playerId)?.entriesCount || 0) > 0;
  }).length;
  const missingNutrition = Math.max(players.length - playersWithNutrition, 0);
  const completedTests = players.filter((player) => player.completedTests).length;
  const completedBalanceWheel = players.filter((player) => player.completedBalanceWheel).length;
  const attentionPlayers = players.filter((player) => {
    const playerId = player._id || player.id || "";
    const nutrition = nutritionByPlayer.get(playerId);
    return !player.completedTests || !player.completedBalanceWheel || !nutrition?.entriesCount;
  });

  if (needsTeamSetup) {
    return <TeamSetupRequired title="Игроки" />;
  }

  return (
    <div className="space-y-4">
      <PageHeading title="Игроки" description="Состав, готовность данных и быстрые сигналы по каждому игроку." />
      <div className="grid grid-cols-3 gap-3">
        <MetricTile icon={Users} label="В команде" value={`${players.length}`} tone="blue" />
        <MetricTile icon={Utensils} label="Питание" value={`${playersWithNutrition}/${players.length || "-"}`} tone={missingNutrition ? "amber" : "green"} />
        <MetricTile icon={ShieldAlert} label="Внимание" value={`${attentionPlayers.length}`} tone={attentionPlayers.length ? "red" : "green"} />
      </div>
      <MobilePanel title="Паспорт данных">
        <div className="space-y-3">
          <TeamDataProgress label="Питание сегодня" value={playersWithNutrition} total={players.length} tone={missingNutrition ? "amber" : "green"} />
          <TeamDataProgress label="Тесты пройдены" value={completedTests} total={players.length} tone={completedTests === players.length ? "green" : "amber"} />
          <TeamDataProgress label="Колесо баланса" value={completedBalanceWheel} total={players.length} tone={completedBalanceWheel === players.length ? "green" : "amber"} />
        </div>
      </MobilePanel>
      <MobilePanel title="Требуют внимания">
        {playersQuery.isLoading || nutritionQuery.isLoading ? (
          <EmptyText text="Загружаем статусы игроков..." />
        ) : attentionPlayers.length ? (
          <div className="space-y-3">
            {attentionPlayers.slice(0, 4).map((player) => {
              const playerId = player._id || player.id || "";
              const nutrition = nutritionByPlayer.get(playerId);
              const reasons = [
                !nutrition?.entriesCount ? "нет питания" : "",
                !player.completedTests ? "нет тестов" : "",
                !player.completedBalanceWheel ? "нет баланса" : ""
              ].filter(Boolean);

              return (
                <Link
                  key={playerId || player.email}
                  to={`/mobile/staff/players?player=${encodeURIComponent(playerId)}`}
                  className="flex items-center gap-3 rounded-2xl border border-amber-400/16 bg-amber-500/10 p-3 transition hover:border-amber-300/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/16 text-sm font-bold text-amber-100">
                    {(player.name || "И").slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{player.name || "Игрок"}</div>
                    <div className="mt-0.5 truncate text-xs text-amber-100/80">{reasons.join(" · ")}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-amber-100/70" />
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyText text="Все игроки закрыли ключевые статусы на сегодня." />
        )}
      </MobilePanel>
      <FocusedPlayerAnalytics
        players={players}
        focusedPlayerId={focusedPlayerId}
        focusedPlayer={focusedPlayer}
        dashboard={focusedDashboardQuery.data?.data}
        nutrition={focusedNutrition}
        sleep={focusedSleep}
        isLoading={playersQuery.isLoading || focusedDashboardQuery.isLoading}
      />
      <MobilePanel title="Состав">
        {players.length ? (
          <div className="space-y-3">
            {players.map((player) => {
              const playerId = player._id || player.id || "";
              const hasAttention = attentionPlayers.some((attentionPlayer) => (attentionPlayer._id || attentionPlayer.id) === playerId);
              return (
                <StaffPlayerCard
                  key={playerId || player.email}
                  player={player}
                  isSelected={playerId === focusedPlayerId}
                  hasAttention={hasAttention}
                />
              );
            })}
          </div>
        ) : (
          <EmptyText text={playersQuery.isLoading ? "Загружаем игроков..." : "Игроков пока нет."} />
        )}
      </MobilePanel>
    </div>
  );
}

function TeamDataProgress({
  label,
  value,
  total,
  tone
}: {
  label: string;
  value: number;
  total: number;
  tone: "green" | "amber";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const toneClass = tone === "green" ? "from-emerald-400 to-cyan-300" : "from-amber-400 to-orange-400";

  return (
    <div className="rounded-2xl border border-[#293056] bg-[#11142B]/72 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="text-sm font-bold text-slate-200">{value}/{total || "-"}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneClass} shadow-[0_0_16px_rgba(96,165,250,0.22)]`}
          style={{ width: `${Math.max(percent, percent ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function StaffPlayerCard({
  player,
  isSelected,
  hasAttention
}: {
  player: PlayerListItem;
  isSelected: boolean;
  hasAttention: boolean;
}) {
  const playerId = player._id || player.id || "";
  const joinedAt = player.createdAt
    ? new Date(player.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
    : "—";
  const playerTypeLabel = player.playerType === "team" ? "команда" : player.playerType === "solo" ? "соло" : "игрок";

  return (
    <Link
      to={`/mobile/staff/players?player=${encodeURIComponent(playerId)}`}
      className={`flex items-center gap-3 rounded-[22px] border p-3 transition ${
        isSelected
          ? "border-blue-300/55 bg-blue-500/14 shadow-[0_0_0_1px_rgba(147,197,253,0.12)]"
          : "border-[#293056] bg-[#11142B]/72 hover:border-blue-300/24"
      }`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
        hasAttention ? "bg-amber-400/16 text-amber-100" : "bg-emerald-400/16 text-emerald-100"
      }`}>
        {(player.name || "И").slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-bold text-white">{player.name || "Игрок"}</div>
          {isSelected ? (
            <span className="shrink-0 rounded-full bg-blue-400/16 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-blue-100">
              фокус
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-400">{player.email || "email не указан"}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="text-slate-500">{playerTypeLabel}</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className={hasAttention ? "text-amber-200" : "text-emerald-200"}>
            {hasAttention ? "есть задачи" : "готов"}
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="text-slate-500">с {joinedAt}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
    </Link>
  );
}

function FocusedPlayerAnalytics({
  players,
  focusedPlayerId,
  focusedPlayer,
  dashboard,
  nutrition,
  sleep,
  isLoading
}: {
  players: PlayerListItem[];
  focusedPlayerId: string;
  focusedPlayer?: PlayerListItem;
  dashboard?: PlayerDashboardData;
  nutrition?: NutritionTeamSummary["players"][number];
  sleep?: TeamSleepSummary["players"][number];
  isLoading: boolean;
}) {
  const readiness = clampScore(dashboard?.scores.readiness);
  const performance = clampScore(dashboard?.scores.performance);
  const discipline = clampScore(dashboard?.scores.discipline);
  const success = clampScore(dashboard?.scores.success);
  const brain = clampScore(dashboard?.scores.brainPerformance);
  const avatarUrl = getImageUrl(dashboard?.player?.avatar || "");
  const name = dashboard?.player?.nickname || dashboard?.player?.name || focusedPlayer?.name || "Игрок";
  const email = dashboard?.player?.email || focusedPlayer?.email || "";
  const nutritionCount = nutrition?.entriesCount || 0;
  const sleepStatus = sleep?.status || "missing";
  const sleepTone: "green" | "amber" | "red" = sleepStatus === "ok" ? "green" : sleepStatus === "missing" ? "amber" : "red";
  const readinessLabelText = readiness == null ? "Нет данных" : readinessLabel(readiness);
  const topDrivers = (dashboard?.drivers || []).slice(0, 3);

  return (
    <MobilePanel title="Игрок в фокусе">
      {players.length ? (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Выбор игрока</span>
            <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-slate-400">
              {players.length} в составе
            </span>
          </div>
          <div className="relative -mx-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-[#20264D] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#20264D] to-transparent" />
            <div className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max snap-x snap-mandatory gap-2">
                {players.map((player) => {
                  const playerId = player._id || player.id || "";
                  const selected = playerId === focusedPlayerId;
                  return (
                    <Link
                      key={playerId || player.email}
                      to={`/mobile/staff/players?player=${encodeURIComponent(playerId)}`}
                      className={`flex min-h-12 w-36 shrink-0 snap-start items-center gap-2 rounded-2xl border px-3 transition ${
                        selected
                          ? "border-blue-300/70 bg-blue-500/18 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.12),0_10px_24px_rgba(59,130,246,0.12)]"
                          : "border-[#293056] bg-[#11142B]/80 text-slate-300"
                      }`}
                      title={player.name || "Игрок"}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                        selected ? "bg-blue-400/24 text-blue-100" : "bg-white/[0.06] text-slate-300"
                      }`}>
                        {(player.name || "И").slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">{player.name || "Игрок"}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading && !dashboard ? (
        <EmptyText text="Загружаем индивидуальные показатели..." />
      ) : focusedPlayerId ? (
        <article className="overflow-hidden rounded-[26px] border border-blue-300/14 bg-[radial-gradient(circle_at_85%_0%,rgba(96,165,250,0.18),transparent_34%),linear-gradient(145deg,rgba(25,31,66,0.98),rgba(15,19,43,0.94))] shadow-[0_18px_42px_rgba(2,8,23,0.26),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="p-4">
            <div className="flex items-start gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-400/16 text-lg font-black text-blue-100">
                  {name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-black tracking-[-0.02em] text-white">{name}</div>
                <div className="truncate text-xs text-slate-400">{email}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">
                    Readiness {readiness ?? "-"}
                  </span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-slate-300">
                    {readinessLabelText}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ScoreBox label="Игра" value={performance} />
              <ScoreBox label="Дисциплина" value={discipline} />
              <ScoreBox label="Успехи" value={success} />
              <ScoreBox label="Когнитивка" value={brain} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <AnalyticsSignal label="Питание" value={nutritionCount ? `${nutritionCount}` : "нет"} tone={nutritionCount ? "green" : "amber"} />
              <AnalyticsSignal label="Сон" value={sleep?.latestHours != null ? `${sleep.latestHours}ч` : "нет"} tone={sleepTone} />
              <AnalyticsSignal label="Форма" value={readiness ?? "-"} tone={readiness == null ? "amber" : readiness >= 70 ? "green" : readiness >= 55 ? "amber" : "red"} />
            </div>

            <div className="mt-5">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">7 дней readiness</div>
              <div className="flex h-20 items-end gap-2">
                {(dashboard?.timeline.days7 || []).map((point) => {
                  const value = clampScore(point.readiness);
                  return (
                    <div key={point.date} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex h-14 w-full items-end rounded-2xl border border-white/[0.06] bg-[#11142B] p-1">
                        <div
                          className="w-full rounded-xl"
                          style={{
                            height: `${Math.max(value || 0, value ? 12 : 4)}%`,
                            backgroundColor: scoreColor(value)
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(`${point.date}T00:00:00`).getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {topDrivers.length ? (
            <div className="border-t border-[#293056] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ключевые драйверы</div>
              <div className="space-y-2">
                {topDrivers.map((driver) => (
                  <div key={driver.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] px-3 py-2">
                    <span className="min-w-0 truncate text-xs text-slate-300">{driver.label}</span>
                    <span className="text-xs font-bold" style={{ color: scoreColor(clampScore(driver.value)) }}>{clampScore(driver.value) ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ) : (
        <EmptyText text="Добавьте игроков в команду, чтобы видеть индивидуальную аналитику." />
      )}
    </MobilePanel>
  );
}

function TeamSleepAnalyticsPanel({
  summary,
  isLoading
}: {
  summary?: TeamSleepSummary;
  isLoading: boolean;
}) {
  if (isLoading && !summary) {
    return (
      <MobilePanel title="Сон команды">
        <EmptyText text="Загружаем сон игроков..." />
      </MobilePanel>
    );
  }

  const avgSleep = summary?.averageSleep ?? null;
  const totalPlayers = summary?.totalPlayers || 0;
  const playersWithSleep = summary?.playersWithSleep || 0;
  const sleepCompletion = totalPlayers ? Math.round((playersWithSleep / totalPlayers) * 100) : 0;
  const lowSleepCount = summary?.lowSleepCount || 0;
  const highSleepCount = summary?.highSleepCount || 0;
  const missingSleepCount = summary?.missingSleepCount || 0;
  const riskCount = lowSleepCount + highSleepCount;
  const statusText = avgSleep == null
    ? "Нет данных"
    : avgSleep < 6.5
      ? "Недосып"
      : avgSleep > 9
        ? "Пересып"
        : "В норме";
  const statusTone: "green" | "amber" | "red" = avgSleep == null
    ? "amber"
    : avgSleep < 6 || avgSleep > 9.5
      ? "red"
      : avgSleep < 6.5 || avgSleep > 9
        ? "amber"
        : "green";
  const maxSleep = Math.max(...(summary?.days || []).map((day) => day.avgSleep || 0), 9);
  const riskPlayers = (summary?.players || [])
    .filter((player) => player.status === "low" || player.status === "high" || player.status === "missing")
    .slice()
    .sort((left, right) => {
      const order = { low: 0, high: 1, missing: 2, ok: 3 };
      return order[left.status] - order[right.status];
    })
    .slice(0, 3);

  return (
    <MobilePanel title="Сон команды">
      <div className="overflow-hidden rounded-[26px] border border-violet-300/14 bg-[radial-gradient(circle_at_20%_10%,rgba(167,139,250,0.24),transparent_34%),linear-gradient(145deg,rgba(25,28,61,0.98),rgba(15,18,42,0.94))] p-4 shadow-[0_18px_42px_rgba(2,8,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-violet-300/16 bg-violet-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="absolute inset-4 rounded-full bg-violet-400/18 blur-xl" />
            <Moon className="relative h-9 w-9 text-violet-200" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Средний сон</div>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-black tracking-[-0.05em] text-white">{avgSleep ?? "-"}</span>
              <span className="mb-1.5 text-sm font-bold text-slate-400">ч</span>
            </div>
            <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              statusTone === "green"
                ? "bg-emerald-500/12 text-emerald-200"
                : statusTone === "red"
                  ? "bg-rose-500/12 text-rose-200"
                  : "bg-amber-500/12 text-amber-200"
            }`}>
              {statusText}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <AnalyticsSignal label="Внесли" value={`${playersWithSleep}/${totalPlayers || "-"}`} tone={missingSleepCount ? "amber" : "green"} />
          <AnalyticsSignal label="Риск" value={`${riskCount}`} tone={riskCount ? "red" : "green"} />
          <AnalyticsSignal label="Нет сна" value={`${missingSleepCount}`} tone={missingSleepCount ? "amber" : "green"} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">7 дней</span>
            <span className="text-[10px] font-semibold text-slate-500">{sleepCompletion}% заполнено</span>
          </div>
          <div className="flex h-20 items-end gap-2">
            {(summary?.days || []).map((day) => {
              const value = day.avgSleep || 0;
              const good = value >= 6.5 && value <= 9;
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-14 w-full items-end rounded-2xl border border-white/[0.06] bg-[#11142B] p-1">
                    <div
                      className={`w-full rounded-xl ${good ? "bg-[linear-gradient(180deg,#A78BFA,#60A5FA)]" : "bg-[linear-gradient(180deg,#FBBF24,#F97316)]"}`}
                      style={{ height: `${Math.max((value / maxSleep) * 100, value ? 12 : 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{new Date(`${day.date}T00:00:00`).getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {riskPlayers.length ? (
        <div className="mt-3 space-y-2">
          {riskPlayers.map((player) => (
            <div key={player.userId} className="flex items-center gap-3 rounded-2xl border border-[#293056] bg-[#11142B]/70 p-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${
                player.status === "low" ? "bg-rose-500/14 text-rose-200" : "bg-amber-500/14 text-amber-200"
              }`}>
                {player.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{player.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {player.status === "missing"
                    ? "нет записи сна"
                    : `${player.latestHours} ч · ${player.status === "low" ? "мало сна" : "много сна"}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </MobilePanel>
  );
}

function StaffAnalyticsCharts({
  todaySummary,
  weekSummaries,
  periodDates,
  isLoading
}: {
  todaySummary?: NutritionTeamSummary;
  weekSummaries: NutritionTeamSummary[];
  periodDates: string[];
  isLoading: boolean;
}) {
  const totalPlayers = todaySummary?.totalPlayers || 0;
  const filledPlayers = todaySummary?.playersWithEntries || 0;
  const missingPlayers = Math.max(totalPlayers - filledPlayers, 0);
  const completion = totalPlayers > 0 ? Math.round((filledPlayers / totalPlayers) * 100) : 0;
  const heavyEntries = todaySummary?.recentEntries.filter((entry) => entry.quality === "heavy").length || 0;
  const skippedEntries = todaySummary?.recentEntries.filter((entry) => entry.quality === "skipped").length || 0;
  const goodEntries = todaySummary?.recentEntries.filter((entry) => entry.quality === "good").length || 0;
  const riskEntries = heavyEntries + skippedEntries;
  const riskLevel = riskEntries > 0 || missingPlayers > 0 ? "Нужно внимание" : "Стабильно";
  const sparkData = periodDates.map((date) => {
    const summary = weekSummaries.find((item) => item.date === date);
    return {
      date,
      entries: summary?.totalEntries || 0,
      completion: summary && summary.totalPlayers > 0 ? Math.round((summary.playersWithEntries / summary.totalPlayers) * 100) : 0
    };
  });
  const maxEntries = Math.max(...sparkData.map((point) => point.entries), 1);
  const weeklyAverage = sparkData.length
    ? Math.round(sparkData.reduce((sum, point) => sum + point.completion, 0) / sparkData.length)
    : 0;

  if (isLoading && !todaySummary) {
    return (
      <MobilePanel title="Диаграммы">
        <EmptyText text="Загружаем диаграммные показатели..." />
      </MobilePanel>
    );
  }

  return (
    <>
      <MobilePanel title="Картина дня">
        <div className="overflow-hidden rounded-[26px] border border-blue-300/12 bg-[radial-gradient(circle_at_20%_0%,rgba(96,165,250,0.22),transparent_34%),linear-gradient(145deg,rgba(25,31,66,0.98),rgba(15,19,43,0.94))] p-4 shadow-[0_18px_42px_rgba(2,8,23,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-4">
            <RadialProgress value={completion} label="готовность" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Питание сегодня</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                {completion >= 80 ? "Почти закрыто" : completion > 0 ? "Идет сбор" : "Нет данных"}
              </div>
              <div className="mt-2 text-sm leading-5 text-slate-300">
                {filledPlayers} из {totalPlayers || 0} игроков внесли питание
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#34D399,#60A5FA)] shadow-[0_0_18px_rgba(96,165,250,0.45)]"
                  style={{ width: `${Math.max(completion, completion ? 8 : 0)}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <AnalyticsSignal label="Внесли" value={`${filledPlayers}/${totalPlayers || "-"}`} tone="green" />
            <AnalyticsSignal label="Нет" value={`${missingPlayers}`} tone={missingPlayers ? "amber" : "green"} />
            <AnalyticsSignal label="Риск" value={`${riskEntries}`} tone={riskEntries ? "red" : "green"} />
          </div>
        </div>
      </MobilePanel>

      <MobilePanel title="Распределение">
        <StackedStatusBar
          items={[
            { label: "Внесли", value: filledPlayers, colorClass: "bg-emerald-400" },
            { label: "Пропуск", value: missingPlayers, colorClass: "bg-amber-400" },
            { label: "Риск", value: riskEntries, colorClass: "bg-rose-400" }
          ]}
          total={Math.max(totalPlayers + riskEntries, 1)}
        />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <CompactStat label="Хорошо" value={goodEntries} tone="green" />
          <CompactStat label="Тяжело" value={heavyEntries} tone="amber" />
          <CompactStat label="Пропуск" value={skippedEntries} tone="red" />
        </div>
      </MobilePanel>

      <MobilePanel title="7 дней">
        <div className="flex h-28 items-end gap-2">
          {sparkData.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-20 w-full items-end rounded-2xl border border-[#293056] bg-[#11142B] p-1">
                <div
                  className="w-full rounded-xl bg-[linear-gradient(180deg,#38BDF8,#3B82F6)] shadow-[0_0_18px_rgba(56,189,248,0.28)]"
                  style={{ height: `${Math.max((point.entries / maxEntries) * 100, point.entries ? 12 : 4)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">{new Date(`${point.date}T00:00:00`).getDate()}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <CompactStat label="Средняя заполненность" value={`${weeklyAverage}%`} tone={weeklyAverage >= 70 ? "green" : "amber"} />
          <CompactStat label="Статус" value={riskLevel} tone={riskEntries || missingPlayers ? "amber" : "green"} />
        </div>
      </MobilePanel>
    </>
  );
}

function MobileProfile({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const today = useTodayKey();
  const isPlayer = user?.role !== "staff";
  const dashboardQuery = useQuery({
    queryKey: ["mobile", "profile", "dashboard", user?.id],
    queryFn: getMyPlayerDashboard,
    enabled: Boolean(user?.id && isPlayer),
    ...mobileQueryFreshness
  });
  const statusQuery = useQuery({
    queryKey: ["mobile", "profile", "daily-status", today],
    queryFn: async () => (await getDailyQuestionnaireStatus(today)).data,
    enabled: Boolean(user?.id && isPlayer),
    ...mobileQueryFreshness
  });
  const nutritionQuery = useQuery({
    queryKey: ["mobile", "profile", "nutrition", today],
    queryFn: async () => (await getMyNutritionEntries(today, today)).data.data,
    enabled: Boolean(user?.id && isPlayer),
    ...mobileQueryFreshness
  });

  const dashboard = dashboardQuery.data?.data;
  const avatarUrl = getImageUrl(user?.avatar || dashboard?.player?.avatar || "");
  const displayName = dashboard?.player?.nickname || user?.name || "Пользователь";
  const readiness = clampScore(dashboard?.scores.readiness);
  const performance = clampScore(dashboard?.scores.performance);
  const brain = clampScore(dashboard?.scores.brainPerformance);
  const meals = nutritionQuery.data || [];
  const completedToday = Boolean(statusQuery.data?.completed);
  const subscription = user?.subscription;
  const subscriptionLabel = subscription?.planName
    ? `${subscription.planName}${subscription.status ? ` · ${subscription.status}` : ""}`
    : user?.hasPerformanceCoachCrmAccess
      ? "Доступ активен"
      : "Не подключена";
  const createdAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("ru-RU") : null;

  return (
    <div className="space-y-4">
      <PageHeading title="Профиль" description="Аккаунт, команда, доступы и актуальные показатели." />

      <section className="relative overflow-hidden rounded-[28px] border border-[#293056] bg-[linear-gradient(145deg,rgba(35,39,72,0.96),rgba(24,36,68,0.9))] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-blue-400/14 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,#5B82FF,#8B5CF6)] text-3xl font-black text-white shadow-[0_18px_42px_rgba(59,130,246,0.28)]">
            {avatarUrl ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-black tracking-[-0.04em] text-white">{displayName}</div>
            <div className="mt-1 truncate text-sm text-slate-300">{user?.email || dashboard?.player?.email || "email не указан"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-300/20 bg-blue-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100">
                {user?.role === "staff" ? "тренер" : "игрок"}
              </span>
              {user?.playerType ? (
                <span className="rounded-full border border-violet-300/20 bg-violet-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-100">
                  {user.playerType === "team" ? "командный игрок" : "соло"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isPlayer ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricTile icon={Activity} label="Readiness" value={readiness == null ? "-" : `${readiness}`} tone="amber" />
          <MetricTile icon={BarChart3} label="Performance" value={performance == null ? "-" : `${performance}`} tone="blue" />
          <MetricTile icon={Brain} label="Brain" value={brain == null ? "-" : `${brain}`} tone="sky" />
        </div>
      ) : null}

      <MobilePanel title="Аккаунт">
        <div className="space-y-3">
          <ProfileInfoRow label="Имя" value={user?.name || "Не указано"} />
          <ProfileInfoRow label="Email" value={user?.email || "Не указан"} />
          <ProfileInfoRow label="Команда" value={user?.teamName || "Не привязана"} />
          <ProfileInfoRow label="Подписка" value={subscriptionLabel} />
          <ProfileInfoRow label="Дата регистрации" value={createdAt || "Нет данных"} last />
        </div>
      </MobilePanel>

      {isPlayer ? (
        <MobilePanel title="Сегодня">
          <StatusRow done={completedToday} label="Чек-ин" hint={completedToday ? "заполнен сегодня" : "еще не заполнен"} />
          <StatusRow done={meals.length > 0} label="Питание" hint={meals.length ? `${meals.length} записей сегодня` : "нет записей"} />
          <StatusRow done={brain != null} label="Когнитивный профиль" hint={brain != null ? `Brain ${brain}/100` : "нужен первый тест"} last />
        </MobilePanel>
      ) : null}

      <MobilePanel title="Доступы">
        <div className="grid grid-cols-2 gap-2">
          <AccessPill active={Boolean(user?.hasPerformanceCoachCrmAccess)} label="Performance CRM" />
          <AccessPill active={Boolean(user?.hasCorrelationAnalysisAccess)} label="Корреляции" />
          <AccessPill active={Boolean(user?.hasGameStatsAccess)} label="Game stats" />
          <AccessPill active={Boolean(user?.baselineAssessmentCompleted)} label="Baseline" />
        </div>
      </MobilePanel>

      <Button asChild className="h-12 w-full rounded-2xl bg-blue-500 text-white hover:bg-blue-400">
        <Link to="/">Открыть веб-кабинет</Link>
      </Button>
      <Button onClick={onLogout} variant="outline" className="h-12 w-full rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/10">
        Выйти
      </Button>
    </div>
  );
}

function ProfileInfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 pb-3 ${last ? "pb-0" : "border-b border-[#293056]"}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="max-w-[62%] text-right text-sm font-semibold leading-5 text-slate-100">{value}</div>
    </div>
  );
}

function AccessPill({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
      active
        ? "border-emerald-400/22 bg-emerald-500/12 text-emerald-100"
        : "border-[#293056] bg-[#171A34] text-slate-500"
    }`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" : "bg-slate-600"}`} />
        <span className="min-w-0 truncate">{label}</span>
      </div>
    </div>
  );
}

function ReadinessHero({ title, value, subtitle }: { title: string; value: number | null; subtitle: string }) {
  const color = scoreColor(value);
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#293056] bg-[radial-gradient(circle_at_82%_22%,rgba(245,158,11,0.18),transparent_34%),linear-gradient(145deg,rgba(35,39,72,0.96),rgba(28,31,59,0.88))] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="flex items-center gap-5">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-[10px] border-[#293056]" style={{ borderTopColor: color, borderLeftColor: value == null ? "#293056" : `${color}88` }}>
          <span className="text-4xl font-bold leading-none tracking-[-0.06em]" style={{ color }}>{value ?? "-"}</span>
          <span className="absolute bottom-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">балл</span>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</div>
          <div className="mt-2 text-xl font-bold tracking-[-0.02em] text-white">{value == null ? "Нет данных" : readinessLabel(value)}</div>
          <p className="mt-2 text-sm leading-5 text-slate-300">{subtitle}</p>
          <svg className="mt-4 h-9 w-full text-amber-400" viewBox="0 0 160 42" fill="none" aria-hidden="true">
            <path d="M2 31L26 20L48 30L74 18L98 9L124 24L158 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 31L26 20L48 30L74 18L98 9L124 24L158 28V42H2V31Z" fill="url(#mobileHeroSpark)" opacity="0.24" />
            <defs>
              <linearGradient id="mobileHeroSpark" x1="80" x2="80" y1="9" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </section>
  );
}

function DashboardMini({ dashboard }: { dashboard?: PlayerDashboardData }) {
  if (!dashboard) {
    return <MobilePanel title="Данные"><EmptyText text="Показатели пока загружаются или недоступны." /></MobilePanel>;
  }

  return (
    <MobilePanel title="Сводка">
      <div className="grid grid-cols-2 gap-3">
        <ScoreBox label="Игра" value={dashboard.scores.performance} />
        <ScoreBox label="Дисциплина" value={dashboard.scores.discipline} />
        <ScoreBox label="Успехи" value={dashboard.scores.success} />
        <ScoreBox label="Голова" value={dashboard.scores.brainPerformance} />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">7 дней</div>
        <div className="flex h-20 items-end gap-2">
          {dashboard.timeline.days7.map((point) => {
            const value = clampScore(point.readiness);
            return (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-blue-400/70"
                  style={{ height: `${Math.max(value || 8, 8)}%`, backgroundColor: scoreColor(value) }}
                />
                <span className="text-[10px] text-slate-500">{new Date(point.date).getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </MobilePanel>
  );
}

function NutritionEntriesList({ entries }: { entries: NutritionEntry[] }) {
  return (
    <MobilePanel title="Сегодня">
      {entries.length ? (
        <div className="grid grid-cols-2 gap-3">
          {entries.map((entry) => (
            <MealCard key={entry._id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-[#293056] bg-[#171A34] p-5 text-sm leading-6 text-slate-400">
          Питание сегодня еще не внесено. Добавьте первый прием пищи, чтобы команда видела заполненность дня.
        </div>
      )}
    </MobilePanel>
  );
}

function FoodPhotoPicker({
  inputRef,
  photoFile,
  previewUrl,
  required,
  onPick,
  onClear
}: {
  inputRef: RefObject<HTMLInputElement>;
  photoFile: File | null;
  previewUrl: string;
  required: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-[#293056] bg-[#171A34] p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onPick(event.target.files?.[0])}
      />
      {photoFile && previewUrl ? (
        <div className="relative overflow-hidden rounded-[18px]">
          <img src={previewUrl} alt="Фото еды" className="h-44 w-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
            aria-label="Удалить фото"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <div className="truncate text-sm font-semibold text-white">{photoFile.name}</div>
            <div className="text-xs text-white/70">{(photoFile.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-blue-300/30 bg-blue-500/8 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/18 text-blue-200">
            <Camera className="h-6 w-6" />
          </span>
          <span className="text-sm font-bold text-white">{required ? "Прикрепить фото еды" : "Фото не обязательно"}</span>
          <span className="max-w-56 text-xs leading-5 text-slate-400">Камера или галерея. Команда увидит фото в записи питания.</span>
        </button>
      )}
    </div>
  );
}

function StaffNutritionEntries({
  entries,
  isLoading,
  viewMode = "grid",
  emptyText = "Сегодня еще нет записей питания с фото."
}: {
  entries: NutritionTeamSummary["recentEntries"];
  isLoading: boolean;
  viewMode?: "grid" | "list";
  emptyText?: string;
}) {
  return (
    <MobilePanel title="Записи игроков">
      {isLoading ? (
        <EmptyText text="Загружаем записи питания..." />
      ) : entries.length ? (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {entries.slice(0, 8).map((entry) => (
            <StaffNutritionEntryCard key={entry._id} entry={entry} />
          ))}
        </div>
      ) : (
        <EmptyText text={emptyText} />
      )}
    </MobilePanel>
  );
}

function StaffNutritionEntryCard({ entry }: { entry: NutritionTeamSummary["recentEntries"][number] }) {
  const photoUrl = getImageUrl(entry.photoUrl);
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#293056] bg-[#171A34]">
      {photoUrl ? (
        <img src={photoUrl} alt={`Фото питания ${entry.player?.name || "игрока"}`} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center bg-white/[0.04] text-slate-500">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{entry.player?.name || "Игрок"}</div>
            <div className="mt-1 text-xs text-slate-400">{entry.time} · {mealLabels[entry.mealType]} · {qualityLabels[entry.quality]}</div>
          </div>
          <span className="rounded-full bg-blue-500/14 px-2 py-1 text-[10px] font-bold text-blue-200">
            Вода {entry.hydration}/5
          </span>
        </div>
        {entry.comment ? <p className="mt-3 text-sm leading-5 text-slate-300">{entry.comment}</p> : null}
      </div>
    </article>
  );
}

function PeriodTabs({
  active,
  options,
  onChange,
  hrefForOption,
  viewMode = "grid",
  hrefForView
}: {
  active: string;
  options: string[];
  onChange?: (option: string) => void;
  hrefForOption?: (option: string) => string;
  viewMode?: "grid" | "list";
  hrefForView?: (viewMode: "grid" | "list") => string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[20px] border border-[#293056] bg-[#101329]/82 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="grid flex-1 grid-cols-3 gap-1">
        {options.map((option) => {
          const className = `flex min-h-10 items-center justify-center rounded-2xl text-sm font-semibold transition ${
            option === active ? "bg-[#2B315D] text-white shadow-[0_10px_22px_rgba(0,0,0,0.22)]" : "text-slate-400"
          }`;

          return hrefForOption ? (
            <Link key={option} to={hrefForOption(option)} className={className}>
              {option}
            </Link>
          ) : (
            <button
              key={option}
              type="button"
              onClick={() => onChange?.(option)}
              disabled={!onChange && option !== active}
              className={className}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1 border-l border-[#293056] pl-1.5">
        <Link
          to={hrefForView?.("grid") || "."}
          aria-label="Показать плиткой"
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${viewMode === "grid" ? "bg-blue-500/14 text-blue-200" : "text-slate-500"}`}
        >
          <Grid2X2 className="h-4 w-4" />
        </Link>
        <Link
          to={hrefForView?.("list") || "."}
          aria-label="Показать списком"
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${viewMode === "list" ? "bg-blue-500/14 text-blue-200" : "text-slate-500"}`}
        >
          <List className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function FilterPills({
  active,
  options
}: {
  active: string;
  options: { value?: string; label: string; icon: ComponentType<{ className?: string }>; onClick?: () => void; href?: string }[];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const optionValue = option.value || option.label;
          const selected = optionValue === active;
          const className = `flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
            selected
              ? "border-blue-400/70 bg-blue-500/16 text-white shadow-[0_0_0_1px_rgba(96,165,250,0.12)]"
              : "border-[#293056] bg-[#171A34]/86 text-slate-300"
          }`;
          const content = (
            <>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? "bg-blue-400/22 text-blue-100" : "bg-white/[0.06] text-slate-300"}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="max-w-24 truncate">{option.label}</span>
            </>
          );

          return option.href ? (
            <Link key={optionValue} to={option.href} className={className}>
              {content}
            </Link>
          ) : (
            <button
              key={optionValue}
              type="button"
              onClick={option.onClick}
              disabled={!option.onClick}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AlertBanner({ text, tone }: { text: string; tone: "warning" | "success" }) {
  const warning = tone === "warning";
  return (
    <div
      className={`flex min-h-12 items-center gap-3 rounded-[20px] border px-4 text-sm font-medium ${
        warning
          ? "border-amber-400/24 bg-amber-500/14 text-amber-100"
          : "border-emerald-400/24 bg-emerald-500/12 text-emerald-100"
      }`}
    >
      {warning ? <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />}
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}

function MealQuickCards({
  activeMeal,
  onSelect
}: {
  activeMeal: NutritionMealType;
  onSelect: (meal: NutritionMealType) => void;
}) {
  return (
    <div>
      <SectionTitle title="Быстрый выбор" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(Object.keys(mealLabels) as NutritionMealType[]).map((meal) => {
          const visual = mealVisuals[meal];
          const Icon = visual.icon;
          const active = activeMeal === meal;
          return (
            <button
              key={meal}
              type="button"
              onClick={() => onSelect(meal)}
              className={`relative min-h-32 overflow-hidden rounded-[22px] border p-4 text-left shadow-[0_16px_30px_rgba(0,0,0,0.2)] transition active:scale-[0.99] ${
                active ? "border-white/28 ring-2 ring-blue-300/35" : "border-white/10"
              }`}
              style={{ background: visual.gradient, boxShadow: active ? `0 18px 40px ${visual.glow}` : undefined }}
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/12 blur-2xl" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/18 text-xs font-bold text-white">
                    {mealLabels[meal].slice(0, 1)}
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" : "bg-white/35"}`} />
                </div>
                <Icon className="mx-auto h-9 w-9 text-white/82" />
                <div>
                  <div className="text-base font-bold text-white">{mealLabels[meal]}</div>
                  <div className="mt-1 text-xs text-white/68">выбрать для записи</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MealCard({ entry }: { entry: NutritionEntry }) {
  const visual = mealVisuals[entry.mealType];
  const Icon = visual.icon;
  const photoUrl = getImageUrl(entry.photoUrl);
  return (
    <article
      className="relative min-h-40 overflow-hidden rounded-[22px] border border-white/10 p-4 shadow-[0_16px_30px_rgba(0,0,0,0.22)]"
      style={{
        background: photoUrl
          ? `linear-gradient(180deg, rgba(10,12,28,0.12), rgba(10,12,28,0.82)), url(${photoUrl}) center / cover`
          : visual.gradient,
        boxShadow: `0 18px 40px ${visual.glow}`
      }}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/12 blur-2xl" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/18 text-xs font-bold text-white">
            {mealLabels[entry.mealType].slice(0, 1)}
          </span>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
        </div>
        {photoUrl ? <div className="min-h-8" /> : <Icon className="mx-auto h-9 w-9 text-white/82" />}
        <div>
          <div className="text-base font-bold text-white">{mealLabels[entry.mealType]}</div>
          <div className="mt-1 text-xs text-white/70">{entry.time} · {qualityLabels[entry.quality]}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-white/78">
            <div className="rounded-xl bg-black/12 px-2 py-1">Сытость {entry.satiety}/5</div>
            <div className="rounded-xl bg-black/12 px-2 py-1">Вода {entry.hydration}/5</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function NutritionTeamSummaryPanel({ summary }: { summary?: NutritionTeamSummary }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <MetricTile icon={Users} label="Игроки" value={`${summary?.totalPlayers || 0}`} tone="blue" />
      <MetricTile icon={CheckCircle2} label="Внесли" value={`${summary?.playersWithEntries || 0}`} tone="green" />
      <MetricTile icon={Utensils} label="Записи" value={`${summary?.totalEntries || 0}`} tone="amber" />
    </div>
  );
}

function RadialProgress({ value, label }: { value: number; label: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference - (normalized / 100) * circumference;
  const displayOffset = normalized === 0 ? circumference - 4 : dashOffset;

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <div className="absolute inset-3 rounded-full bg-blue-400/10 blur-xl" />
      <svg className="relative h-32 w-32 -rotate-90 drop-shadow-[0_12px_26px_rgba(59,130,246,0.18)]" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="44" fill="rgba(17,24,49,0.72)" stroke="rgba(51,58,104,0.9)" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r="44"
          fill="none"
          stroke="url(#mobileAnalyticsRadial)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={displayOffset}
        />
        <defs>
          <linearGradient id="mobileAnalyticsRadial" x1="16" x2="92" y1="18" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor={normalized > 0 ? "#34D399" : "#FBBF24"} />
            <stop offset="1" stopColor={normalized > 0 ? "#60A5FA" : "#F97316"} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="flex items-end justify-center gap-0.5">
          <span className="text-4xl font-black tracking-[-0.05em] text-white">{normalized}</span>
          <span className="mb-1.5 text-xs font-bold text-slate-400">%</span>
        </div>
        <div className="mt-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300">{label}</div>
      </div>
    </div>
  );
}

function AnalyticsSignal({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "red" }) {
  const toneClass = {
    green: "text-emerald-300 bg-emerald-500/12",
    amber: "text-amber-300 bg-amber-500/12",
    red: "text-rose-300 bg-rose-500/12"
  }[tone];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3">
      <div className="truncate text-[10px] leading-4 text-slate-400">{label}</div>
      <div className={`mt-1 inline-flex rounded-xl px-2.5 py-1 text-sm font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function StackedStatusBar({
  items,
  total
}: {
  items: { label: string; value: number; colorClass: string }[];
  total: number;
}) {
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-[#11142B] ring-1 ring-[#293056]">
        {items.map((item) => (
          <div
            key={item.label}
            className={`${item.colorClass} transition-all`}
            style={{ width: `${Math.max((item.value / total) * 100, item.value ? 8 : 0)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${item.colorClass}`} />
              <span className="truncate text-[10px] text-slate-400">{item.label}</span>
            </div>
            <div className="mt-1 text-lg font-bold text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone: "green" | "amber" | "red";
}) {
  const toneClass = {
    green: "text-emerald-200 bg-emerald-500/12 border-emerald-400/16",
    amber: "text-amber-200 bg-amber-500/12 border-amber-400/16",
    red: "text-rose-200 bg-rose-500/12 border-rose-400/16"
  }[tone];

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="truncate text-[10px] leading-4 text-slate-400">{label}</div>
      <div className="mt-1 truncate text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-32 rounded-[24px] border border-[#293056] bg-[linear-gradient(145deg,rgba(35,39,72,0.9),rgba(28,31,59,0.84))] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/14 text-blue-300 shadow-[0_12px_24px_rgba(59,130,246,0.14)]">
        <Icon className="h-6 w-6" />
      </span>
      <div className="mt-4 text-sm font-bold text-white">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
    </button>
  );
}

function MobilePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="rounded-[24px] border-[#293056] bg-[linear-gradient(155deg,rgba(35,39,72,0.92),rgba(28,31,59,0.86))] text-white shadow-[0_14px_36px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone = "blue"
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "red" | "sky";
}) {
  const toneMap = {
    blue: "text-blue-300 bg-blue-500/12 border-blue-400/16",
    green: "text-emerald-300 bg-emerald-500/12 border-emerald-400/16",
    amber: "text-amber-300 bg-amber-500/12 border-amber-400/16",
    red: "text-rose-300 bg-rose-500/12 border-rose-400/16",
    sky: "text-cyan-300 bg-cyan-500/12 border-cyan-400/16"
  }[tone];
  return (
    <div className={`rounded-[20px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${toneMap}`}>
      <Icon className="h-5 w-5" />
      <div className="mt-3 text-2xl font-bold tracking-[-0.04em] text-white">{value}</div>
      <div className="text-[10px] leading-4 text-slate-400">{label}</div>
    </div>
  );
}

function StatusRow({ done, label, hint, last = false }: { done: boolean; label: string; hint: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? "" : "border-b border-[#293056]"}`}>
      <CheckCircle2 className={`h-5 w-5 ${done ? "text-emerald-400" : "text-slate-600"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

function PlayerRow({ name, detail, score }: { name: string; detail: string; score: number | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#293056] py-3 last:border-b-0">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/18 text-sm font-bold text-violet-100">
        {name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        <div className="truncate text-xs text-slate-400">{detail}</div>
      </div>
      {score != null ? <div className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</div> : null}
    </div>
  );
}

function ScoreBox({ label, value }: { label: string; value?: number | null }) {
  const score = clampScore(value);
  return (
    <div className="rounded-2xl border border-[#293056] bg-[#171A34] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: scoreColor(score) }}>{score ?? "-"}</div>
    </div>
  );
}

function DailyStateRecorder({
  moodByTime,
  selectedTime,
  selectedMetric,
  isSaving,
  onSelectTime,
  onSelectMetric,
  onChangeValue,
  onSave
}: {
  moodByTime: Record<MoodTimeOfDay, MoodEnergySlot>;
  selectedTime: MoodTimeOfDay;
  selectedMetric: keyof MoodEnergySlot;
  isSaving: boolean;
  onSelectTime: (timeOfDay: MoodTimeOfDay) => void;
  onSelectMetric: (metric: keyof MoodEnergySlot) => void;
  onChangeValue: (value: number) => void;
  onSave: () => void;
}) {
  const value = moodByTime[selectedTime][selectedMetric];
  const metricTitle = selectedMetric === "mood" ? "настроение" : "энергия";
  const metricQuestion = selectedMetric === "mood" ? "Как настроение?" : "Сколько энергии?";

  return (
    <section className="overflow-hidden rounded-[26px] border border-[#293056] bg-[linear-gradient(155deg,rgba(35,39,72,0.96),rgba(20,23,48,0.9))] shadow-[0_16px_42px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-[#293056] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Быстрая запись</div>
            <h2 className="mt-1 text-xl font-bold text-white">{metricQuestion}</h2>
            <p className="mt-1 text-xs text-slate-400">Отдельно от полного чек-ина</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-[0_14px_28px_rgba(59,130,246,0.28)]">
            <Plus className="h-6 w-6" />
          </span>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(moodTimeLabels) as MoodTimeOfDay[]).map((timeOfDay) => {
            const Icon = moodTimeLabels[timeOfDay].icon;
            const active = selectedTime === timeOfDay;
            return (
              <button
                key={timeOfDay}
                type="button"
                onClick={() => onSelectTime(timeOfDay)}
                className={`min-h-16 rounded-[18px] border p-2 text-left transition ${
                  active ? "border-blue-300/70 bg-blue-500/18 text-white" : "border-[#293056] bg-[#171A34] text-slate-300"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-blue-200" : "text-slate-500"}`} />
                <div className="mt-2 text-xs font-bold">{moodTimeLabels[timeOfDay].title}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {moodByTime[timeOfDay].mood}/{moodByTime[timeOfDay].energy}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-[#293056] bg-[#101329]/82 p-1">
          {([
            ["mood", "Настроение"],
            ["energy", "Энергия"]
          ] as Array<[keyof MoodEnergySlot, string]>).map(([metric, label]) => (
            <button
              key={metric}
              type="button"
              onClick={() => onSelectMetric(metric)}
              className={`min-h-9 rounded-2xl text-sm font-bold ${
                selectedMetric === metric ? "bg-[#2B315D] text-white" : "text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#b74736_0%,#ef9b12_23%,#16c7e9_54%,#22c55e_76%,#7c75c8_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18),transparent_36%)]" />
          <div className="relative flex min-h-28 flex-col items-center justify-center text-center">
            <div className="text-6xl font-black leading-none text-white drop-shadow-[0_12px_24px_rgba(0,0,0,0.22)]">{value}</div>
            <div className="mt-2 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold text-white/88 backdrop-blur">
              {moodLabel(value)} · {metricTitle}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => onChangeValue(score)}
              className={`flex h-9 items-center justify-center rounded-xl text-sm font-bold transition ${
                score === value ? "bg-white text-[#111429]" : "bg-[#202443] text-slate-300"
              }`}
            >
              {score}
            </button>
          ))}
        </div>

        <Button
          onClick={onSave}
          disabled={isSaving}
          className="h-12 w-full rounded-2xl bg-blue-500 text-base font-semibold text-white hover:bg-blue-400"
        >
          {isSaving ? "Сохранение..." : <>Сохранить состояние <ChevronRight className="ml-1 h-5 w-5" /></>}
        </Button>
      </div>
    </section>
  );
}

function CompactMoodSummary({
  moodByTime,
  onSelectTime
}: {
  moodByTime: Record<MoodTimeOfDay, MoodEnergySlot>;
  onSelectTime: (timeOfDay: MoodTimeOfDay) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(moodTimeLabels) as MoodTimeOfDay[]).map((timeOfDay) => {
        const Icon = moodTimeLabels[timeOfDay].icon;
        return (
          <button
            key={timeOfDay}
            type="button"
            onClick={() => onSelectTime(timeOfDay)}
            className="min-h-24 rounded-[20px] border border-[#293056] bg-[#171A34] p-3 text-left"
          >
            <Icon className="h-4 w-4 text-blue-200" />
            <div className="mt-2 text-xs font-bold text-white">{moodTimeLabels[timeOfDay].title}</div>
            <div className="mt-2 text-[10px] leading-4 text-slate-400">
              Н {moodByTime[timeOfDay].mood}/10<br />
              Э {moodByTime[timeOfDay].energy}/10
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RangeControl({
  label,
  value,
  onChange,
  max = 10,
  inverse = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  inverse?: boolean;
}) {
  const normalized = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm text-slate-200">{label}</Label>
        <span className="text-sm font-semibold" style={{ color: inverse ? scoreColor(100 - normalized) : COLORS.success }}>
          {value}/{max}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mobile-range"
      />
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold transition ${
              active ? "border-blue-400/70 bg-blue-500/22 text-white shadow-[0_10px_24px_rgba(59,130,246,0.12)]" : "border-[#293056] bg-[#171A34] text-slate-300"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>;
}

function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-400">{text}</div>;
}

function MobileLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#111827] text-white">
      <div className="text-sm text-slate-300">Загрузка CRMAtlant...</div>
    </div>
  );
}

function readinessLabel(value: number) {
  if (value >= 75) return "Рабочее состояние";
  if (value >= 55) return "Нужно наблюдать";
  return "Требует внимания";
}

function moodLabel(value: number) {
  if (value <= 3) return "сонно";
  if (value <= 5) return "ровно";
  if (value <= 7) return "нормально";
  if (value <= 9) return "хорошо";
  return "пик";
}
