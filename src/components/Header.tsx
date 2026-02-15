import { Separator } from "@/components/ui/separator";
import NotificationsPanel from "./NotificationsPanel";
import SyncStatusIndicator from "./SyncStatusIndicator";
import { useAuth } from "@/hooks/useAuth";
import { COLORS } from "@/styles/theme";
// Импортируем логотипы
import logoSvg from "@/assets/1win-logo.svg";
import twizzLogoSvg from "@/assets/twizz-logo.svg";
// Импортируем CSS для анимации
import "@/assets/twizz-logo-animation.css";
// Импортируем UserAvatar
import UserAvatar from "./UserAvatar";

const Header = () => {
  const { user } = useAuth();

  // Стили для хедера
  const headerStyles = {
    backgroundColor: COLORS.cardBackground,
    borderBottomColor: COLORS.borderColor,
    color: COLORS.textColor
  };

  // Стиль для логотипа 1win с увеличенным размером
  const logoStyle = {
    height: '4.5rem',
    maxWidth: '220px',
    objectFit: 'contain' as const,
    borderRadius: '8px',
    padding: '4px',
    background: 'rgba(29, 140, 248, 0.08)',
    border: '1px solid rgba(0, 0, 0, 0.3)',
    boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.2)'
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
            src={logoSvg} 
            alt="1WIN Logo" 
            style={logoStyle}
          />
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
        <Separator orientation="vertical" className="h-8" style={{ backgroundColor: COLORS.borderColor }} />
        <UserAvatar user={user} size="md" />
      </div>
    </header>
  );
};

export default Header;
