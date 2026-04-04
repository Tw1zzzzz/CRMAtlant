import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import NotificationsPanel from "./NotificationsPanel";
import { useAuth } from "@/hooks/useAuth";
import { COLORS } from "@/styles/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown, CalendarDays, Clock3, ArrowUpRight, Settings, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ROUTES from "@/lib/routes";
import twizzLogoSvg from "@/assets/twizz-logo.svg";
// Импортируем UserAvatar
import UserAvatar from "./UserAvatar";
import { getCalendarEvents } from "@/lib/calendarApi";
import type { CalendarEvent } from "@/types";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const teamName = user?.teamName?.trim() || "";
  const showTeamBanner = user?.playerType === "team" && Boolean(teamName);
  const showSoloBanner = user?.playerType === "solo";
  const [upcomingEvent, setUpcomingEvent] = useState<CalendarEvent | null>(null);
  const [upcomingEventLoading, setUpcomingEventLoading] = useState(true);

  useEffect(() => {
    const loadUpcomingEvent = async () => {
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
    };

    void loadUpcomingEvent();
  }, [user?.id, user?.playerType, user?.teamId]);

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

  // Подрезанный SVG можно показывать крупнее без потери читаемости
  const twizzLogoStyle = {
    height: '5.25rem',
    maxWidth: '440px',
    objectFit: 'contain' as const,
    marginLeft: '10px',
    display: 'block' as const
  };

  return (
    <header className="p-4 flex justify-between items-center border-b" style={headerStyles}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center gap-4">
          <img 
            src={twizzLogoSvg} 
            alt="ATLANT Technology Logo" 
            style={twizzLogoStyle}
          />
          {showTeamBanner && (
            <div
              className="hidden min-w-[220px] rounded-xl border px-4 py-2.5 lg:block"
              style={{
                borderColor: "rgba(148, 163, 184, 0.12)",
                background: "rgba(255, 255, 255, 0.03)",
                boxShadow: "none"
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: COLORS.textColorSecondary }}
              >
                Текущая команда
              </p>
              <p className="mt-1 text-base font-semibold leading-tight text-white">
                {teamName}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: COLORS.textColorSecondary }}>
                {user?.role === "staff" ? "Staff / Team" : "Player / Team"}
              </p>
            </div>
          )}
          {showTeamBanner && (
            <div
              className="max-w-[170px] rounded-lg border px-3 py-2 lg:hidden"
              style={{
                borderColor: "rgba(148, 163, 184, 0.12)",
                backgroundColor: "rgba(255, 255, 255, 0.03)"
              }}
            >
              <p className="truncate text-sm font-medium text-white">{teamName}</p>
            </div>
          )}
          {showSoloBanner && (
            <>
              <div
                className="hidden items-center gap-2 rounded-full border px-3.5 py-2 lg:inline-flex"
                style={{
                  borderColor: "rgba(96, 165, 250, 0.18)",
                  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(255, 255, 255, 0.03) 72%)",
                  boxShadow: "0 8px 18px rgba(2, 6, 23, 0.12)"
                }}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/12 text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#bfdbfe" }}>
                    Solo аккаунт
                  </p>
                  <p className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    Личный режим
                  </p>
                </div>
              </div>
              <div
                className="rounded-full border px-3 py-1.5 lg:hidden"
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
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
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
