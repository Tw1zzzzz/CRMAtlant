import { Separator } from "@/components/ui/separator";
import NotificationsPanel from "./NotificationsPanel";
import SyncStatusIndicator from "./SyncStatusIndicator";
import { useAuth } from "@/hooks/useAuth";
import { COLORS } from "@/styles/theme";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, User as UserIcon, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ROUTES from "@/lib/routes";
import twizzLogoSvg from "@/assets/twizz-logo.svg";
// Импортируем UserAvatar
import UserAvatar from "./UserAvatar";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const teamName = user?.teamName?.trim() || "";
  const showTeamBanner = user?.playerType === "team" && Boolean(teamName);

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
          {!showTeamBanner && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: COLORS.primary }}>
                ATLANT Technology
              </p>
              <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                Performance Coach CRM
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {user && <SyncStatusIndicator />}
        <NotificationsPanel />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Настройки профиля"
          onClick={() => navigate(ROUTES.PROFILE)}
        >
          <Settings className="h-5 w-5" />
        </Button>
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
              <UserIcon className="mr-2 h-4 w-4" />
              Профиль
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
