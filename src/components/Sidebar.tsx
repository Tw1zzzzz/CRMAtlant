import { Link, useLocation } from "react-router-dom";
import { 
  BarChart2, Calendar, Home, ListTodo, 
  User, Users, LogOut, CircleDot, 
  Trophy, LineChart, Clock, CreditCard, UserPlus, TrendingUp, Upload 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { COLORS } from "@/styles/theme";
import {
  getSidebarNavItems,
  type SidebarIconKey,
  type SidebarPlayerType,
  type SidebarRole
} from "@/lib/sidebarNavigation";
import { CSSProperties } from "react";

const navIcons: Record<SidebarIconKey, React.ReactNode> = {
  home: <Home className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />,
  tests: <ListTodo className="h-5 w-5" />,
  stats: <BarChart2 className="h-5 w-5" />,
  correlation: <TrendingUp className="h-5 w-5" />,
  gameStats: <LineChart className="h-5 w-5" />,
  balanceWheel: <CircleDot className="h-5 w-5" />,
  topPlayers: <Trophy className="h-5 w-5" />,
  players: <Users className="h-5 w-5" />,
  staff: <UserPlus className="h-5 w-5" />,
  playerCard: <CreditCard className="h-5 w-5" />,
  profile: <User className="h-5 w-5" />,
};

/**
 * Компонент боковой панели навигации с учетом роли пользователя

 */
const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navItems = getSidebarNavItems(
    (user?.role as SidebarRole) || null,
    (user?.playerType as SidebarPlayerType) || null
  );

  // Стили для компонентов
  const styles: Record<string, CSSProperties> = {
    sidebar: {
      backgroundColor: COLORS.backgroundColor,
      color: COLORS.textColor,
      borderRight: `1px solid ${COLORS.borderColor}`
    },
    brandPanel: {
      background: "linear-gradient(180deg, rgba(11, 27, 47, 0.9) 0%, rgba(17, 24, 39, 0.82) 100%)",
      border: `1px solid ${COLORS.borderColor}`,
      borderRadius: "16px",
      padding: "10px 12px",
      boxShadow: "0 16px 24px -24px rgba(7, 17, 31, 0.9)"
    },
    brandEyebrow: {
      color: COLORS.primary,
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const
    },
    brandTitle: {
      color: COLORS.textColor,
      fontSize: "20px",
      fontWeight: 800,
      letterSpacing: "0.02em",
      lineHeight: 1.05
    },
    brandSubtitle: {
      color: COLORS.textColorSecondary,
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const
    },
    badge: { 
      color: COLORS.textColorSecondary, 
      borderColor: COLORS.borderColor,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      fontSize: '9px',
      fontWeight: 'bold',
      letterSpacing: '0.4px',
      textTransform: 'uppercase' as 'uppercase'
    },
    tooltip: {
      backgroundColor: COLORS.cardBackground,
      color: COLORS.textColor,
      borderColor: COLORS.borderColor
    },
    copyright: { 
      color: COLORS.textColorSecondary 
    },
    logoutButton: { 
      color: COLORS.textColorSecondary 
    },
    navIconWrap: {
      width: "28px",
      height: "28px",
      borderRadius: "8px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  };

  /**
   * Рендерит элемент навигации с поддержкой подсказок

   */
  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const buttonStyle = {
      background: isActive
        ? "linear-gradient(90deg, rgba(53, 144, 255, 0.22) 0%, rgba(53, 144, 255, 0.12) 100%)"
        : "transparent",
      color: isActive ? "#F8FBFF" : COLORS.textColorSecondary,
      border: isActive ? "1px solid rgba(53, 144, 255, 0.18)" : "1px solid transparent",
      boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.03)" : "none"
    };
    const iconWrapStyle = {
      ...styles.navIconWrap,
      backgroundColor: isActive ? "rgba(53, 144, 255, 0.14)" : "transparent",
      color: isActive ? COLORS.primary : COLORS.textColorSecondary
    };

    return (
      <li key={item.href}>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={item.href} className="block">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-12 rounded-xl px-3 text-[14px] font-medium transition-all",
                    isActive 
                      ? "text-primary" 
                      : "text-secondary hover:text-white"
                  )}
                  style={buttonStyle}
                >
                  <span style={iconWrapStyle}>
                    {navIcons[item.icon]}
                  </span>
                  <span className="ml-2.5">{item.title}</span>
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" style={styles.tooltip}>
              {item.title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </li>
    );
  };

  return (
    <aside className="h-screen w-64 flex flex-col" style={styles.sidebar}>
      {/* Бренд-блок */}
      <div className="p-4 pt-4 mt-0.5">
        <div style={styles.brandPanel}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p style={styles.brandEyebrow}>ATLANT</p>
              <p style={styles.brandTitle}>Technology</p>
              <p className="mt-0.5" style={styles.brandSubtitle}>Performance Coach CRM</p>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded-md border" style={styles.badge}>
              beta v_1.02
            </span>
          </div>
        </div>
      </div>
      
      {/* Навигация */}
      <ScrollArea className="flex-1">
        <nav className="px-4 py-2">
          <ul className="space-y-1">
            {navItems.map(renderNavItem)}
          </ul>
        </nav>
      </ScrollArea>
      
      {/* Кнопка выхода для авторизованных пользователей */}
      {user && (
        <>
          <Separator className="my-2" style={{ backgroundColor: COLORS.borderColor }} />
          <div className="p-4">
            <Button
              onClick={logout}
              variant="ghost"
              className="w-full justify-start"
              style={styles.logoutButton}
            >
              <LogOut className="mr-2 h-5 w-5" />
              <span>Выход</span>
            </Button>
          </div>
        </>
      )}
      
      {/* Копирайт */}
      <div className="p-4 text-sm" style={styles.copyright}>
        <p>© 2026 ATLANT Technology</p>
      </div>
    </aside>
  );
};

export default Sidebar;
