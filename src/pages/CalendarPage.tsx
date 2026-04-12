import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { DatesSetArg, DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { addDays, addHours, endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { CalendarDays, Loader2, Lock, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  notifyCalendarEventsUpdated,
  updateCalendarEvent,
} from "@/lib/calendarApi";
import ROUTES from "@/lib/routes";
import type { CalendarEvent, CalendarEventScope, CalendarEventUpsertPayload } from "@/types";
import { COLORS } from "@/styles/theme";
import "./calendar-page.css";

type CalendarFormState = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
};

const EVENT_COLORS = ["#3590FF", "#00E396", "#FEB019", "#FF4560", "#775DD0", "#14B8A6"];

const buildInitialRange = () => {
  const now = new Date();
  return {
    from: startOfMonth(now).toISOString(),
    to: addDays(endOfMonth(now), 1).toISOString(),
  };
};

const parseInputDate = (value: string, allDay: boolean): Date => {
  if (!value) {
    return new Date();
  }

  return allDay ? new Date(`${value}T00:00:00`) : new Date(value);
};

const formatInputDate = (date: Date, allDay: boolean): string => {
  return format(date, allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
};

const toModalForm = (
  scope: CalendarEventScope,
  event?: CalendarEvent,
  seed?: { start?: Date; end?: Date; allDay?: boolean }
): CalendarFormState => {
  if (event) {
    return {
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startAt: formatInputDate(new Date(event.startAt), event.allDay),
      endAt: formatInputDate(new Date(event.endAt), event.allDay),
      allDay: event.allDay,
      color: event.color || EVENT_COLORS[0],
    };
  }

  const allDay = Boolean(seed?.allDay);
  const start = seed?.start || addHours(new Date(), 1);
  const end = seed?.end || addHours(start, allDay ? 0 : 1);

  return {
    title: "",
    description: "",
    location: "",
    startAt: formatInputDate(start, allDay),
    endAt: formatInputDate(end, allDay),
    allDay,
    color: scope === "team" ? EVENT_COLORS[1] : EVENT_COLORS[0],
  };
};

const toPayload = (scope: CalendarEventScope, form: CalendarFormState): CalendarEventUpsertPayload => {
  const start = parseInputDate(form.startAt, form.allDay);
  const end = parseInputDate(form.endAt, form.allDay);

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    startAt: form.allDay ? startOfDay(start).toISOString() : start.toISOString(),
    endAt: form.allDay ? endOfDay(end).toISOString() : end.toISOString(),
    allDay: form.allDay,
    color: form.color,
    scope,
  };
};

const toCalendarInput = (event: CalendarEvent): EventInput => {
  const eventEnd = event.allDay
    ? addDays(startOfDay(new Date(event.endAt)), 1).toISOString()
    : event.endAt;

  return {
    id: event.id,
    title: event.title,
    start: event.startAt,
    end: eventEnd,
    allDay: event.allDay,
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: {
      calendarEvent: event,
    },
  };
};

const buildErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Не удалось выполнить действие с календарем";
};

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<CalendarEventScope>("personal");
  const [visibleRange, setVisibleRange] = useState(buildInitialRange);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<CalendarFormState>(() => toModalForm("personal"));

  const hasTeamCalendar = user?.playerType === "team" && Boolean(user?.teamId);
  const canManageTeamCalendar = user?.role === "staff" && user?.playerType === "team" && Boolean(user?.teamId);
  const teamSetupRequired = user?.role === "staff" && user?.playerType === "team" && !user?.teamId;
  const canEditCurrentScope = scope === "personal" || canManageTeamCalendar;

  useEffect(() => {
    if (scope === "team" && !hasTeamCalendar) {
      setScope("personal");
    }
  }, [hasTeamCalendar, scope]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextEvents = await getCalendarEvents({
        scope,
        from: visibleRange.from,
        to: visibleRange.to,
      });

      startTransition(() => {
        setEvents(nextEvents);
      });
    } catch (error) {
      toast.error(buildErrorMessage(error));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [scope, visibleRange.from, visibleRange.to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const calendarEvents = useMemo(() => events.map(toCalendarInput), [events]);

  const resetDialog = useCallback(
    (nextScope: CalendarEventScope, seed?: { start?: Date; end?: Date; allDay?: boolean }) => {
      setSelectedEvent(null);
      setForm(toModalForm(nextScope, undefined, seed));
      setDialogOpen(true);
    },
    []
  );

  const handleDatesSet = (arg: DatesSetArg) => {
    const nextRange = {
      from: arg.start.toISOString(),
      to: arg.end.toISOString(),
    };

    setVisibleRange((current) =>
      current.from === nextRange.from && current.to === nextRange.to ? current : nextRange
    );
  };

  const handleSelect = (selection: DateSelectArg) => {
    if (!canEditCurrentScope) {
      return;
    }

    const start = selection.start;
    const end = selection.allDay ? addDays(selection.end, -1) : selection.end;
    resetDialog(scope, {
      start,
      end: end || addHours(start, 1),
      allDay: selection.allDay,
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const calendarEvent = arg.event.extendedProps.calendarEvent as CalendarEvent | undefined;
    if (!calendarEvent) {
      return;
    }

    setSelectedEvent(calendarEvent);
    setForm(toModalForm(calendarEvent.scope, calendarEvent));
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setSelectedEvent(null);
    }
  };

  const handleFieldChange = <K extends keyof CalendarFormState>(key: K, value: CalendarFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAllDayChange = (checked: boolean) => {
    setForm((current) => {
      const start = parseInputDate(current.startAt, current.allDay);
      const end = parseInputDate(current.endAt, current.allDay);

      return {
        ...current,
        allDay: checked,
        startAt: formatInputDate(checked ? start : addHours(startOfDay(start), 9), checked),
        endAt: formatInputDate(checked ? end : addHours(startOfDay(end), 10), checked),
      };
    });
  };

  const handleSubmit = async () => {
    const payload = toPayload(scope, form);
    if (!payload.title) {
      toast.error("Укажите название события");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedEvent) {
        await updateCalendarEvent(selectedEvent.id, payload);
        toast.success("Событие обновлено");
      } else {
        await createCalendarEvent(payload);
        toast.success(scope === "team" ? "Командное событие создано" : "Личное событие создано");
      }

      notifyCalendarEventsUpdated();
      setDialogOpen(false);
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      toast.error(buildErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteCalendarEvent(selectedEvent.id);
      toast.success("Событие удалено");
      notifyCalendarEventsUpdated();
      setDialogOpen(false);
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      toast.error(buildErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const scopeLabel = scope === "personal" ? "Личный календарь" : user?.teamName || "Командный календарь";
  const readOnlyTeamScope = scope === "team" && !canManageTeamCalendar;

  return (
    <div className="space-y-6">
      <Card
        className="overflow-hidden border-slate-700/80"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(53, 144, 255, 0.18), transparent 30%), linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.96))",
        }}
      >
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              <CalendarDays className="h-3.5 w-3.5" />
              Planner v1
            </div>
            <div>
              <CardTitle className="text-3xl text-white">Календарь планировщик</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-slate-300">
                Единое пространство для личных задач и командного ритма. Переключайтесь между личным и командным
                календарём, планируйте тренировки, разборы, выходные окна и внутренние слоты без выхода из CRM.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 md:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="mb-1 text-xs uppercase tracking-[0.22em] text-slate-400">Текущий режим</div>
              <div className="text-lg font-semibold text-white">{scopeLabel}</div>
              <div className="mt-2 text-slate-300">
                {readOnlyTeamScope
                  ? "Командные события доступны только для просмотра. Изменения вносит staff."
                  : "Создавайте события, чтобы быстро держать ритм недели перед глазами."}
              </div>
            </div>

            <Button
              onClick={() => resetDialog(scope)}
              disabled={!canEditCurrentScope}
              className="justify-center rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Создать событие
            </Button>
          </div>
        </CardHeader>
      </Card>

      {teamSetupRequired && (
        <Card className="border-amber-400/30 bg-amber-500/10">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-100">Командный календарь пока не активирован</div>
              <p className="mt-1 text-sm text-amber-50/85">
                Сначала создайте или привяжите команду в разделе управления командой. После этого появится общий календарь
                для всего состава.
              </p>
            </div>
            <Button asChild variant="outline" className="border-amber-200/30 bg-transparent text-amber-50">
              <Link to={ROUTES.TEAM_MANAGEMENT}>Перейти к команде</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-700/80 bg-slate-950/60">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-white">Режим календаря</CardTitle>
              <CardDescription className="text-slate-400">
                {scope === "personal"
                  ? "Ваши личные события видны только вам."
                  : "Общий календарь команды синхронизирует расписание для игроков и staff."}
              </CardDescription>
            </div>

            <Tabs value={scope} onValueChange={(value) => setScope(value as CalendarEventScope)}>
              <TabsList className="bg-slate-900/80">
                <TabsTrigger value="personal">Личный</TabsTrigger>
                {hasTeamCalendar && <TabsTrigger value="team">Командный</TabsTrigger>}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
              <Pencil className="h-3.5 w-3.5" />
              {canEditCurrentScope ? "Редактирование включено" : "Только просмотр"}
            </div>
            {scope === "team" && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                <Users className="h-3.5 w-3.5" />
                {user?.teamName || "Команда"}
              </div>
            )}
            {readOnlyTeamScope && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                <Lock className="h-3.5 w-3.5" />
                Изменения доступны только staff
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isLoading && events.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              {scope === "personal"
                ? "Пока нет личных событий в выбранном периоде. Можно начать с тренировок, встреч или собственных ритуалов дня."
                : "В выбранном периоде пока нет командных событий. Staff может быстро собрать недельный ритм команды прямо отсюда."}
            </div>
          )}

          <div className="crm-calendar-shell relative rounded-3xl border border-slate-800 bg-slate-950/70 p-3 md:p-4">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-slate-950/45 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm text-slate-300 shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаем события календаря...
                </div>
              </div>
            )}

            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              locale={ruLocale}
              buttonText={{
                today: "Сегодня",
                month: "Месяц",
                week: "Неделя",
                day: "День",
              }}
              firstDay={1}
              selectable={canEditCurrentScope}
              selectMirror={canEditCurrentScope}
              editable={false}
              eventStartEditable={false}
              eventDurationEditable={false}
              dayMaxEventRows={3}
              height="auto"
              events={calendarEvents}
              datesSet={handleDatesSet}
              select={handleSelect}
              eventClick={handleEventClick}
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Детали события" : "Новое событие"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {canEditCurrentScope || (selectedEvent && selectedEvent.scope === "personal")
                ? "Заполните базовые поля события. В v1 поддерживаются личные и командные слоты без повторов."
                : "Командное событие открыто в режиме просмотра. Редактирование доступно только staff вашей команды."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="calendar-title">Название</Label>
              <Input
                id="calendar-title"
                value={form.title}
                onChange={(event) => handleFieldChange("title", event.target.value)}
                disabled={isSaving || !canEditCurrentScope}
                placeholder="Например, разбор демо перед матчем"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="calendar-start">Начало</Label>
                <Input
                  id="calendar-start"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.startAt}
                  onChange={(event) => handleFieldChange("startAt", event.target.value)}
                  disabled={isSaving || !canEditCurrentScope}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calendar-end">Окончание</Label>
                <Input
                  id="calendar-end"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.endAt}
                  onChange={(event) => handleFieldChange("endAt", event.target.value)}
                  disabled={isSaving || !canEditCurrentScope}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="calendar-location">Место или ссылка</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    id="calendar-location"
                    value={form.location}
                    onChange={(event) => handleFieldChange("location", event.target.value)}
                    disabled={isSaving || !canEditCurrentScope}
                    className="pl-9"
                    placeholder="Discord, bootcamp room, Zoom..."
                  />
                </div>
              </div>

              <label className="mt-7 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(event) => handleAllDayChange(event.target.checked)}
                  disabled={isSaving || !canEditCurrentScope}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400"
                />
                Весь день
              </label>
            </div>

            <div className="space-y-2">
              <Label>Цвет события</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleFieldChange("color", color)}
                    disabled={isSaving || !canEditCurrentScope}
                    className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 disabled:hover:scale-100"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? "#F8FBFF" : "rgba(255,255,255,0.16)",
                      boxShadow: form.color === color ? `0 0 0 3px ${COLORS.backgroundColor}` : "none",
                    }}
                    aria-label={`Выбрать цвет ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendar-description">Описание</Label>
              <Textarea
                id="calendar-description"
                value={form.description}
                onChange={(event) => handleFieldChange("description", event.target.value)}
                disabled={isSaving || !canEditCurrentScope}
                placeholder="Что важно не забыть, кто участвует, что нужно подготовить..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {selectedEvent && canEditCurrentScope && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSaving}>
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </Button>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Закрыть
              </Button>
              {canEditCurrentScope && (
                <Button type="button" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  {selectedEvent ? "Сохранить" : "Создать"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;
