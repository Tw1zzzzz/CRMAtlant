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
import ROUTES from "@/lib/routes";
import { CSSProperties } from "react";

type UserRole = "player" | "staff" | null;
type PlayerType = "solo" | "team" | null;

type NavItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
};

/**
 * Генерирует список навигационных элементов на основе роли пользователя

 */
const getNavItems = (role: UserRole, playerType: PlayerType): NavItem[] => {
  // Базовые элементы, доступные для всех пользователей
  const baseItems: NavItem[] = [
    {
      title: "Обзор",
      href: "/",
      icon: <Home className="h-5 w-5" />,
    },
    {
      title: "Настроение и Энергия",
      href: "/mood",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Тесты",
      href: "/tests",
      icon: <ListTodo className="h-5 w-5" />,
    },
    {
      title: "Статистика",
      href: "/stats",
      icon: <BarChart2 className="h-5 w-5" />,
    },
    {
      title: "Корреляционный анализ",
      href: "/correlation-analysis",
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: "Игровая статистика",
      href: ROUTES.GAME_STATS,
      icon: <LineChart className="h-5 w-5" />,
    },
  ];

  // Добавляем раздел колеса баланса с разными путями в зависимости от роли
  if (role === "player") {
    baseItems.push({
      title: "Колесо баланса",
      href: "/balance-wheel",
      icon: <CircleDot className="h-5 w-5" />,
    });
  } else if (role === "staff") {
    baseItems.push({
      title: "Колесо баланса",
      href: "/staff-balance-wheel",
      icon: <CircleDot className="h-5 w-5" />,
    });
  }
  
  // Элементы, доступные всем аутентифицированным пользователям
  if (role) {
    baseItems.push(
      {
        title: "Топ игроков",
        href: "/top-players",
        icon: <Trophy className="h-5 w-5" />,
      },

      {
        title: "Управление игроками",
        href: "/players",
        icon: <Users className="h-5 w-5" />,
      },
      {
        title: "Управление персоналом",
        href: "/staff-roster",
        icon: <UserPlus className="h-5 w-5" />,
      },
      {
        title: "Карточки игроков",
        href: "/player-card",
        icon: <CreditCard className="h-5 w-5 text-primary" />,
      },
    );
  }

  // Профиль для всех аутентифицированных пользователей
  if (role) {
    baseItems.push({
      title: "Профиль",
      href: "/profile",
      icon: <User className="h-5 w-5" />,
    });
  }

  return baseItems;
};

/**
 * Компонент боковой панели навигации с учетом роли пользователя

 */
const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navItems = getNavItems(user?.role as UserRole || null, (user?.playerType as PlayerType) || null);

  // Стили для компонентов
  const styles: Record<string, CSSProperties> = {
    sidebar: {
      backgroundColor: COLORS.backgroundColor,
      color: COLORS.textColor,
      borderRight: `1px solid ${COLORS.borderColor}`
    },
    logo: { 
      color: COLORS.primary,
      fontWeight: 'bold',
      letterSpacing: '1px',
      textTransform: 'uppercase' as 'uppercase'
    },
    badge: { 
      color: COLORS.textColorSecondary, 
      borderColor: COLORS.borderColor,
      backgroundColor: COLORS.backgroundColor,
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '0.5px',
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
    }
  };

  /**
   * Рендерит элемент навигации с поддержкой подсказок

   */
  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const buttonStyle = {
      backgroundColor: isActive ? COLORS.primary + "20" : "transparent",
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
                    "w-full justify-start h-10",
                    isActive 
                      ? "text-primary" 
                      : "text-secondary hover:text-primary-foreground"
                  )}
                  style={buttonStyle}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
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
      {/* Логотип */}
      <div className="p-4 pt-5 mt-0.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-heading" style={styles.logo}>
              Tracker
            </h2>
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
        <p>© 2023 Tracker</p>
      </div>
    </aside>
  );
};

export default Sidebar;



