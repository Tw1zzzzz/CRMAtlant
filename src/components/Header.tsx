import { useCallback, useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import NotificationsPanel from "./NotificationsPanel";
import { useAuth } from "@/hooks/useAuth";
import { COLORS } from "@/styles/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, LogOut, ChevronDown, CalendarDays, Clock3, ArrowUpRight, Settings, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ROUTES from "@/lib/routes";
// Импортируем UserAvatar
import UserAvatar from "./UserAvatar";
import { CALENDAR_EVENTS_UPDATED_EVENT, getCalendarEvents } from "@/lib/calendarApi";
import { getImageUrl } from "@/utils/imageUtils";
import type { CalendarEvent } from "@/types";

const Header = () => {
  const { user, logout, switchProfile } = useAuth();
  const navigate = useNavigate();
  const teamName = user?.teamName?.trim() || "";
  const teamLogo = user?.teamLogo?.trim() || "";
  const teamLogoUrl = getImageUrl(teamLogo) || teamLogo;
  const showTeamBanner = user?.playerType === "team" && Boolean(teamName);
  const showSoloBanner = user?.playerType === "solo";
  const teamRoleLabel = user?.role === "staff" ? "Staff / Team" : "Player / Team";
  const teamInitial = teamName.charAt(0).toUpperCase() || "T";
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);
  const [upcomingEventLoading, setUpcomingEventLoading] = useState(true);

  const loadUpcomingEvent = useCallback(async () => {
    if (!user) {
      setUpcomingEvent(null);
      setUpcomingEventLoading(false);
      return;
    }

    setUpcomingEventLoading(true);
    try {
      const now = new Date();
      const from = now.toISOString();
      const to = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90).toISOString();

      const requests: Array<Promise<CalendarEvent[]>> = [
        getCalendarEvents({ scope: "personal", from, to }),
      ];

      if (user.playerType === "team" && user.teamId) {
        requests.push(getCalendarEvents({ scope: "team", from, to }));
      }

      const nextEvent = (await Promise.all(requests))
        .flat()
        .filter((event) => new Date(event.endAt).getTime() >= now.getTime())
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0] || null;

      setUpcomingEvent(nextEvent);
    } catch (error) {
      console.error("Не удалось загрузить ближайшее событие для хедера:", error);
      setUpcomingEvent(null);
    } finally {
      setUpcomingEventLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadUpcomingEvent();

    window.addEventListener(CALENDAR_EVENTS_UPDATED_EVENT, loadUpcomingEvent);
    return () => {
      window.removeEventListener(CALENDAR_EVENTS_UPDATED_EVENT, loadUpcomingEvent);
    };
  }, [loadUpcomingEvent]);

  const formatUpcomingEventDate = (event: CalendarEvent | null): string => {
    if (!event) {
      return "";
    }

    const start = new Date(event.startAt);
    const weekdayLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(start);
    const dateLabel = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(start);

    if (event.allDay) {
      return `${weekdayLabel}, ${dateLabel} • весь день`;
    }

    const timeLabel = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);

    return `${weekdayLabel}, ${dateLabel} • ${timeLabel}`;
  };

  // Стили для хедера
  const headerStyles = {
    backgroundColor: COLORS.cardBackground,
    borderBottomColor: COLORS.borderColor,
    color: COLORS.textColor
  };

  return (
    <header className="flex items-center justify-between gap-6 border-b px-5 py-3.5" style={headerStyles}>
      <div className="min-w-0 flex flex-1 items-center">
        {showTeamBanner && (
          <>
            <div
              className="hidden max-w-[308px] items-center gap-3.5 rounded-full border px-4 py-2.5 md:flex"
              style={{
                borderColor: "rgba(148, 163, 184, 0.12)",
                background: "rgba(255, 255, 255, 0.03)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
              }}
            >
              {teamLogo ? (
                <img
                  src={teamLogoUrl}
                  alt={teamName}
                  className="h-10 w-10 rounded-full border object-cover"
                  style={{ borderColor: "rgba(148, 163, 184, 0.12)" }}
                />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold text-white"
                  style={{
                    borderColor: "rgba(148, 163, 184, 0.12)",
                    background: "rgba(255, 255, 255, 0.05)"
                  }}
                >
                  {teamInitial}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-semibold text-white">{teamName}</p>
                <p className="mt-1 truncate text-xs" style={{ color: COLORS.textColorSecondary }}>
                  {teamRoleLabel}
                </p>
              </div>
            </div>
            <div
              className="max-w-[190px] rounded-full border px-3.5 py-2 md:hidden"
              style={{
                borderColor: "rgba(148, 163, 184, 0.12)",
                backgroundColor: "rgba(255, 255, 255, 0.04)"
              }}
            >
              <div className="flex items-center gap-2">
                {teamLogo ? (
                  <img
                    src={teamLogoUrl}
                    alt={teamName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: "rgba(255, 255, 255, 0.08)" }}
                  >
                    {teamInitial}
                  </div>
                )}
                <p className="truncate text-[15px] font-medium text-white">{teamName}</p>
              </div>
            </div>
          </>
        )}
        {showSoloBanner && (
          <>
            <div
              className="hidden items-center gap-2.5 rounded-full border px-3.5 py-2 md:inline-flex"
              style={{
                borderColor: "rgba(96, 165, 250, 0.16)",
                background: "rgba(59, 130, 246, 0.08)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
              }}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300/12 text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#bfdbfe" }}>
                  Solo аккаунт
                </p>
                <p className="text-[11px]" style={{ color: COLORS.textColorSecondary }}>
                  Личный режим
                </p>
              </div>
            </div>
            <div
              className="rounded-full border px-3 py-1.5 md:hidden"
              style={{
                borderColor: "rgba(96, 165, 250, 0.18)",
                background: "rgba(59, 130, 246, 0.1)"
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#bfdbfe" }}>
                Solo
              </p>
            </div>
          </>
        )}
        {!showTeamBanner && !showSoloBanner && (
          <p
            className="hidden text-[11px] font-medium uppercase tracking-[0.22em] md:block"
            style={{ color: COLORS.textColorSecondary }}
          >
            Рабочее пространство
          </p>
        )}
      </div>
      
      <div className="flex flex-shrink-0 items-center space-x-3">
        {user && (
          <div
            className="hidden xl:flex items-center gap-3.5 rounded-xl border px-4 py-2.5"
            style={{
              borderColor: "rgba(148, 163, 184, 0.12)",
              background: "rgba(255, 255, 255, 0.03)",
              boxShadow: "none",
              maxWidth: "390px"
            }}
          >
            <CalendarDays className="h-[18px] w-[18px] flex-shrink-0" style={{ color: COLORS.primary }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {upcomingEventLoading
                  ? "Загружаем событие..."
                  : upcomingEvent
                    ? upcomingEvent.title
                    : "Нет ближайших событий"}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: COLORS.textColorSecondary }}>
                <Clock3 className="h-[13px] w-[13px] flex-shrink-0" />
                <span className="truncate">
                  {upcomingEvent ? formatUpcomingEventDate(upcomingEvent) : "Календарь пока пуст"}
                </span>
              </div>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Link to={ROUTES.CALENDAR} aria-label="Открыть календарь">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
        <NotificationsPanel />
        <Separator orientation="vertical" className="h-8" style={{ backgroundColor: COLORS.borderColor }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto px-1 py-1">
              <div className="flex items-center gap-2">
                <UserAvatar user={user} size="md" />
                <ChevronDown className="h-4 w-4" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(user?.availableProfiles?.length || 0) > 1 && (
              <>
                {user?.availableProfiles?.map((profile) => {
                  const isActive = profile.key === user.activeProfileKey;
                  return (
                    <DropdownMenuItem
                      key={profile.key}
                      onClick={() => {
                        if (!isActive) {
                          void switchProfile(profile.key);
                        }
                      }}
                    >
                      {isActive ? <Check className="mr-2 h-4 w-4" /> : <span className="mr-2 h-4 w-4" />}
                      {profile.label}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate(ROUTES.PROFILE)}>
              <Settings className="mr-2 h-4 w-4" />
              Настройки
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
