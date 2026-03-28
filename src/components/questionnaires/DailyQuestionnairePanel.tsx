import { useEffect, useMemo, useState } from "react";
import { Brain, ClipboardList, Clock3, Gauge, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { submitDailyQuestionnaire } from "@/lib/api";
import { COLORS } from "@/styles/theme";

type DailyQuestionnairePanelProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  onSaved?: () => void | Promise<void>;
};

const fieldStyle = {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderColor: COLORS.borderColor,
  color: COLORS.textColor
};

const today = () => new Date().toISOString().split("T")[0];

export default function DailyQuestionnairePanel({
  eyebrow = "Daily self-check",
  title = "Ежедневный опросник без ощущения тяжёлой формы",
  description = "Разбил ввод на понятные блоки: сон, экранное время и итоговый контроль суммы. Так заполнять быстрее, а проверять себя проще.",
  onSaved
}: DailyQuestionnairePanelProps) {
  const { toast } = useToast();
  const [qDate, setQDate] = useState<string>(today());
  const [qSleepStart, setQSleepStart] = useState<string>("");
  const [qSleepEnd, setQSleepEnd] = useState<string>("");
  const [qSleep, setQSleep] = useState<string>("");
  const [qScreen, setQScreen] = useState<string>("");
  const [qScreenEntertainment, setQScreenEntertainment] = useState<string>("");
  const [qScreenCommunication, setQScreenCommunication] = useState<string>("");
  const [qScreenBrowser, setQScreenBrowser] = useState<string>("");
  const [qScreenStudy, setQScreenStudy] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const parseOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseTimeToMinutes = (value: string) => {
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const getSleepHoursByRange = (from: string, to: string) => {
    const fromMinutes = parseTimeToMinutes(from);
    const toMinutes = parseTimeToMinutes(to);
    if (fromMinutes === null || toMinutes === null) return undefined;
    const diffMinutes =
      toMinutes >= fromMinutes ? toMinutes - fromMinutes : 24 * 60 - fromMinutes + toMinutes;
    return Number((diffMinutes / 60).toFixed(2));
  };

  useEffect(() => {
    if (!qSleepStart || !qSleepEnd) return;
    const hours = getSleepHoursByRange(qSleepStart, qSleepEnd);
    if (hours === undefined) return;
    setQSleep(String(hours));
  }, [qSleepStart, qSleepEnd]);

  const qDateLabel = useMemo(() => {
    const parsed = new Date(qDate);
    return Number.isNaN(parsed.getTime())
      ? qDate
      : parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  }, [qDate]);

  const questionnaireBreakdownSum =
    (parseFloat(qScreenEntertainment) || 0) +
    (parseFloat(qScreenCommunication) || 0) +
    (parseFloat(qScreenBrowser) || 0) +
    (parseFloat(qScreenStudy) || 0);
  const questionnaireTotalScreen = parseFloat(qScreen) || 0;
  const hasQuestionnaireTotal = qScreen.trim().length > 0;
  const isQuestionnaireExceeded = hasQuestionnaireTotal && questionnaireBreakdownSum > questionnaireTotalScreen;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
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
      const hasBreakdown = [entertainment, communication, browser, study].some((value) => value !== undefined);
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

      await submitDailyQuestionnaire({
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
      });

      toast({ title: "Сохранено", description: "Данные опросника сохранены" });
      await onSaved?.();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Ошибка сохранения";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section
        className="rounded-[28px] border p-5 md:p-6"
        style={{
          background: "linear-gradient(150deg, rgba(0, 227, 150, 0.1), rgba(17, 24, 39, 0.96) 68%)",
          borderColor: "rgba(16, 185, 129, 0.2)"
        }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", color: COLORS.textColorSecondary }}
            >
              <Brain className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <div>
              <h3 className="text-2xl font-semibold" style={{ color: COLORS.textColor }}>
                {title}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
                {description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
            <div
              className="rounded-[20px] border px-4 py-3"
              style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>
                Дата
              </div>
              <div className="mt-1 text-base font-semibold" style={{ color: COLORS.textColor }}>
                {qDateLabel}
              </div>
            </div>
            <div
              className="rounded-[20px] border px-4 py-3"
              style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>
                Сон
              </div>
              <div className="mt-1 text-base font-semibold" style={{ color: COLORS.textColor }}>
                {qSleep || "-"}
              </div>
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
                <Input type="date" value={qDate} onChange={(event) => setQDate(event.target.value)} className="rounded-2xl" style={fieldStyle} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label style={{ color: COLORS.textColor }}>Сон: с</Label>
                  <Input type="time" value={qSleepStart} onChange={(event) => setQSleepStart(event.target.value)} className="rounded-2xl" style={fieldStyle} />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: COLORS.textColor }}>Сон: до</Label>
                  <Input type="time" value={qSleepEnd} onChange={(event) => setQSleepEnd(event.target.value)} className="rounded-2xl" style={fieldStyle} />
                </div>
              </div>
              <div className="rounded-[22px] border p-4" style={{ borderColor: COLORS.borderColor, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <Label style={{ color: COLORS.textColor }}>Сон (часы, авто или вручную)</Label>
                <Input
                  value={qSleep}
                  onChange={(event) => setQSleep(event.target.value)}
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
                  onChange={(event) => setQScreen(event.target.value)}
                  inputMode="decimal"
                  placeholder="Можно оставить пустым, если заполнена детализация"
                  className="rounded-2xl"
                  style={fieldStyle}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input value={qScreenEntertainment} onChange={(event) => setQScreenEntertainment(event.target.value)} inputMode="decimal" placeholder="Развлечения" className="rounded-2xl" style={fieldStyle} />
                <Input value={qScreenCommunication} onChange={(event) => setQScreenCommunication(event.target.value)} inputMode="decimal" placeholder="Общение" className="rounded-2xl" style={fieldStyle} />
                <Input value={qScreenBrowser} onChange={(event) => setQScreenBrowser(event.target.value)} inputMode="decimal" placeholder="Браузер" className="rounded-2xl" style={fieldStyle} />
                <Input value={qScreenStudy} onChange={(event) => setQScreenStudy(event.target.value)} inputMode="decimal" placeholder="Учёба / работа" className="rounded-2xl" style={fieldStyle} />
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
              <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>
                Сумма подкатегорий
              </div>
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
                <li>
                  Экранное время: {qScreen || (questionnaireBreakdownSum > 0 ? `${questionnaireBreakdownSum.toFixed(1)} ч по детализации` : "не указано")}
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button onClick={handleSubmit} disabled={submitting || isQuestionnaireExceeded} className="h-12 w-full rounded-2xl" style={{ backgroundColor: COLORS.primary, color: "white" }}>
              {submitting ? "Сохранение..." : "Сохранить опросник"}
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
