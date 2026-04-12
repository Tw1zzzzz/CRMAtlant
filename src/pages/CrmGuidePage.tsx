import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Compass,
  LifeBuoy,
  MonitorSmartphone,
  Sparkles,
} from "lucide-react";
import PageIntro from "@/components/PageIntro";
import SupportRequestDialog from "@/components/SupportRequestDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import ROUTES from "@/lib/routes";
import {
  guideFaq,
  guideMapCards,
  guideQuickStart,
  guideRoleHighlights,
  guideSections,
  guideWorkflows,
  type GuideAudience,
} from "@/lib/crmGuideContent";
import { PRODUCT_NAME } from "@/lib/productCopy";
import { useAuth } from "@/hooks/useAuth";

const sectionBaseClass =
  "rounded-[28px] border border-slate-800/80 bg-slate-950/60 shadow-[0_28px_80px_-58px_rgba(30,127,247,0.75)]";

const CrmGuidePage = () => {
  const { user } = useAuth();
  const [activeAudience, setActiveAudience] = useState<Exclude<GuideAudience, "common">>(
    user?.role === "staff" ? "staff" : "player"
  );

  const visibleSections = useMemo(
    () => guideSections.filter((section) => section.audience === "common" || section.audience === activeAudience),
    [activeAudience]
  );

  const visibleMapCards = useMemo(
    () => guideMapCards.filter((card) => card.audience === "all" || card.audience === activeAudience),
    [activeAudience]
  );

  const tableOfContents = useMemo(
    () => [
      { id: "quick-start", label: "Быстрый старт" },
      { id: "product-map", label: "Карта продукта" },
      { id: "role-mode", label: activeAudience === "player" ? "Режим player" : "Режим staff" },
      { id: "workflows", label: "Пошаговые сценарии" },
      ...visibleSections.map((section) => ({ id: section.id, label: section.title })),
      { id: "faq-support", label: "FAQ и поддержка" },
    ],
    [activeAudience, visibleSections]
  );

  const roleTitle = activeAudience === "player" ? "Player" : "Staff";

  return (
    <div className="container mx-auto space-y-6 p-6">
      <PageIntro
        eyebrow="Помощь и onboarding"
        title={`Гайд по ${PRODUCT_NAME}`}
        description="Это единая карта продукта для player и staff. Она помогает быстро понять, в каком порядке открывать модули CRM, где смотреть ранние сигналы и как переходить от общего обзора к точечной работе."
        collapsible
        bullets={[
          "Одна вкладка для общего понимания продукта",
          "Role-specific блоки для player и staff",
          "Карточки модулей, визуальные примеры и короткие сниппеты",
        ]}
        actions={
          <Card className="border-sky-300/20 bg-slate-950/70">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sky-100">
                <BookOpen className="h-4 w-4" />
                <span className="text-sm font-medium">Как пользоваться страницей</span>
              </div>
              <p className="text-sm leading-6 text-slate-300">
                Сначала пройдите быстрый старт, затем переключите режим на свой профиль и используйте оглавление слева,
                чтобы быстро прыгать к нужному блоку.
              </p>
              <Button asChild className="w-full bg-sky-500 text-white hover:bg-sky-400">
                <Link to={ROUTES.DASHBOARD}>Вернуться в обзор</Link>
              </Button>
            </CardContent>
          </Card>
        }
      />

      <div className="xl:hidden">
        <div className="flex flex-wrap gap-2">
          {tableOfContents.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-sky-400/50 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-6 space-y-4 rounded-[28px] border border-slate-800/80 bg-slate-950/80 p-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-sky-100">
                <Compass className="h-3.5 w-3.5" />
                Навигация
              </div>
              <p className="text-sm leading-6 text-slate-300">
                Используйте оглавление как быстрый маршрут по странице, когда нужно объяснить CRM новому пользователю или
                быстро вспомнить рабочий порядок.
              </p>
            </div>

            <div className="space-y-2">
              {tableOfContents.map((item, index) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section id="quick-start" className={cn(sectionBaseClass, "p-6 md:p-7")}>
            <div className="mb-5 flex items-center gap-3">
              <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-100">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Быстрый старт
              </Badge>
              <p className="text-sm text-slate-400">3 шага, чтобы объяснить CRM без длинного онбординга</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {guideQuickStart.map((item, index) => (
                <Card key={item.id} className="border-slate-800 bg-slate-900/70">
                  <CardHeader className="space-y-3">
                    <Badge variant="outline" className="w-fit border-slate-700 text-slate-300">
                      Шаг {index + 1}
                    </Badge>
                    <CardTitle className="text-xl text-white">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-slate-300">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section id="product-map" className={cn(sectionBaseClass, "p-6 md:p-7")}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-200">
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  Карта продукта
                </Badge>
                <h2 className="text-2xl font-semibold text-white">Какие разделы открывать и в каком порядке</h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-300">
                  Это не полный список всех экранов CRM, а рабочая витрина модулей, через которые пользователь чаще всего
                  проходит свой сценарий.
                </p>
              </div>
              <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-100">
                Режим: {roleTitle}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {visibleMapCards.map((card) => (
                <Card key={card.id} className="border-slate-800 bg-slate-900/70">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-xl text-white">{card.title}</CardTitle>
                    <CardDescription className="leading-6 text-slate-300">{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
                      <Link to={card.href}>
                        Перейти в раздел
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section id="role-mode" className={cn(sectionBaseClass, "p-6 md:p-7")}>
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-200">
                  <MonitorSmartphone className="mr-1 h-3.5 w-3.5" />
                  Role-specific режим
                </Badge>
                <h2 className="text-2xl font-semibold text-white">Показываем только ваш контур работы</h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-300">
                  Общие блоки ниже видны всегда, а модульные пояснения подстраиваются под роль. Это помогает не перегружать
                  страницу чужими сценариями.
                </p>
              </div>
              <Tabs value={activeAudience} onValueChange={(value) => setActiveAudience(value as "player" | "staff")}>
                <TabsList className="h-auto rounded-2xl border border-slate-700 bg-slate-950 p-1">
                  <TabsTrigger value="player" className="rounded-xl px-4 py-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
                    Player
                  </TabsTrigger>
                  <TabsTrigger value="staff" className="rounded-xl px-4 py-2 data-[state=active]:bg-sky-500 data-[state=active]:text-white">
                    Staff
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {guideRoleHighlights[activeAudience].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm leading-6 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section id="workflows" className={cn(sectionBaseClass, "p-6 md:p-7")}>
            <div className="mb-5 space-y-2">
              <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-200">
                <Compass className="mr-1 h-3.5 w-3.5" />
                Пошаговые сценарии
              </Badge>
              <h2 className="text-2xl font-semibold text-white">Где нажать и что делать дальше</h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                Здесь собраны самые практичные сценарии: как staff создать команду, где обновить название и коды, и как
                игроку или сотруднику подключиться по правильному team-коду без лишних догадок.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {guideWorkflows
                .filter((item) => item.audience === "common" || item.audience === activeAudience)
                .map((item) => (
                  <Card key={item.id} className="border-slate-800 bg-slate-900/70">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-sky-400/30 bg-sky-400/10 text-sky-100",
                            item.audience === "staff" && "border-violet-400/30 bg-violet-400/10 text-violet-100"
                          )}
                        >
                          {item.audience === "player" ? "Player" : item.audience === "staff" ? "Staff" : "Общий"}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {item.hrefLabel}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-xl text-white">{item.title}</CardTitle>
                        <CardDescription className="leading-6 text-slate-300">{item.description}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ol className="space-y-3">
                        {item.steps.map((step, index) => (
                          <li key={step} className="flex gap-3 text-sm leading-6 text-slate-200">
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-100">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>

                      <Button asChild variant="outline" className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
                        <Link to={item.href}>
                          {item.hrefLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>

          {visibleSections.map((section) => (
            <section key={section.id} id={section.id} className={cn(sectionBaseClass, "overflow-hidden")}>
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_440px]">
                <div className="p-6 md:p-7">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-100">
                        {section.audience === "common" ? "Общий модуль" : section.audience === "player" ? "Player" : "Staff"}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        {section.hrefLabel}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                      <p className="text-sm leading-7 text-slate-300">{section.summary}</p>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Как использовать</h3>
                        <ol className="space-y-3">
                          {section.steps.map((step, index) => (
                            <li key={step} className="flex gap-3 text-sm leading-6 text-slate-200">
                              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-100">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Ключевые акценты</h3>
                        <div className="flex flex-wrap gap-2">
                          {section.bullets.map((bullet) => (
                            <span
                              key={bullet}
                              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-200"
                            >
                              {bullet}
                            </span>
                          ))}
                        </div>

                        <Button asChild className="mt-2 bg-sky-500 text-white hover:bg-sky-400">
                          <Link to={section.href}>
                            {section.hrefLabel}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 bg-[radial-gradient(circle_at_top,_rgba(30,127,247,0.18),_transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.96))] p-5 lg:border-l lg:border-t-0">
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80">
                    <img src={section.visual.src} alt={section.visual.alt} className="h-auto w-full object-cover" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-white">{section.visual.caption}</p>
                    <p className="text-sm leading-6 text-slate-300">{section.visual.focusLabel}</p>
                  </div>
                </div>
              </div>
            </section>
          ))}

          <section id="faq-support" className={cn(sectionBaseClass, "p-6 md:p-7")}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-200">
                    <LifeBuoy className="mr-1 h-3.5 w-3.5" />
                    FAQ и поддержка
                  </Badge>
                  <h2 className="text-2xl font-semibold text-white">Куда идти, если остались вопросы</h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300">
                    Здесь собраны короткие ответы на типовые вопросы и быстрый переход в уже существующий канал поддержки
                    внутри CRM.
                  </p>
                </div>

                <div className="space-y-3">
                  {guideFaq.map((item, index) => (
                    <Card key={item.id} className="border-slate-800 bg-slate-900/70">
                      <CardHeader className="space-y-2">
                        <CardDescription className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Вопрос {index + 1}
                        </CardDescription>
                        <CardTitle className="text-lg text-white">{item.question}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-6 text-slate-300">{item.answer}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="h-fit border-sky-400/20 bg-slate-950/75">
                <CardHeader className="space-y-3">
                  <Badge variant="outline" className="w-fit border-sky-400/30 bg-sky-400/10 text-sky-100">
                    Поддержка
                  </Badge>
                  <CardTitle className="text-xl text-white">Нужна помощь по CRM?</CardTitle>
                  <CardDescription className="leading-6 text-slate-300">
                    Если сценарий не описан в этом гайде или возникла ошибка в рабочем потоке, отправьте запрос прямо из
                    продукта.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm leading-6 text-slate-300">
                    <p>Поддержка поможет с доступами, ошибками интерфейса, платежами и вопросами по использованию CRM.</p>
                    <Separator className="bg-slate-800" />
                    <SupportRequestDialog variant="inline" />
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                    Для быстрого старта:
                    <ul className="mt-2 space-y-2">
                      <li>Откройте обзор, если хотите понять текущую картину.</li>
                      <li>Перейдите в тарифы, если ждёте закрытую аналитику.</li>
                      <li>Используйте этот гайд как навигационную карту для новых пользователей.</li>
                    </ul>
                  </div>

                  <Button asChild variant="outline" className="w-full border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
                    <Link to={ROUTES.PRICING}>Посмотреть тарифы</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CrmGuidePage;
