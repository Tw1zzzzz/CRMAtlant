import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ROUTES from "@/lib/routes";
import { COLORS } from "@/styles/theme";
import { cn } from "@/lib/utils";

type LockedResultsGateProps = {
  hasAccess: boolean;
  hasData?: boolean;
  isLoading?: boolean;
  error?: string | null;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  minHeightClassName?: string;
  ctaText?: string;
  compact?: boolean;
};

const LockedResultsGate = ({
  hasAccess,
  hasData = false,
  isLoading = false,
  error,
  title,
  description,
  children,
  className,
  contentClassName,
  minHeightClassName = "min-h-[320px]",
  ctaText = "Открыть результаты",
  compact = false,
}: LockedResultsGateProps) => {
  if (hasAccess) {
    return <>{children}</>;
  }

  const stateMeta = isLoading
    ? {
        badge: "Загрузка",
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        accentColor: "#B6F0FF",
        helper: "Проходить задания можно уже сейчас, полная витрина результатов подтянется после оплаты."
      }
    : error
      ? {
          badge: "Временная ошибка",
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          accentColor: "#FECACA",
          helper: error
        }
      : hasData
        ? {
            badge: "Результат сохранён",
            icon: <Lock className="h-3.5 w-3.5" />,
            accentColor: "#86EFAC",
            helper: "Прохождение уже сохранено. После покупки откроются score, история, аналитика и расшифровка."
          }
        : {
            badge: "Можно пройти бесплатно",
            icon: <Sparkles className="h-3.5 w-3.5" />,
            accentColor: "#B6F0FF",
            helper: "Сначала пройдите шаги бесплатно. Когда результаты появятся, этот блок раскроется после покупки."
          };

  return (
    <div
      className={cn("relative overflow-hidden rounded-[30px] border", minHeightClassName, className)}
      style={{
        borderColor: "rgba(125, 211, 252, 0.18)",
        background:
          "radial-gradient(circle at top left, rgba(125, 211, 252, 0.12), transparent 36%), linear-gradient(165deg, rgba(10, 14, 24, 0.88), rgba(17, 24, 39, 0.94))",
      }}
    >
      <div
        aria-hidden="true"
        className={cn("pointer-events-none select-none blur-[10px] saturate-[0.82]", contentClassName)}
      >
        {children}
      </div>

      <div className={cn("absolute inset-0 flex items-center justify-center", compact ? "p-3 md:p-4" : "p-4 md:p-6")}>
        <div
          className={cn(
            "w-full rounded-[24px] border text-center",
            compact
              ? "max-w-[440px] px-4 py-3"
              : "max-w-[460px] px-4 py-5 md:px-6 md:py-6"
          )}
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07))",
            borderColor: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 26px 90px -60px rgba(255,255,255,0.5)",
          }}
        >
          <div
            className={cn(
              "mx-auto inline-flex items-center gap-2 rounded-full border font-medium uppercase",
              compact
                ? "px-3 py-1 text-[8px] tracking-[0.18em]"
                : "px-3 py-1 text-[10px] tracking-[0.22em]"
            )}
            style={{
              color: stateMeta.accentColor,
              backgroundColor: "rgba(6, 11, 23, 0.42)",
              borderColor: "rgba(191, 219, 254, 0.2)",
            }}
          >
            {stateMeta.icon}
            {stateMeta.badge}
          </div>

          <div
            className={cn(
              "mx-auto flex items-center justify-center rounded-2xl border",
              compact ? "mt-2.5 h-9 w-9" : "mt-4 h-12 w-12"
            )}
            style={{ borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <Lock className={cn(compact ? "h-3.5 w-3.5" : "h-5 w-5")} style={{ color: COLORS.textColor }} />
          </div>

          <h3
            className={cn(
              "font-semibold leading-tight",
              compact ? "mt-2.5 text-[0.95rem] md:text-[1.1rem]" : "mt-4 text-xl md:text-[1.75rem]"
            )}
            style={{ color: COLORS.textColor }}
          >
            {title}
          </h3>
          <p
            className={cn(
              "mx-auto max-w-[34ch]",
              compact ? "mt-1.5 text-[11px] leading-5 md:text-[12px]" : "mt-3 text-sm leading-6 md:text-[15px]"
            )}
            style={{ color: "rgba(226, 232, 240, 0.82)" }}
          >
            {description}
          </p>
          {!compact && (
            <p
              className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-6 md:text-sm"
              style={{ color: "rgba(191, 219, 254, 0.82)" }}
            >
              {stateMeta.helper}
            </p>
          )}

          <div className={cn("flex items-center justify-center", compact ? "mt-2.5" : "mt-5")}>
            <Link to={ROUTES.PRICING}>
              <Button
                className={cn("rounded-2xl", compact ? "h-8 px-4 text-[11px]" : "h-11 px-5")}
                style={{
                  background: "linear-gradient(135deg, #38BDF8, #10B981)",
                  color: "#04111D",
                  boxShadow: "0 18px 50px -26px rgba(56, 189, 248, 0.95)",
                }}
              >
                {ctaText}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LockedResultsGate;
