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
// Импортируем CSS для анимации
import "@/assets/twizz-logo-animation.css";
// Импортируем UserAvatar
import UserAvatar from "./UserAvatar";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Стили для хедера
  const headerStyles = {
    backgroundColor: COLORS.cardBackground,
    borderBottomColor: COLORS.borderColor,
    color: COLORS.textColor
  };

  // Стиль для логотипа Twizz
  const twizzLogoStyle = {
    height: '4.5rem',
    maxWidth: '220px',
    objectFit: 'contain' as const,
    borderRadius: '8px',
    padding: '4px',
    marginLeft: '10px',
    background: 'rgba(29, 140, 248, 0.08)',
    border: '1px solid rgba(0, 0, 0, 0.3)',
    boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)'
  };

  return (
    <header className="p-4 flex justify-between items-center border-b" style={headerStyles}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center gap-4">
          <img 
            src={twizzLogoSvg} 
            alt="Twizz Logo" 
            style={twizzLogoStyle}
          />
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
