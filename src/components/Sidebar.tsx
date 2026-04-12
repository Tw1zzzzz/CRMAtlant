import { Link, useLocation } from "react-router-dom";
import {
  BarChart2, Calendar, CalendarDays, Home, ListTodo,
  User, Users, LogOut, CircleDot,
  Trophy, LineChart, Clock, CreditCard, UserPlus, TrendingUp, Upload, Activity, IdCard, ShieldCheck, BookOpen
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
  type SidebarNavItem,
  type SidebarIconKey,
  type SidebarNavSection,
  type SidebarPlayerType,
  type SidebarRole
} from "@/lib/sidebarNavigation";
import { CSSProperties } from "react";
import atlantMiniLogoWhite from "@/assets/atlant-mini-logo-white.svg";

const navIcons: Record<SidebarIconKey, React.ReactNode> = {
  home: <Home className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />,
  planner: <CalendarDays className="h-5 w-5" />,
  guide: <BookOpen className="h-5 w-5" />,
  tests: <ListTodo className="h-5 w-5" />,
  stats: <BarChart2 className="h-5 w-5" />,
  correlation: <TrendingUp className="h-5 w-5" />,
  gameStats: <LineChart className="h-5 w-5" />,
  balanceWheel: <CircleDot className="h-5 w-5" />,
  playerState: <Activity className="h-5 w-5" />,
  topPlayers: <Trophy className="h-5 w-5" />,
  players: <Users className="h-5 w-5" />,
  staff: <UserPlus className="h-5 w-5" />,
  teams: <Users className="h-5 w-5" />,
  superadmin: <ShieldCheck className="h-5 w-5" />,
  playerCard: <IdCard className="h-5 w-5" />,
  profile: <User className="h-5 w-5" />,
  pricing: <CreditCard className="h-5 w-5" />,
};

/**
 * Компонент боковой панели навигации с учетом роли пользователя

 */
const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navSections = getSidebarNavItems(
    (user?.role as SidebarRole) || null,
    (user?.playerType as SidebarPlayerType) || null,
    Boolean(user?.isSuperAdmin)
  );

  // Стили для компонентов
  const styles: Record<string, CSSProperties> = {
    sidebar: {
      backgroundColor: COLORS.backgroundColor,
      color: COLORS.textColor,
      borderRight: `1px solid ${COLORS.borderColor}`
    },
    brandPanel: {
      background: "linear-gradient(180deg, rgba(12, 21, 36, 0.96) 0%, rgba(17, 24, 39, 0.88) 100%)",
      border: `1px solid ${COLORS.borderColor}`,
      borderRadius: "18px",
      padding: "12px",
      boxShadow: "0 14px 24px -24px rgba(7, 17, 31, 0.95)"
    },
    brandLogoWrap: {
      width: "38px",
      height: "38px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px solid rgba(148, 163, 184, 0.14)`,
      background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
    },
    brandEyebrow: {
      color: "rgba(191, 219, 254, 0.88)",
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const
    },
    brandTitle: {
      color: COLORS.textColor,
      fontSize: "16px",
      fontWeight: 700,
      letterSpacing: "0.01em",
      lineHeight: 1.05
    },
    brandSubtitle: {
      color: COLORS.textColorSecondary,
      fontSize: "9px",
      letterSpacing: "0.14em",
      textTransform: "uppercase" as const
    },
    badge: { 
      color: "#bfdbfe",
      borderColor: "rgba(96, 165, 250, 0.16)",
      backgroundColor: "rgba(59, 130, 246, 0.08)",
      fontSize: '9px',
      fontWeight: 'bold',
      letterSpacing: '0.18em',
      textTransform: 'uppercase' as const
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
  const renderNavItem = (item: SidebarNavItem) => {
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div style={styles.brandLogoWrap}>
                <img
                  src={atlantMiniLogoWhite}
                  alt="Мини логотип Atlant"
                  className="h-5 w-5 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p style={styles.brandEyebrow}>Atlant Technology</p>
                <p style={styles.brandTitle}>Performance CRM</p>
              </div>
            </div>
            <div className="flex flex-col items-end justify-center leading-none">
              <span className="rounded-full border px-1.5 py-0.5" style={styles.badge}>
                beta
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textColorSecondary }}>
                v1.02
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Навигация */}
      <ScrollArea className="flex-1">
        <nav className="px-4 py-2">
          <div className="space-y-5">
            {navSections.map((section: SidebarNavSection, index) => (
              <section key={`${section.title || "section"}-${index}`}>
                {section.title ? (
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.textColorSecondary }}>
                    {section.title}
                  </p>
                ) : null}
                <ul className="space-y-1">
                  {section.items.map(renderNavItem)}
                </ul>
              </section>
            ))}
          </div>
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
