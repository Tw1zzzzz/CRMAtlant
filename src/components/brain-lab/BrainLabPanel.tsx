import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  completeBrainTestAttempt,
  getBrainPerformanceSummary,
  getBrainTestsCatalog,
  getBrainTestsHistory,
  startBrainTestAttempt
} from "@/lib/api";
import type {
  BrainAttemptResult,
  BrainCatalogEntry,
  BrainCatalogResponse,
  BrainHistoryItem,
  BrainPerformanceSummary,
  BrainTestKey
} from "@/types";
import {
  ArrowRight,
  Brain,
  Gauge,
  Keyboard,
  Loader2,
  Monitor,
  ShieldCheck,
  TimerReset,
  TrendingUp
} from "lucide-react";
import { getReadableInvalidReason } from "@/utils/testTypeMetadata";

const PANEL_BG = "linear-gradient(160deg, rgba(8, 13, 27, 0.98), rgba(11, 28, 49, 0.94) 48%, rgba(4, 18, 23, 0.96))";

const domainLabels: Record<string, string> = {
  attention: "Внимание",
  reaction_inhibition: "Реакция и контроль",
  working_memory: "Рабочая память",
  flexibility: "Переключение",
  visuospatial: "Пространственная память"
};

const testAccent: Record<BrainTestKey, { glow: string; accent: string }> = {
  visual_search: { glow: "rgba(14, 165, 233, 0.26)", accent: "#6EE7FF" },
  go_no_go: { glow: "rgba(34, 197, 94, 0.24)", accent: "#86EFAC" },
  n_back_2: { glow: "rgba(244, 114, 182, 0.24)", accent: "#F9A8D4" },
  stroop_switch: { glow: "rgba(251, 191, 36, 0.24)", accent: "#FCD34D" },
  spatial_span: { glow: "rgba(168, 85, 247, 0.24)", accent: "#D8B4FE" }
};

const performanceFormulaMap: Record<
  BrainTestKey,
  {
    title: string;
    summary: string;
    formula: string;
    detail: string;
  }
> = {
  visual_search: {
    title: "Visual Search",
    summary: "Ищем цель в сетке и смотрим, насколько быстро и стабильно вы её находите.",
    formula: "0.50 × accuracy + 0.30 × speedScore + 0.20 × stabilityScore",
    detail: "Accuracy важнее всего; скорость и вариативность реакции уточняют итоговый raw-score."
  },
  go_no_go: {
    title: "Go / No-Go",
    summary: "Меряем чистую реакцию и способность вовремя остановиться.",
    formula: "0.35 × goAccuracy + 0.35 × noGoAccuracy + 0.20 × speedScore + 0.10 × stabilityScore",
    detail: "Тест сильнее штрафует импульсивные ошибки и пропуски, чем просто медленный темп."
  },
  n_back_2: {
    title: "2-Back",
    summary: "Проверяем рабочую память: удержание контекста и обновление информации.",
    formula: "0.45 × targetAccuracy + 0.25 × nonTargetAccuracy + 0.20 × speedScore + 0.10 × stabilityScore",
    detail: "Главный вклад в результат даёт точность совпадений, потом — корректные пропуски и скорость."
  },
  stroop_switch: {
    title: "Stroop Switch",
    summary: "Смотрим, как вы держите правило и перестраиваетесь при конфликте и смене режима.",
    formula: "0.35 × conflictAccuracy + 0.20 × congruentAccuracy + 0.25 × interferenceScore + 0.20 × switchCostScore",
    detail: "Здесь важнее всего не ошибаться в конфликте и быстро выходить из режима переключения."
  },
  spatial_span: {
    title: "Spatial Span",
    summary: "Измеряем объём и точность пространственной последовательности.",
    formula: "0.60 × spanScore + 0.40 × sequenceAccuracy",
    detail: "Максимальный корректный span весит больше, чем просто частичная точность по позициям."
  }
};

const overallIndexFormula =
  "0.25 × attention + 0.25 × reactionInhibition + 0.20 × workingMemory + 0.15 × flexibility + 0.15 × visuospatial";

type AttemptRuntime = {
  attemptId: string;
  batterySessionId: string | null;
  entry: BrainCatalogEntry;
};

type CountdownState = {
  testKey: BrainTestKey;
  batterySessionId: string;
  index: number;
  remaining: number;
};

type RunnerProps = {
  config: Record<string, number | string>;
  title: string;
  instruction: string;
  onFinish: (payload: Record<string, unknown>) => void;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function coefficientOfVariation(values: number[]) {
  const avg = average(values);
  if (!avg || avg <= 0) return 0;
  const variance = average(values.map((value) => (value - avg) ** 2)) || 0;
  return Math.sqrt(variance) / avg;
}

function round(value: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `brain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getClientMeta() {
  const viewport =
    typeof window !== "undefined"
      ? {
          width: window.innerWidth,
          height: window.innerHeight
        }
      : undefined;

  return {
    viewport,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    deviceType: typeof window !== "undefined" && window.innerWidth < 1024 ? "mobile" : "desktop"
  };
}

function formatScore(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return value.toFixed(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDurationMs(value: number | null | undefined) {
  if (typeof value !== "number" || value <= 0) return "—";
  return `${(value / 1000).toFixed(1)} c`;
}

function getHistoryStatusMeta(status: string) {
  if (status === "valid") {
    return {
      label: "Валидно",
      backgroundColor: "rgba(34, 197, 94, 0.16)",
      color: "#86EFAC"
    };
  }

  if (status === "invalid") {
    return {
      label: "Исключено",
      backgroundColor: "rgba(244, 63, 94, 0.16)",
      color: "#FDA4AF"
    };
  }

  return {
    label: "Калибровка",
    backgroundColor: "rgba(251, 191, 36, 0.16)",
    color: "#FCD34D"
  };
}

function useVisibilityTracker(active: boolean) {
  const [hiddenMs, setHiddenMs] = useState(0);
  const hiddenStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHiddenMs(0);
      hiddenStartedAtRef.current = null;
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenStartedAtRef.current = performance.now();
        return;
      }

      if (hiddenStartedAtRef.current !== null) {
        const delta = performance.now() - hiddenStartedAtRef.current;
        setHiddenMs((current) => current + delta);
        hiddenStartedAtRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (hiddenStartedAtRef.current !== null) {
        const delta = performance.now() - hiddenStartedAtRef.current;
        setHiddenMs((current) => current + delta);
        hiddenStartedAtRef.current = null;
      }
    };
  }, [active]);

  return hiddenMs;
}

function TestFrame({
  title,
  instruction,
  accent,
  progress,
  children
}: {
  title: string;
  instruction: string;
  accent: string;
  progress?: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      className="overflow-hidden rounded-[30px] border"
      style={{
        background: "linear-gradient(180deg, rgba(6, 10, 22, 0.98), rgba(10, 18, 34, 0.94))",
        borderColor: "rgba(148, 163, 184, 0.14)",
        boxShadow: `0 28px 80px -54px ${accent}`
      }}
    >
      <CardHeader className="border-b border-white/5 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]" style={{ borderColor: accent, color: accent }}>
              <Keyboard className="h-3.5 w-3.5" />
              Brain Lab Live
            </div>
            <CardTitle className="text-2xl text-slate-50">{title}</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-slate-300">{instruction}</CardDescription>
          </div>
          {typeof progress === "number" ? (
            <div className="min-w-[180px] space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400">
                <span>Прогресс</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/5" />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function VisualSearchRunner({ config, title, instruction, onFinish }: RunnerProps) {
  const gridSize = Number(config.gridSize || 6);
  const maxTrials = Number(config.maxTrials || 30);
  const totalDurationMs = Number(config.durationSec || 60) * 1000 || 60_000;
  const hiddenMs = useVisibilityTracker(true);
  const symbols = [
    ["S", "5"],
    ["Z", "2"],
    ["B", "8"],
    ["G", "6"]
  ];

  const makeTrial = () => {
    const pair = symbols[Math.floor(Math.random() * symbols.length)];
    const target = pair[0];
    const distractor = pair[1];
    const total = gridSize * gridSize;
    const targetIndex = Math.floor(Math.random() * total);
    return {
      target,
      distractor,
      targetIndex,
      cells: Array.from({ length: total }, (_, index) => (index === targetIndex ? target : distractor))
    };
  };

  const startedAtRef = useRef(performance.now());
  const trialStartedAtRef = useRef(performance.now());
  const trialIndexRef = useRef(0);
  const [trial, setTrial] = useState(makeTrial);
  const [trialIndex, setTrialIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef<{ correct: boolean; rt: number }[]>([]);

  useEffect(() => {
    trialIndexRef.current = trialIndex;
    trialStartedAtRef.current = performance.now();
  }, [trialIndex]);

  useEffect(() => {
    const stopTimer = window.setTimeout(() => {
      finish(true);
    }, totalDurationMs);
    return () => window.clearTimeout(stopTimer);
  }, [totalDurationMs]);

  const finish = (timedOut = false) => {
    const totalSeen = timedOut ? trialIndexRef.current + 1 : Math.min(trialIndexRef.current, maxTrials);
    const answered = resultsRef.current.length;
    const correctCount = resultsRef.current.filter((item) => item.correct).length;
    const rtValues = resultsRef.current.map((item) => item.rt);
    const accuracyPct = totalSeen > 0 ? (correctCount / totalSeen) * 100 : 0;

    onFinish({
      accuracyPct: round(accuracyPct),
      medianRtMs: round(median(rtValues)),
      rtCv: round(coefficientOfVariation(rtValues), 4),
      misses: Math.max(totalSeen - correctCount, 0),
      durationMs: Math.round(performance.now() - startedAtRef.current),
      visibilityHiddenMs: Math.round(hiddenMs),
      fastResponseRatio: rtValues.length ? round(rtValues.filter((item) => item < 120).length / rtValues.length, 4) : 0,
      answeredTrials: answered,
      totalSeen
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current - gridSize + gridSize * gridSize) % (gridSize * gridSize));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => (current + gridSize) % (gridSize * gridSize));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + gridSize * gridSize) % (gridSize * gridSize));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % (gridSize * gridSize));
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const rt = performance.now() - trialStartedAtRef.current;
        const correct = selectedIndex === trial.targetIndex;
        resultsRef.current.push({ correct, rt });

        if (trialIndex + 1 >= maxTrials) {
          finish(false);
          return;
        }

        setTrialIndex((current) => current + 1);
        setSelectedIndex(0);
        setTrial(makeTrial());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridSize, maxTrials, selectedIndex, trial, trialIndex]);

  const progress = ((trialIndex + 1) / maxTrials) * 100;

  return (
    <TestFrame title={title} instruction={instruction} accent={testAccent.visual_search.glow} progress={progress}>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Цель</div>
          <div className="text-6xl font-semibold" style={{ color: testAccent.visual_search.accent }}>
            {trial.target}
          </div>
          <p className="text-sm leading-6 text-slate-300">
            Перемещайтесь стрелками по сетке и подтвердите найденную клетку клавишей Enter.
          </p>
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-3 text-xs leading-6 text-slate-400">
            Dистрактор: {trial.distractor}
            <br />
            Попытка: {trialIndex + 1} / {maxTrials}
          </div>
        </div>
        <div className="grid place-items-center rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(110,231,255,0.16),_transparent_38%),linear-gradient(180deg,rgba(9,15,31,0.86),rgba(6,10,20,0.96))] p-5">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
            {trial.cells.map((cell, index) => (
              <div
                key={`${trialIndex}-${index}`}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border text-xl font-semibold transition-all"
                style={{
                  borderColor: index === selectedIndex ? testAccent.visual_search.accent : "rgba(148, 163, 184, 0.12)",
                  backgroundColor: index === selectedIndex ? "rgba(110, 231, 255, 0.14)" : "rgba(255,255,255,0.03)",
                  color: "#F8FBFF",
                  boxShadow: index === selectedIndex ? `0 0 0 1px ${testAccent.visual_search.accent} inset` : "none"
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TestFrame>
  );
}

function GoNoGoRunner({ config, title, instruction, onFinish }: RunnerProps) {
  const totalStimuli = Number(config.totalStimuli || 80);
  const noGoRatio = Number(config.noGoRatio || 0.25);
  const hiddenMs = useVisibilityTracker(true);
  const startedAtRef = useRef(performance.now());
  const stimuli = useMemo(() => {
    const plannedNoGo = Math.round(totalStimuli * noGoRatio);
    const base = Array.from({ length: totalStimuli }, (_, index) => ({
      id: index,
      type: index < plannedNoGo ? "no-go" : "go"
    }));
    return base.sort(() => Math.random() - 0.5);
  }, [noGoRatio, totalStimuli]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stimulusState, setStimulusState] = useState<"ready" | "active" | "gap">("ready");
  const activeStimulus = stimuli[currentIndex] || null;
  const responsesRef = useRef<{ type: "go" | "no-go"; correct: boolean; rt: number | null }[]>([]);
  const activeSinceRef = useRef(0);
  const respondedRef = useRef(false);

  useEffect(() => {
    if (currentIndex >= stimuli.length) {
      const goResponses = responsesRef.current.filter((item) => item.type === "go");
      const noGoResponses = responsesRef.current.filter((item) => item.type === "no-go");
      const goHits = goResponses.filter((item) => item.correct).length;
      const noGoCorrect = noGoResponses.filter((item) => item.correct).length;
      const rtValues = responsesRef.current
        .map((item) => item.rt)
        .filter((value): value is number => typeof value === "number" && value > 0);

      onFinish({
        goAccuracyPct: round((goHits / Math.max(goResponses.length, 1)) * 100),
        noGoAccuracyPct: round((noGoCorrect / Math.max(noGoResponses.length, 1)) * 100),
        medianRtMs: round(median(rtValues)),
        rtCv: round(coefficientOfVariation(rtValues), 4),
        commissionErrors: noGoResponses.filter((item) => !item.correct).length,
        omissionErrors: goResponses.filter((item) => !item.correct).length,
        durationMs: Math.round(performance.now() - startedAtRef.current),
        visibilityHiddenMs: Math.round(hiddenMs),
        fastResponseRatio: rtValues.length ? round(rtValues.filter((item) => item < 120).length / rtValues.length, 4) : 0
      });
      return;
    }

    setStimulusState("active");
    activeSinceRef.current = performance.now();
    respondedRef.current = false;

    const responseWindow = window.setTimeout(() => {
      if (activeStimulus) {
        if (activeStimulus.type === "go" && !respondedRef.current) {
          responsesRef.current.push({ type: "go", correct: false, rt: null });
        }
        if (activeStimulus.type === "no-go" && !respondedRef.current) {
          responsesRef.current.push({ type: "no-go", correct: true, rt: null });
        }
      }
      setStimulusState("gap");
      window.setTimeout(() => {
        setCurrentIndex((current) => current + 1);
      }, 140);
    }, 650);

    return () => window.clearTimeout(responseWindow);
  }, [activeStimulus, currentIndex, hiddenMs, onFinish, stimuli.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || stimulusState !== "active" || !activeStimulus || respondedRef.current) return;
      event.preventDefault();
      respondedRef.current = true;
      const rt = performance.now() - activeSinceRef.current;
      const correct = activeStimulus.type === "go";
      responsesRef.current.push({ type: activeStimulus.type, correct, rt });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStimulus, stimulusState]);

  const progress = (currentIndex / stimuli.length) * 100;

  return (
    <TestFrame title={title} instruction={instruction} accent={testAccent.go_no_go.glow} progress={progress}>
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Правило</div>
          <p className="text-sm leading-6 text-slate-300">
            Синий = нажать пробел. Красный = удержаться.
          </p>
          <div className="grid gap-3 text-sm">
            <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sky-100">GO: пробел</div>
            <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-100">NO-GO: ничего не нажимать</div>
          </div>
        </div>
        <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(134,239,172,0.14),_transparent_40%),linear-gradient(180deg,rgba(9,15,31,0.86),rgba(6,10,20,0.96))]">
          <div
            className="flex h-44 w-44 items-center justify-center rounded-[32px] border text-3xl font-semibold uppercase tracking-[0.18em] transition-all"
            style={{
              backgroundColor:
                stimulusState === "active"
                  ? activeStimulus?.type === "go"
                    ? "rgba(59, 130, 246, 0.18)"
                    : "rgba(244, 63, 94, 0.18)"
                  : "rgba(255,255,255,0.03)",
              borderColor:
                stimulusState === "active"
                  ? activeStimulus?.type === "go"
                    ? "rgba(59, 130, 246, 0.45)"
                    : "rgba(244, 63, 94, 0.45)"
                  : "rgba(148, 163, 184, 0.12)",
              color: "#F8FBFF"
            }}
          >
            {stimulusState === "active" ? (activeStimulus?.type === "go" ? "GO" : "STOP") : "..." }
          </div>
        </div>
      </div>
    </TestFrame>
  );
}

function NBackRunner({ config, title, instruction, onFinish }: RunnerProps) {
  const totalStimuli = Number(config.totalStimuli || 60);
  const targetRatio = Number(config.targetRatio || 0.3);
  const hiddenMs = useVisibilityTracker(true);
  const startedAtRef = useRef(performance.now());

  const sequence = useMemo(() => {
    const alphabet = ["A", "C", "E", "H", "K", "M", "R", "T", "X"];
    const result: Array<{ char: string; isTarget: boolean }> = [];
    for (let index = 0; index < totalStimuli; index += 1) {
      if (index < 2) {
        result.push({ char: alphabet[Math.floor(Math.random() * alphabet.length)], isTarget: false });
        continue;
      }

      const shouldTarget = Math.random() < targetRatio;
      if (shouldTarget) {
        result.push({ char: result[index - 2].char, isTarget: true });
        continue;
      }

      const options = alphabet.filter((item) => item !== result[index - 2].char);
      result.push({ char: options[Math.floor(Math.random() * options.length)], isTarget: false });
    }
    return result;
  }, [targetRatio, totalStimuli]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"active" | "gap">("active");
  const activeStimulus = sequence[currentIndex] || null;
  const responsesRef = useRef<{ isTarget: boolean; responded: boolean; correct: boolean; rt: number | null }[]>([]);
  const activeSinceRef = useRef(0);
  const respondedRef = useRef(false);

  useEffect(() => {
    if (currentIndex >= sequence.length) {
      const targetItems = responsesRef.current.filter((item) => item.isTarget);
      const nonTargetItems = responsesRef.current.filter((item) => !item.isTarget);
      const rtValues = responsesRef.current
        .map((item) => item.rt)
        .filter((value): value is number => typeof value === "number" && value > 0);

      onFinish({
        targetAccuracyPct: round((targetItems.filter((item) => item.correct).length / Math.max(targetItems.length, 1)) * 100),
        nonTargetAccuracyPct: round((nonTargetItems.filter((item) => item.correct).length / Math.max(nonTargetItems.length, 1)) * 100),
        medianRtMs: round(median(rtValues)),
        rtCv: round(coefficientOfVariation(rtValues), 4),
        durationMs: Math.round(performance.now() - startedAtRef.current),
        visibilityHiddenMs: Math.round(hiddenMs),
        fastResponseRatio: rtValues.length ? round(rtValues.filter((item) => item < 120).length / rtValues.length, 4) : 0
      });
      return;
    }

    setPhase("active");
    activeSinceRef.current = performance.now();
    respondedRef.current = false;

    const windowTimer = window.setTimeout(() => {
      if (activeStimulus && !respondedRef.current) {
        responsesRef.current.push({
          isTarget: activeStimulus.isTarget,
          responded: false,
          correct: !activeStimulus.isTarget,
          rt: null
        });
      }
      setPhase("gap");
      window.setTimeout(() => setCurrentIndex((current) => current + 1), 180);
    }, 850);

    return () => window.clearTimeout(windowTimer);
  }, [activeStimulus, currentIndex, hiddenMs, onFinish, sequence.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (phase !== "active" || event.key.toLowerCase() !== "j" || !activeStimulus || respondedRef.current) return;
      event.preventDefault();
      respondedRef.current = true;
      const rt = performance.now() - activeSinceRef.current;
      responsesRef.current.push({
        isTarget: activeStimulus.isTarget,
        responded: true,
        correct: activeStimulus.isTarget,
        rt
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStimulus, phase]);

  const previous = currentIndex >= 2 ? `${sequence[currentIndex - 2].char}` : "·";
  const progress = (currentIndex / sequence.length) * 100;

  return (
    <TestFrame title={title} instruction={instruction} accent={testAccent.n_back_2.glow} progress={progress}>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Подсказка</div>
          <p className="text-sm leading-6 text-slate-300">
            Нажимайте J только если текущий символ совпадает с символом два шага назад.
          </p>
          <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-4 py-3">
            Два шага назад: <span className="font-semibold text-fuchsia-100">{previous}</span>
          </div>
        </div>
        <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(249,168,212,0.16),_transparent_40%),linear-gradient(180deg,rgba(9,15,31,0.86),rgba(6,10,20,0.96))]">
          <div className="flex h-44 w-44 items-center justify-center rounded-full border border-fuchsia-200/20 bg-fuchsia-300/10 text-7xl font-semibold text-white">
            {activeStimulus?.char || "·"}
          </div>
        </div>
      </div>
    </TestFrame>
  );
}

function StroopSwitchRunner({ config: _config, title, instruction, onFinish }: RunnerProps) {
  const hiddenMs = useVisibilityTracker(true);
  const startedAtRef = useRef(performance.now());
  const colors = ["red", "blue", "green", "yellow"] as const;
  const colorLabels = {
    red: "Красный",
    blue: "Синий",
    green: "Зелёный",
    yellow: "Жёлтый"
  };
  const colorStyles = {
    red: "#FB7185",
    blue: "#60A5FA",
    green: "#4ADE80",
    yellow: "#FACC15"
  };
  const keyMap = {
    a: "red",
    s: "blue",
    k: "green",
    l: "yellow"
  } as const;

  const sequence = useMemo(() => {
    const items: Array<{
      mode: "color" | "word";
      congruent: boolean;
      color: keyof typeof colorLabels;
      word: keyof typeof colorLabels;
      isSwitch: boolean;
    }> = [];

    for (let index = 0; index < 72; index += 1) {
      const mode = Math.floor(index / 18) % 2 === 0 ? "color" : "word";
      const congruent = index % 3 !== 0;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const word = congruent
        ? color
        : colors.filter((item) => item !== color)[Math.floor(Math.random() * 3)];

      items.push({
        mode,
        congruent,
        color,
        word,
        isSwitch: index > 0 && mode !== items[index - 1].mode
      });
    }
    return items;
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"active" | "gap">("active");
  const activeStimulus = sequence[currentIndex] || null;
  const activeSinceRef = useRef(0);
  const respondedRef = useRef(false);
  const responsesRef = useRef<Array<{ congruent: boolean; correct: boolean; rt: number | null; isSwitch: boolean }>>([]);

  useEffect(() => {
    if (currentIndex >= sequence.length) {
      const congruentItems = responsesRef.current.filter((item) => item.congruent);
      const conflictItems = responsesRef.current.filter((item) => !item.congruent);
      const switchItems = responsesRef.current.filter((item) => item.isSwitch && item.correct && typeof item.rt === "number");
      const repeatItems = responsesRef.current.filter((item) => !item.isSwitch && item.correct && typeof item.rt === "number");
      const congruentRt = congruentItems.map((item) => item.rt).filter((value): value is number => typeof value === "number");
      const conflictRt = conflictItems.map((item) => item.rt).filter((value): value is number => typeof value === "number");
      const switchRt = switchItems.map((item) => item.rt as number);
      const repeatRt = repeatItems.map((item) => item.rt as number);
      const allRt = responsesRef.current.map((item) => item.rt).filter((value): value is number => typeof value === "number");
      const switchCostMs = Math.max((median(switchRt) || 0) - (median(repeatRt) || 0), 0);

      onFinish({
        congruentAccuracyPct: round((congruentItems.filter((item) => item.correct).length / Math.max(congruentItems.length, 1)) * 100),
        conflictAccuracyPct: round((conflictItems.filter((item) => item.correct).length / Math.max(conflictItems.length, 1)) * 100),
        congruentMedianRtMs: round(median(congruentRt)),
        conflictMedianRtMs: round(median(conflictRt)),
        switchCostMs: round(switchCostMs),
        durationMs: Math.round(performance.now() - startedAtRef.current),
        visibilityHiddenMs: Math.round(hiddenMs),
        fastResponseRatio: allRt.length ? round(allRt.filter((item) => item < 120).length / allRt.length, 4) : 0
      });
      return;
    }

    setPhase("active");
    activeSinceRef.current = performance.now();
    respondedRef.current = false;

    const timer = window.setTimeout(() => {
      if (activeStimulus && !respondedRef.current) {
        responsesRef.current.push({
          congruent: activeStimulus.congruent,
          correct: false,
          rt: null,
          isSwitch: activeStimulus.isSwitch
        });
      }
      setPhase("gap");
      window.setTimeout(() => setCurrentIndex((current) => current + 1), 180);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [activeStimulus, currentIndex, hiddenMs, onFinish, sequence.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const pressed = event.key.toLowerCase();
      if (!(pressed in keyMap) || phase !== "active" || !activeStimulus || respondedRef.current) return;
      event.preventDefault();
      respondedRef.current = true;
      const answerColor = keyMap[pressed as keyof typeof keyMap];
      const expected = activeStimulus.mode === "color" ? activeStimulus.color : activeStimulus.word;
      responsesRef.current.push({
        congruent: activeStimulus.congruent,
        correct: answerColor === expected,
        rt: performance.now() - activeSinceRef.current,
        isSwitch: activeStimulus.isSwitch
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStimulus, phase]);

  const progress = (currentIndex / sequence.length) * 100;

  return (
    <TestFrame title={title} instruction={instruction} accent={testAccent.stroop_switch.glow} progress={progress}>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Клавиши</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(keyMap).map(([key, colorKey]) => (
              <div key={key} className="rounded-2xl border border-white/8 bg-slate-950/60 px-3 py-3">
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">{key}</div>
                <div className="mt-1 font-medium" style={{ color: colorStyles[colorKey] }}>
                  {colorLabels[colorKey]}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.14),_transparent_40%),linear-gradient(180deg,rgba(9,15,31,0.86),rgba(6,10,20,0.96))] p-6">
          <div className="w-full max-w-xl rounded-[28px] border border-white/8 bg-slate-950/50 p-6 text-center">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Правило: {activeStimulus?.mode === "color" ? "Цвет" : "Слово"}
            </div>
            <div className="mt-6 text-5xl font-semibold" style={{ color: activeStimulus ? colorStyles[activeStimulus.color] : "#F8FBFF" }}>
              {activeStimulus ? colorLabels[activeStimulus.word] : "—"}
            </div>
            <div className="mt-5 text-sm text-slate-400">
              {activeStimulus?.isSwitch ? "Переключение режима" : "Повтор текущего режима"}
            </div>
          </div>
        </div>
      </div>
    </TestFrame>
  );
}

function SpatialSpanRunner({ config, title, instruction, onFinish }: RunnerProps) {
  const minSpan = Number(config.minSpan || 3);
  const maxSpan = Number(config.maxSpan || 8);
  const hiddenMs = useVisibilityTracker(true);
  const startedAtRef = useRef(performance.now());
  const attempts = useMemo(() => {
    const spans: number[] = [];
    for (let span = minSpan; span <= maxSpan; span += 1) {
      spans.push(span, span);
    }
    return spans;
  }, [maxSpan, minSpan]);

  const [attemptIndex, setAttemptIndex] = useState(0);
  const [phase, setPhase] = useState<"preview" | "input">("preview");
  const [flashIndex, setFlashIndex] = useState<number>(-1);
  const [inputSequence, setInputSequence] = useState<number[]>([]);
  const [sequence, setSequence] = useState<number[]>([]);
  const totalsRef = useRef({
    totalPositions: 0,
    correctPositions: 0,
    maxSpan: 0,
    totalCorrect: 0
  });

  useEffect(() => {
    if (attemptIndex >= attempts.length) {
      const accuracy = totalsRef.current.totalPositions
        ? (totalsRef.current.correctPositions / totalsRef.current.totalPositions) * 100
        : 0;
      onFinish({
        maxSpan: totalsRef.current.maxSpan,
        sequenceAccuracyPct: round(accuracy),
        totalCorrect: totalsRef.current.totalCorrect,
        durationMs: Math.round(performance.now() - startedAtRef.current),
        visibilityHiddenMs: Math.round(hiddenMs),
        fastResponseRatio: 0
      });
      return;
    }

    const span = attempts[attemptIndex];
    const nextSequence: number[] = [];
    while (nextSequence.length < span) {
      const candidate = Math.floor(Math.random() * 9);
      if (nextSequence[nextSequence.length - 1] === candidate) continue;
      nextSequence.push(candidate);
    }
    setSequence(nextSequence);
    setInputSequence([]);
    setPhase("preview");
    setFlashIndex(-1);
  }, [attemptIndex, attempts, hiddenMs, onFinish]);

  useEffect(() => {
    if (phase !== "preview" || !sequence.length) return;

    let current = -1;
    const timer = window.setInterval(() => {
      current += 1;
      if (current >= sequence.length) {
        window.clearInterval(timer);
        setFlashIndex(-1);
        window.setTimeout(() => setPhase("input"), 220);
        return;
      }
      setFlashIndex(sequence[current]);
    }, 600);

    return () => window.clearInterval(timer);
  }, [phase, sequence]);

  useEffect(() => {
    if (phase !== "input") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Backspace") {
        event.preventDefault();
        setInputSequence((current) => current.slice(0, -1));
        return;
      }

      const numeric = Number(event.key);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 9) return;
      event.preventDefault();
      setInputSequence((current) => {
        if (current.length >= sequence.length) return current;
        const next = [...current, numeric - 1];
        if (next.length === sequence.length) {
          window.setTimeout(() => {
            totalsRef.current.totalPositions += sequence.length;
            const correctPositions = next.filter((item, index) => item === sequence[index]).length;
            totalsRef.current.correctPositions += correctPositions;
            totalsRef.current.totalCorrect += correctPositions;
            if (correctPositions === sequence.length) {
              totalsRef.current.maxSpan = Math.max(totalsRef.current.maxSpan, sequence.length);
            }
            setAttemptIndex((currentAttempt) => currentAttempt + 1);
          }, 180);
        }
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, sequence]);

  const progress = (attemptIndex / attempts.length) * 100;

  return (
    <TestFrame title={title} instruction={instruction} accent={testAccent.spatial_span.glow} progress={progress}>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-slate-100">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Ввод</div>
          <p className="text-sm leading-6 text-slate-300">
            Используйте цифры 1-9 в соответствии с расположением клеток на поле. `Backspace` удаляет последний символ.
          </p>
          <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-4 text-sm text-slate-300">
            Последовательность: {inputSequence.map((item) => item + 1).join(" ") || "—"}
          </div>
        </div>
        <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,_rgba(216,180,254,0.16),_transparent_40%),linear-gradient(180deg,rgba(9,15,31,0.86),rgba(6,10,20,0.96))] p-6">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }, (_, index) => (
              <div
                key={index}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-[24px] border text-lg font-semibold transition-all"
                style={{
                  borderColor: flashIndex === index ? testAccent.spatial_span.accent : "rgba(148, 163, 184, 0.12)",
                  backgroundColor:
                    flashIndex === index
                      ? "rgba(216, 180, 254, 0.2)"
                      : inputSequence.includes(index)
                        ? "rgba(216, 180, 254, 0.1)"
                        : "rgba(255,255,255,0.03)",
                  color: "#F8FBFF",
                  boxShadow: flashIndex === index ? `0 0 0 1px ${testAccent.spatial_span.accent} inset` : "none"
                }}
              >
                <span>{index + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 text-sm text-slate-400">
            {phase === "preview" ? "Смотрите на вспышки и запоминайте порядок." : "Повторите последовательность цифрами 1-9."}
          </div>
        </div>
      </div>
    </TestFrame>
  );
}

function BrainTestRunner({
  runtime,
  index,
  total,
  onFinish
}: {
  runtime: AttemptRuntime;
  index: number;
  total: number;
  onFinish: (payload: Record<string, unknown>) => void;
}) {
  const commonProps = {
    config: runtime.entry.config,
    title: runtime.entry.title,
    instruction: runtime.entry.instruction,
    onFinish
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Battery flow</div>
          <div className="text-lg font-semibold text-slate-50">
            Тест {index + 1} из {total}: {runtime.entry.shortDescription}
          </div>
        </div>
        <div className="min-w-[220px]">
          <Progress value={((index + 1) / total) * 100} className="h-2 bg-white/5" />
        </div>
      </div>

      {runtime.entry.testKey === "visual_search" ? <VisualSearchRunner {...commonProps} /> : null}
      {runtime.entry.testKey === "go_no_go" ? <GoNoGoRunner {...commonProps} /> : null}
      {runtime.entry.testKey === "n_back_2" ? <NBackRunner {...commonProps} /> : null}
      {runtime.entry.testKey === "stroop_switch" ? <StroopSwitchRunner {...commonProps} /> : null}
      {runtime.entry.testKey === "spatial_span" ? <SpatialSpanRunner {...commonProps} /> : null}
    </div>
  );
}

function BrainOverlayWindow({
  title,
  eyebrow,
  accent,
  children
}: {
  title: string;
  eyebrow: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(3,7,18,0.78)] p-4 backdrop-blur-md">
      <div
        className="max-h-[92vh] w-full max-w-[1240px] overflow-hidden rounded-[34px] border shadow-[0_40px_160px_-70px_rgba(0,0,0,0.92)]"
        style={{
          background: "linear-gradient(180deg, rgba(6, 10, 22, 0.99), rgba(10, 18, 34, 0.98))",
          borderColor: "rgba(148, 163, 184, 0.16)"
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/6 px-6 py-4">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400/90" />
              <span className="h-3 w-3 rounded-full bg-amber-300/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em]" style={{ color: accent }}>
                {eyebrow}
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-50">{title}</div>
            </div>
          </div>
          <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Не закрывайте вкладку
          </div>
        </div>
        <div className="max-h-[calc(92vh-80px)] overflow-y-auto p-6 md:p-7">{children}</div>
      </div>
    </div>
  );
}

const BrainLabPanel = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [catalog, setCatalog] = useState<BrainCatalogResponse | null>(null);
  const [summary, setSummary] = useState<BrainPerformanceSummary | null>(null);
  const [history, setHistory] = useState<BrainHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [runner, setRunner] = useState<AttemptRuntime | null>(null);
  const [countdown, setCountdown] = useState<CountdownState | null>(null);
  const [batteryIndex, setBatteryIndex] = useState(0);
  const [batterySessionId, setBatterySessionId] = useState<string | null>(null);
  const [batteryResults, setBatteryResults] = useState<BrainAttemptResult[]>([]);

  const loadBrainData = async () => {
    try {
      setLoading(true);
      const [catalogResponse, summaryResponse, historyResponse] = await Promise.all([
        getBrainTestsCatalog(),
        getBrainPerformanceSummary(),
        getBrainTestsHistory()
      ]);

      setCatalog(catalogResponse.data);
      setSummary(summaryResponse.data.data);
      setHistory(historyResponse.data.data);
    } catch (error) {
      console.error("Error loading Brain Lab:", error);
      toast({
        title: "Brain Lab недоступен",
        description: "Не удалось загрузить каталог тестов и сводку.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrainData();
  }, []);

  useEffect(() => {
    if (!countdown) return;

    if (countdown.remaining > 0) {
      const timer = window.setTimeout(() => {
        setCountdown((current) => (current ? { ...current, remaining: current.remaining - 1 } : current));
      }, 1000);

      return () => window.clearTimeout(timer);
    }

    let cancelled = false;

    const bootAttempt = async () => {
      try {
        await startSingleAttempt(countdown.testKey, countdown.batterySessionId);
        if (!cancelled) {
          setCountdown(null);
        }
      } catch (error: any) {
        console.error("Error booting countdown attempt:", error);
        if (!cancelled) {
          setCountdown(null);
          toast({
            title: "Не удалось открыть тест",
            description: error?.message || "Система не смогла создать новое окно теста.",
            variant: "destructive"
          });
        }
      }
    };

    bootAttempt();

    return () => {
      cancelled = true;
    };
  }, [countdown]);

  const startSingleAttempt = async (testKey: BrainTestKey, currentSessionId: string) => {
    const response = await startBrainTestAttempt({
      testKey,
      batterySessionId: currentSessionId,
      clientMeta: getClientMeta()
    });
    const payload = response.data;
    const entry = catalog?.tests.find((item) => item.testKey === testKey);
    if (!entry) {
      throw new Error(`Не найден каталог для ${testKey}`);
    }

    setRunner({
      attemptId: payload.attemptId,
      batterySessionId: payload.batterySessionId,
      entry
    });
  };

  const queueTestStart = (testKey: BrainTestKey, currentSessionId: string, index: number) => {
    setRunner(null);
    setBatteryIndex(index);
    setCountdown({
      testKey,
      batterySessionId: currentSessionId,
      index,
      remaining: 5
    });
  };

  const startBattery = async () => {
    if (!catalog) return;
    try {
      setStarting(true);
      setBatteryResults([]);
      setBatteryIndex(0);
      const nextSessionId = createSessionId();
      setBatterySessionId(nextSessionId);
      queueTestStart(catalog.order[0], nextSessionId, 0);
    } catch (error: any) {
      console.error("Error starting brain battery:", error);
      toast({
        title: "Не удалось запустить батарею",
        description: error?.message || "Проверьте соединение и попробуйте снова.",
        variant: "destructive"
      });
    } finally {
      setStarting(false);
    }
  };

  const handleRunnerFinish = async (rawMetrics: Record<string, unknown>) => {
    if (!runner || !catalog) return;
    try {
      setFinishing(true);
      const response = await completeBrainTestAttempt(runner.attemptId, {
        rawMetrics,
        clientMeta: getClientMeta(),
        context: {
          source: "brain_lab"
        }
      });

      const nextResult = response.data.data as BrainAttemptResult;
      setBatteryResults((current) => [...current, nextResult]);

      const nextIndex = batteryIndex + 1;
      if (nextIndex < catalog.order.length && batterySessionId) {
        queueTestStart(catalog.order[nextIndex], batterySessionId, nextIndex);
        return;
      }

      setRunner(null);
      setCountdown(null);
      setBatteryIndex(0);
      await loadBrainData();
      toast({
        title: "Батарея завершена",
        description: "Сводка Brain Lab обновлена."
      });
    } catch (error: any) {
      console.error("Error completing brain attempt:", error);
      toast({
        title: "Ошибка завершения теста",
        description: error?.message || "Мы не смогли сохранить результат текущего теста.",
        variant: "destructive"
      });
    } finally {
      setFinishing(false);
    }
  };

  const trendData = summary?.trend7d || [];
  const trendMax = Math.max(
    ...trendData.map((item) => item.brainPerformanceIndex || item.rawAverageScore || 0),
    1
  );
  const latestHistoryByTest = useMemo(() => {
    const result = new Map<BrainTestKey, BrainHistoryItem>();
    history.forEach((item) => {
      if (!result.has(item.testKey)) {
        result.set(item.testKey, item);
      }
    });
    return result;
  }, [history]);

  return (
    <section
      className="rounded-[34px] border p-5 md:p-7"
      style={{
        background: PANEL_BG,
        borderColor: "rgba(148, 163, 184, 0.14)",
        boxShadow: "0 40px 120px -88px rgba(110, 231, 255, 0.72)"
      }}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(480px,0.9fr)] xl:items-start">
        <div className="max-w-4xl space-y-5 pr-0 xl:pr-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-cyan-100">
            <Brain className="h-3.5 w-3.5" />
            Brain Lab
          </div>
          <div className="space-y-3">
            <h2 className="max-w-4xl text-3xl font-semibold leading-[1.08] text-slate-50 md:text-5xl">
              Индекс когнитивной формы в живой батарее
            </h2>
            <p className="max-w-3xl text-base leading-8 text-slate-300 md:text-[1.1rem]">
              Серия из пяти коротких тестов на внимание, реакцию, память и переключение. Индекс считает текущую форму относительно вашего личного baseline и не смешивает её с readiness.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <div className="min-h-[172px] rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Индекс</div>
            <div className="mt-4 text-4xl font-semibold text-slate-50">{formatScore(summary?.brainPerformanceIndex)}</div>
            <div className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-400">
              Итоговый `brainPerformanceIndex` по вашей личной базе, а не по сравнению с другими.
            </div>
          </div>
          <div className="min-h-[172px] rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Confidence</div>
            <div className="mt-4 text-4xl font-semibold capitalize text-slate-50">{summary?.confidence || "—"}</div>
            <div className="mt-3 text-sm leading-6 text-slate-400">
              Валидных батарей: {summary?.validBatteryCount ?? 0}
            </div>
          </div>
          <div className="min-h-[172px] rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Статус</div>
            <div className="mt-4 text-[2rem] font-semibold leading-tight text-slate-50">
              {summary?.calibrationStatus === "ready" ? "Ready" : "Калибровка"}
            </div>
            <div className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-400">
              {summary?.matureBaseline ? "Личный baseline уже достаточно зрелый." : "Baseline ещё набирается и станет точнее после нескольких валидных батарей."}
            </div>
          </div>
          <div className="min-h-[172px] rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Формат</div>
            <div className="mt-4 text-[2rem] font-semibold leading-tight text-slate-50">5 тестов подряд</div>
            <div className="mt-3 max-w-[18rem] text-sm leading-6 text-slate-400">
              Полная батарея занимает 6-8 минут и рассчитана на desktop/laptop.
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex min-h-[320px] items-center justify-center rounded-[30px] border border-white/8 bg-white/[0.03]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
        </div>
      ) : isMobile ? (
        <div className="mt-10 rounded-[30px] border border-amber-300/20 bg-amber-300/10 p-7 text-amber-50">
          <div className="flex items-center gap-3 text-xl font-semibold">
            <Monitor className="h-5 w-5" />
            Доступно только на компьютере
          </div>
          <p className="mt-4 max-w-3xl text-base leading-8 text-amber-100/90">
            В v1 батарея Brain Lab поддерживается только на desktop/laptop: здесь важны клавиатурный ввод, стабильный viewport, нормальный размер окна и контроль валидности попытки.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="space-y-5">
              <div className="rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,255,0.16),_transparent_34%),linear-gradient(180deg,rgba(10,16,34,0.92),rgba(6,10,22,0.98))] p-7 md:p-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl space-y-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Daily battery</div>
                    <div className="text-3xl font-semibold leading-tight text-slate-50 md:text-[2.5rem]">
                      Один ясный контур: сначала понимание, потом запуск, потом результат
                    </div>
                    <p className="max-w-2xl text-base leading-8 text-slate-300">
                      Перед каждым тестом теперь есть 5-секундный экран-предупреждение с инструкцией. Сам тест открывается отдельным модальным окном, а на странице вы заранее видите название, формулу raw performance и статистику предыдущих попыток.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={startBattery}
                      disabled={starting || !catalog || !!countdown || !!runner}
                      className="h-14 rounded-[20px] border-0 px-6 text-base font-medium text-slate-950"
                      style={{ background: "linear-gradient(90deg, #6EE7FF, #86EFAC)" }}
                    >
                      {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                      Запустить батарею
                    </Button>
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                      Каждый тест стартует не сразу: сначала показываем инструкцию и countdown на 5 секунд.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <TimerReset className="h-3.5 w-3.5" />
                    Время батареи
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-50">6-8 минут</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">Пять тестов подряд, но каждый открывается отдельно как самостоятельное окно.</div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Валидность
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-slate-50">Контроль качества</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">Hidden tab, слишком быстрые ответы и низкая точность помечают попытку как invalid.</div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <Gauge className="h-3.5 w-3.5" />
                    Общая формула
                  </div>
                  <div className="mt-3 text-lg font-semibold text-slate-50">brainPerformanceIndex</div>
                  <div className="mt-2 text-sm leading-7 text-slate-400">{overallIndexFormula}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Индекс</div>
                <div className="mt-3 text-4xl font-semibold text-slate-50">{formatScore(summary?.brainPerformanceIndex)}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">Личная форма относительно вашего baseline, а не рейтинг против других игроков.</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Confidence</div>
                <div className="mt-3 text-4xl font-semibold capitalize text-slate-50">{summary?.confidence || "—"}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">Валидных батарей: {summary?.validBatteryCount ?? 0}</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Статус</div>
                <div className="mt-3 text-3xl font-semibold text-slate-50">{summary?.calibrationStatus === "ready" ? "Ready" : "Калибровка"}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{summary?.matureBaseline ? "Baseline уже зрелый" : "Нужно добрать ещё несколько валидных батарей"}</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Сессия</div>
                <div className="mt-3 text-3xl font-semibold text-slate-50">{batteryResults.length || history.length}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">Последние попытки уже учтены в истории и карточках ниже.</div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[30px] border border-white/8 bg-white/[0.03] p-6 md:p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Test atlas</div>
                <h3 className="text-2xl font-semibold text-slate-50">Каждый тест с формулой и предыдущей статистикой</h3>
                <p className="max-w-3xl text-sm leading-7 text-slate-300">
                  Здесь больше не нужно помнить, что именно измеряет тест. На карточке сразу видны название, логика расчёта raw performance и последняя статистика по нему.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {summary?.tests.map((test) => {
                const statusMeta = getHistoryStatusMeta(test.historyStatus);
                const previousAttempt = latestHistoryByTest.get(test.testKey);
                const formulaMeta = performanceFormulaMap[test.testKey];

                return (
                  <Card
                    key={test.testKey}
                    className="rounded-[28px] border"
                    style={{
                      background: "linear-gradient(180deg, rgba(12, 17, 34, 0.94), rgba(8, 11, 24, 0.98))",
                      borderColor: "rgba(148, 163, 184, 0.14)",
                      boxShadow: `0 24px 68px -48px ${testAccent[test.testKey].glow}`
                    }}
                  >
                    <CardHeader className="space-y-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <CardTitle className="text-2xl text-slate-50">{formulaMeta.title}</CardTitle>
                          <CardDescription className="text-sm leading-6 text-slate-300">{formulaMeta.summary}</CardDescription>
                        </div>
                        <Badge
                          className="border-0 text-[11px] uppercase tracking-[0.22em]"
                          style={{
                            backgroundColor: statusMeta.backgroundColor,
                            color: statusMeta.color
                          }}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-slate-950/45 p-4">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Как считается raw performance</div>
                        <div className="mt-3 text-base font-semibold leading-7 text-slate-50">{formulaMeta.formula}</div>
                        <div className="mt-3 text-sm leading-6 text-slate-400">{formulaMeta.detail}</div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Последний raw</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-50">{formatScore(test.latestRawScore)}</div>
                        </div>
                        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Последний form</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-50">{formatScore(test.latestFormScore)}</div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Статистика предыдущей попытки</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Дата</div>
                            <div className="mt-1 text-base text-slate-50">{formatDateTime(previousAttempt?.completedAt || test.latestCompletedAt)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Длительность</div>
                            <div className="mt-1 text-base text-slate-50">{formatDurationMs(previousAttempt?.durationMs)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Валидных за 30д</div>
                            <div className="mt-1 text-base text-slate-50">{test.validAttempts30d}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Домен</div>
                            <div className="mt-1 text-base text-slate-50">{domainLabels[test.domain] || test.domain}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Card className="rounded-[30px] border border-white/8 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-slate-50">Тренд последних 7 дней</CardTitle>
                <CardDescription className="text-slate-400">
                  Пока индекс в калибровке, жёлтые столбцы показывают raw average. Когда baseline сформирован, появляются form-based значения.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-3">
                  {trendData.map((point) => {
                    const height = (((point.brainPerformanceIndex || point.rawAverageScore || 0) / trendMax) * 100) || 0;
                    return (
                      <div key={point.date} className="flex flex-col items-center gap-3">
                        <div className="flex h-44 w-full items-end justify-center rounded-2xl border border-white/6 bg-slate-950/50 p-2">
                          <div
                            className="w-full rounded-xl"
                            style={{
                              height: `${clamp(height, 8, 100)}%`,
                              background: point.brainPerformanceIndex != null
                                ? "linear-gradient(180deg, #6EE7FF, #86EFAC)"
                                : "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(251,191,36,0.35))"
                            }}
                          />
                        </div>
                        <div className="text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          {point.date.slice(5)}
                        </div>
                        <div className="text-sm font-medium text-slate-100">
                          {formatScore(point.brainPerformanceIndex ?? point.rawAverageScore)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[30px] border border-white/8 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-slate-50">Домены, индекс и readiness overlay</CardTitle>
                <CardDescription className="text-slate-400">
                  Здесь видно, какие именно домены подтягивают индекс, а readiness остаётся рядом как отдельный слой контекста.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[22px] border border-white/8 bg-slate-950/45 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Формула общего индекса</div>
                  <div className="mt-3 text-base font-semibold leading-7 text-slate-50">{overallIndexFormula}</div>
                </div>

                {summary ? (
                  <>
                    {[
                      ["Внимание", summary.domains.attention],
                      ["Реакция и контроль", summary.domains.reactionInhibition],
                      ["Рабочая память", summary.domains.workingMemory],
                      ["Переключение", summary.domains.flexibility],
                      ["Пространственная память", summary.domains.visuospatial]
                    ].map(([label, value]) => (
                      <div key={label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>{label}</span>
                          <span className="font-medium text-slate-50">{formatScore(value as number | null)}</span>
                        </div>
                        <Progress value={typeof value === "number" ? value : 0} className="h-2 bg-white/5" />
                      </div>
                    ))}

                    <div className="rounded-[22px] border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Readiness overlay
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Фокус</div>
                          <div className="mt-1 text-lg font-semibold text-slate-50">{formatScore(summary.readinessOverlay.focus)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Усталость</div>
                          <div className="mt-1 text-lg font-semibold text-slate-50">{formatScore(summary.readinessOverlay.fatigue)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Стресс</div>
                          <div className="mt-1 text-lg font-semibold text-slate-50">{formatScore(summary.readinessOverlay.stress)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8 rounded-[30px] border border-white/8 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-slate-50">История попыток</CardTitle>
              <CardDescription className="text-slate-400">
                Каждая попытка хранится отдельно. Валидные попытки входят в baseline, калибровка копит личную историю, а исключённые попытки не влияют на индекс.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-2">
                {history.slice(0, 12).map((item) => {
                  const statusMeta = getHistoryStatusMeta(item.historyStatus);
                  return (
                    <div key={item.id} className="rounded-[24px] border border-white/8 bg-slate-950/50 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-medium text-slate-50">
                            {catalog?.tests.find((entry) => entry.testKey === item.testKey)?.title || item.testKey}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {domainLabels[item.domain] || item.domain}
                          </div>
                        </div>
                        <Badge
                          className="border-0 uppercase"
                          style={{
                            backgroundColor: statusMeta.backgroundColor,
                            color: statusMeta.color
                          }}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-4">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Raw</div>
                          <div className="mt-1 font-medium text-slate-50">{formatScore(item.rawCompositeScore)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Form</div>
                          <div className="mt-1 font-medium text-slate-50">{formatScore(item.formScore)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Дата</div>
                          <div className="mt-1">{formatDateTime(item.completedAt)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Длительность</div>
                          <div className="mt-1">{formatDurationMs(item.durationMs)}</div>
                        </div>
                      </div>
                      {item.invalidReasons.length ? (
                        <div className="mt-4 space-y-2">
                          {item.invalidReasons.map((reason) => {
                            const copy = getReadableInvalidReason(reason);
                            return (
                              <div
                                key={`${item.id}-${reason}`}
                                className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-xs leading-6 text-rose-100"
                              >
                                <div className="font-medium text-rose-50">{copy.title}</div>
                                <div className="mt-1 text-rose-100/90">{copy.description}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {countdown && catalog ? (
        <BrainOverlayWindow
          eyebrow={`Тест ${countdown.index + 1} из ${catalog.order.length}`}
          title={`${performanceFormulaMap[countdown.testKey].title} стартует через ${countdown.remaining} сек`}
          accent={testAccent[countdown.testKey].accent}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,255,0.14),_transparent_34%),linear-gradient(180deg,rgba(10,16,34,0.92),rgba(6,10,22,0.98))] p-6">
                <div className="text-[11px] uppercase tracking-[0.24em]" style={{ color: testAccent[countdown.testKey].accent }}>
                  Предупреждение перед стартом
                </div>
                <h3 className="mt-3 text-3xl font-semibold text-slate-50">{performanceFormulaMap[countdown.testKey].title}</h3>
                <p className="mt-4 text-base leading-8 text-slate-300">{performanceFormulaMap[countdown.testKey].summary}</p>
                <div className="mt-5 rounded-[22px] border border-white/8 bg-slate-950/45 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Что делать</div>
                  <div className="mt-3 text-base leading-7 text-slate-100">
                    {catalog.tests.find((entry) => entry.testKey === countdown.testKey)?.instruction}
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Формула raw performance</div>
                <div className="mt-3 text-lg font-semibold leading-8 text-slate-50">{performanceFormulaMap[countdown.testKey].formula}</div>
                <div className="mt-3 text-sm leading-7 text-slate-400">{performanceFormulaMap[countdown.testKey].detail}</div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-6 text-center">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Старт через</div>
                <div className="mt-4 text-7xl font-semibold text-slate-50">{countdown.remaining}</div>
                <div className="mt-4 text-sm leading-7 text-slate-400">
                  У вас есть несколько секунд спокойно прочитать инструкцию и подготовить руки на клавиатуре.
                </div>
              </div>
              <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Перед стартом
                </div>
                <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                  <p>1. Не переключайте вкладку и не сворачивайте окно.</p>
                  <p>2. Читайте правило именно этого теста, а не всей батареи.</p>
                  <p>3. После нуля тест откроется в этом же отдельном окне.</p>
                </div>
              </div>
            </div>
          </div>
        </BrainOverlayWindow>
      ) : null}

      {runner && catalog ? (
        <BrainOverlayWindow
          eyebrow={`Тест ${batteryIndex + 1} из ${catalog.order.length}`}
          title={runner.entry.title}
          accent={testAccent[runner.entry.testKey].accent}
        >
          <div className="mb-4 flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            <ShieldCheck className="h-4 w-4 text-cyan-200" />
            Невалидные попытки сохраняются в истории, но не участвуют в индексе и baseline.
            {finishing ? <Loader2 className="ml-auto h-4 w-4 animate-spin text-cyan-200" /> : null}
          </div>
          <BrainTestRunner runtime={runner} index={batteryIndex} total={catalog.order.length} onFinish={handleRunnerFinish} />
        </BrainOverlayWindow>
      ) : null}
    </section>
  );
};

export default BrainLabPanel;
