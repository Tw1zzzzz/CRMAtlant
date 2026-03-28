import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FullScreenLoader } from "@/components/ui/loading-spinner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./providers/ThemeProvider";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import MoodTracker from "./pages/MoodTracker";
import TestTracker from "./pages/TestTracker";
import Statistics from "./pages/Statistics";
import GameStatsPage from "./pages/GameStatsPage";
import BalanceWheel from "./pages/BalanceWheel";
import StaffBalanceWheel from "./pages/StaffBalanceWheel";
import StaffRoster from "./pages/StaffRoster";
import TeamManagement from "./pages/TeamManagement";
import TopPlayers from "./pages/TopPlayers";
import ActivityHistory from "./pages/ActivityHistory";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Pricing from "./pages/Pricing";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFail from "./pages/PaymentFail";
import PlayersManagement from "./pages/PlayersManagement";
import PlayerCard from "./pages/PlayerCard";
import CorrelationAnalysisPage from "./pages/CorrelationAnalysisPage";
import StatePage from "./pages/StatePage";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ROUTES from "./lib/routes";
import StaffManagement from "./client/src/components/admin/StaffManagement";
import { PlayerType } from "@/types";
const queryClient = new QueryClient();

/**
 * РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ РґР»СЏ Р·Р°С‰РёС‚С‹ РјР°СЂС€СЂСѓС‚РѕРІ СЃ РїСЂРѕРІРµСЂРєРѕР№ СЂРѕР»Рё
 */
interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
  allowedPlayerTypes?: PlayerType[];
  blockedPlayerTypes?: PlayerType[];
}

const RouteGuard = ({ children, requiredRole, allowedPlayerTypes, blockedPlayerTypes }: RouteGuardProps) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <FullScreenLoader text="РџСЂРѕРІРµСЂРєР° Р°РІС‚РѕСЂРёР·Р°С†РёРё..." />;
  }
  
  // РџСЂРѕРІРµСЂРєР° РЅР° Р°РІС‚РѕСЂРёР·Р°С†РёСЋ
  if (!user) return <Navigate to={ROUTES.WELCOME} replace />;
  
  // Р•СЃР»Рё СѓРєР°Р·Р°РЅР° РѕР±СЏР·Р°С‚РµР»СЊРЅР°СЏ СЂРѕР»СЊ Рё РѕРЅР° РЅРµ СЃРѕРІРїР°РґР°РµС‚ - РїРµСЂРµРЅР°РїСЂР°РІР»СЏРµРј
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  
  const effectivePlayerType: PlayerType | undefined =
    user.role === "player" ? (user.playerType || "team") : undefined;

  if (user.role === "player" && blockedPlayerTypes?.includes(effectivePlayerType || "team")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (user.role === "player" && allowedPlayerTypes && !allowedPlayerTypes.includes(effectivePlayerType || "team")) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};

/**
 * РљРѕРјРїРѕРЅРµРЅС‚ РјР°СЂС€СЂСѓС‚РѕРІ РїСЂРёР»РѕР¶РµРЅРёСЏ
 */
const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.WELCOME} element={<Index />} />
    <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
    
    <Route element={
      <RouteGuard>
        <Layout />
      </RouteGuard>
    }>
      <Route
        path={ROUTES.DASHBOARD}
        element={
          <RouteGuard>
            <Dashboard />
          </RouteGuard>
        }
      />
      <Route path={ROUTES.MOOD_TRACKER} element={<MoodTracker />} />
      <Route path={ROUTES.PLAYER_STATE} element={<StatePage />} />
      <Route
        path={ROUTES.TEST_TRACKER}
        element={
          <RouteGuard>
            <TestTracker />
          </RouteGuard>
        }
      />
      <Route path={ROUTES.STATISTICS} element={<Statistics />} />
      <Route path={ROUTES.GAME_STATS} element={<GameStatsPage />} />
      
      <Route 
        path={ROUTES.BALANCE_WHEEL} 
        element={
          <RouteGuard requiredRole="player">
            <BalanceWheel />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={ROUTES.STAFF_BALANCE_WHEEL} 
        element={
          <RouteGuard requiredRole="staff">
            <StaffBalanceWheel />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={ROUTES.TOP_PLAYERS} 
        element={
          <RouteGuard blockedPlayerTypes={["solo"]}>
            <TopPlayers />
          </RouteGuard>
        } 
      />
      
      <Route path={ROUTES.ANALYTICS} element={<Navigate to={ROUTES.STATISTICS} replace />} />
      
      
      {/*
      <Route 
        path={ROUTES.ACTIVITY_HISTORY} 
        element={<ActivityHistory />} 
      />
      */}
      
      <Route 
        path={ROUTES.PRICING}
        element={<Pricing />}
      />

      <Route
        path={ROUTES.PAYMENT_SUCCESS}
        element={<PaymentSuccess />}
      />

      <Route
        path={ROUTES.PAYMENT_FAIL}
        element={<PaymentFail />}
      />

      <Route 
        path={ROUTES.PROFILE} 
        element={<Profile />} 
      />
      
      <Route 
        path={ROUTES.PLAYERS_MANAGEMENT} 
        element={
          <RouteGuard requiredRole="staff">
            <PlayersManagement />
          </RouteGuard>
        } 
      />
      
      <Route path={ROUTES.NEW_ANALYTICS} element={<Navigate to={ROUTES.STATISTICS} replace />} />
      
      <Route
        path="/correlation-analysis"
        element={
          <RouteGuard>
            <CorrelationAnalysisPage />
          </RouteGuard>
        }
      />
      
      <Route
        path={ROUTES.PLAYER_CARD}
        element={
          <RouteGuard allowedPlayerTypes={["solo"]}>
            <PlayerCard />
          </RouteGuard>
        }
      />

      <Route
        path={`${ROUTES.PLAYER_CARD}/:playerId`}
        element={
          <RouteGuard allowedPlayerTypes={["solo"]}>
            <PlayerCard />
          </RouteGuard>
        }
      />
      
      <Route 
        path={ROUTES.TEAM_MANAGEMENT}
        element={
          <RouteGuard requiredRole="staff">
            <TeamManagement />
          </RouteGuard>
        }
      />

      <Route 
        path={ROUTES.STAFF_ROSTER} 
        element={
          <RouteGuard requiredRole="staff">
            <StaffRoster />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={ROUTES.STAFF_MANAGEMENT} 
        element={
          <RouteGuard requiredRole="staff">
            <StaffManagement />
          </RouteGuard>
        } 
      />
    </Route>
    
    <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
  </Routes>
);

/**
 * Р“Р»Р°РІРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚ РїСЂРёР»РѕР¶РµРЅРёСЏ
 */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
