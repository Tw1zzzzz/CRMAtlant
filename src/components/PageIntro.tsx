import { ReactNode, useId, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  actions?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

const PageIntro = ({
  eyebrow,
  title,
  description,
  bullets = [],
  actions,
  collapsible = false,
  defaultExpanded = true,
}: PageIntroProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <section
        className={cn(
          "relative rounded-[28px] border border-sky-400/20 shadow-[0_26px_80px_-60px_rgba(56,189,248,0.9)] transition-all duration-300",
          collapsible
            ? isExpanded
              ? "px-5 py-6 md:px-7"
              : "px-4 py-3 md:px-5"
            : "px-5 py-6 md:px-7",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,rgba(53,144,255,0.12),rgba(17,24,39,0.96)_68%)]"
          aria-hidden
        />

        {collapsible ? (
          <div className="flex items-start justify-between gap-4">
            <div className={cn("min-w-0", isExpanded ? "max-w-3xl space-y-3" : "flex min-w-0 items-center gap-3")}>
              <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              {!isExpanded ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100 md:text-base">
                    {title}
                  </p>
                  <p className="hidden truncate text-xs text-slate-400 md:block">
                    Блок скрыт. Нажмите, чтобы снова показать пояснение.
                  </p>
                </div>
              ) : null}
            </div>

            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                aria-expanded={isExpanded}
                aria-controls={contentId}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 shrink-0" />
                    Скрыть блок
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                    Показать блок
                  </>
                )}
              </button>
            </CollapsibleTrigger>
          </div>
        ) : null}

        <CollapsibleContent
          id={contentId}
          forceMount={!collapsible}
          className={cn(
            "overflow-hidden",
            collapsible && "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
          )}
        >
          <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", collapsible && "pt-5")}>
            <div className="max-w-3xl space-y-3">
              {!collapsible ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  {eyebrow}
                </div>
              ) : null}
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-white md:text-4xl">{title}</h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                  {description}
                </p>
              </div>
              {bullets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-slate-100"
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {actions ? <div className="lg:min-w-[260px]">{actions}</div> : null}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};

export default PageIntro;
