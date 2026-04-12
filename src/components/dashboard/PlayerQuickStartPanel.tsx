import { CheckCheck, ClipboardList, MoonStar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COLORS } from "@/styles/theme";
import { PRODUCT_NAME } from "@/lib/productCopy";

type PlayerQuickStartPanelProps = {
  baselineAssessmentCompleted: boolean;
  sleepDoneToday: boolean;
  testsDone: boolean;
  hasResultsAccess: boolean;
  onOpenBaselineAssessment: () => void;
  onOpenSleepTab: () => void;
  onOpenTests: () => void;
};

const checklistCard = {
  backgroundColor: COLORS.cardBackground,
  borderColor: COLORS.borderColor,
  boxShadow: "0 1px 20px 0 rgba(0,0,0,.1)"
};

export default function PlayerQuickStartPanel({
  baselineAssessmentCompleted,
  sleepDoneToday,
  testsDone,
  hasResultsAccess,
  onOpenBaselineAssessment,
  onOpenSleepTab,
  onOpenTests
}: PlayerQuickStartPanelProps) {
  const items = [
    {
      title: "Пройти базовую анкету",
      description: baselineAssessmentCompleted
        ? hasResultsAccess
          ? "Профиль игрока уже собран и доступен в вашей карточке."
          : "Анкета уже пройдена. Итоговая расшифровка сохранена и откроется после покупки тарифа."
        : "Зафиксируйте личностный контур и игровую роль, чтобы система собрала красивую стартовую карточку.",
      done: baselineAssessmentCompleted,
      action: onOpenBaselineAssessment,
      actionLabel: baselineAssessmentCompleted ? "Открыть анкету" : "Начать тест"
    },
    {
      title: "Заполнить сон и экранное время за сегодня",
      description: sleepDoneToday
        ? hasResultsAccess
          ? "Сегодняшняя ежедневная проверка восстановления уже сохранена."
          : "Сегодняшняя проверка восстановления уже сохранена. Полная история откроется после покупки тарифа."
        : "Лучше фиксировать восстановление сразу после первого захода в систему.",
      done: sleepDoneToday,
      action: onOpenSleepTab,
      actionLabel: "Открыть вкладку сон"
    },
    {
      title: "Перейти к тестам",
      description: testsDone
        ? hasResultsAccess
          ? "История тестов уже есть, можно продолжать рабочий ритм."
          : "Тесты уже пройдены. История и аналитика сохранены, но откроются после покупки."
        : "Запустите Brain Lab или добавьте первый тест, чтобы у системы появился базовый контур формы.",
      done: testsDone,
      action: onOpenTests,
      actionLabel: "Открыть тесты"
    }
  ];

  return (
    <div className="space-y-5">
      <section
        className="rounded-[28px] border p-5 md:p-6"
        style={{
          background: "linear-gradient(145deg, rgba(53, 144, 255, 0.14), rgba(17, 24, 39, 0.96) 68%)",
          borderColor: "rgba(96, 165, 250, 0.2)"
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Первый вход
            </div>
            <h3 className="mt-4 text-2xl font-semibold" style={{ color: COLORS.textColor }}>
              Быстрый старт без лишнего трения
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
              Здесь собраны первые обязательные действия: стартовая анкета, ежедневная проверка восстановления и быстрый вход в тестовый контур.
            </p>
            {!hasResultsAccess && (
              <p className="mt-2 max-w-2xl text-sm leading-7" style={{ color: "#B6F0FF" }}>
                Прохождение доступно бесплатно. Расширенная расшифровка и полная история откроются после покупки тарифа {PRODUCT_NAME}.
              </p>
            )}
          </div>
          <div className="rounded-[20px] border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" }}>
            <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: COLORS.textColorSecondary }}>
              Прогресс старта
            </div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: COLORS.textColor }}>
              {items.filter((item) => item.done).length}/{items.length}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {items.map((item, index) => (
          <Card key={item.title} style={checklistCard} className="rounded-[24px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: item.done ? "rgba(16,185,129,0.24)" : "rgba(96,165,250,0.24)", backgroundColor: item.done ? "rgba(16,185,129,0.12)" : "rgba(53,144,255,0.12)", color: item.done ? "#7EF3D1" : COLORS.primary }}>
                  {index === 0 ? <ClipboardList className="h-5 w-5" /> : index === 1 ? <MoonStar className="h-5 w-5" /> : <CheckCheck className="h-5 w-5" />}
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: item.done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                    color: item.done ? "#7EF3D1" : COLORS.textColorSecondary
                  }}
                >
                  {item.done ? "Готово" : "В работе"}
                </span>
              </div>
              <CardTitle className="text-lg" style={{ color: COLORS.textColor }}>{item.title}</CardTitle>
              <CardDescription className="text-sm leading-7" style={{ color: COLORS.textColorSecondary }}>
                {item.description}
              </CardDescription>
            </CardHeader>
            {item.action && (
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full rounded-2xl"
                  style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}
                  onClick={item.action}
                >
                  {item.actionLabel}
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
