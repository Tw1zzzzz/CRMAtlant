import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ROUTES from "@/lib/routes";
import { COLORS } from "@/styles/theme";
import { cn } from "@/lib/utils";

type SubscriptionFeatureGateProps = {
  hasAccess: boolean;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  minHeightClassName?: string;
  buttonText?: string;
};

const SubscriptionFeatureGate = ({
  hasAccess,
  title,
  description,
  children,
  className,
  contentClassName,
  minHeightClassName = "min-h-[440px]",
  buttonText = "Купить",
}: SubscriptionFeatureGateProps) => {
  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] border",
        minHeightClassName,
        className
      )}
      style={{
        borderColor: "rgba(125, 211, 252, 0.22)",
        background:
          "radial-gradient(circle at top left, rgba(125, 211, 252, 0.14), transparent 34%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 28%), linear-gradient(160deg, rgba(10, 14, 24, 0.84), rgba(17, 24, 39, 0.92))",
        boxShadow: "0 38px 120px -84px rgba(56, 189, 248, 0.7)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.16), transparent 18%), radial-gradient(circle at 78% 18%, rgba(255,255,255,0.12), transparent 16%), radial-gradient(circle at 50% 78%, rgba(255,255,255,0.08), transparent 20%)",
        }}
      />

      <div className={cn("pointer-events-none select-none blur-[10px] saturate-[0.85]", contentClassName)}>
        {children}
      </div>

      <div className="absolute inset-0 flex items-start justify-center p-6 pt-10 md:p-10 md:pt-14">
        <div
          className="w-full max-w-2xl rounded-[28px] border px-6 py-8 text-center md:px-8"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
            borderColor: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 26px 90px -60px rgba(255,255,255,0.55)",
          }}
        >
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em]"
            style={{
              color: "#D6F7FF",
              backgroundColor: "rgba(6, 11, 23, 0.42)",
              borderColor: "rgba(191, 219, 254, 0.2)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            PerformanceCoach CRM
          </div>

          <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.08)" }}>
            <Lock className="h-6 w-6" style={{ color: COLORS.textColor }} />
          </div>

          <h3 className="mt-5 text-2xl font-semibold md:text-3xl" style={{ color: COLORS.textColor }}>
            {title}
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 md:text-base" style={{ color: "rgba(226, 232, 240, 0.82)" }}>
            {description}
          </p>

          <div className="mt-6 flex items-center justify-center">
            <Link to={ROUTES.PRICING}>
              <Button
                className="h-12 rounded-2xl px-6"
                style={{
                  background: "linear-gradient(135deg, #38BDF8, #10B981)",
                  color: "#04111D",
                  boxShadow: "0 18px 50px -26px rgba(56, 189, 248, 0.95)",
                }}
              >
                {buttonText}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionFeatureGate;
