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
import BalanceWheel from "./pages/BalanceWheel";
import StaffBalanceWheel from "./pages/StaffBalanceWheel";
import StaffRoster from "./pages/StaffRoster";
import TopPlayers from "./pages/TopPlayers";
import Analytics from "./pages/Analytics";
import NewAnalytics from "./pages/NewAnalytics";
import ExcelImport from "./pages/ExcelImport";
import FileStorage from "./pages/FileStorage";
import ActivityHistory from "./pages/ActivityHistory";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import PlayersManagement from "./pages/PlayersManagement";
import PlayerCard from "./pages/PlayerCard";
import CorrelationAnalysisPage from "./pages/CorrelationAnalysisPage";
import NotFound from "./pages/NotFound";
import ROUTES from "./lib/routes";
import StaffManagement from "./client/src/components/admin/StaffManagement";

const queryClient = new QueryClient();

/**
 * Унифицированный компонент для защиты маршрутов с проверкой роли
 */
interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const RouteGuard = ({ children, requiredRole }: RouteGuardProps) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <FullScreenLoader text="Проверка авторизации..." />;
  }
  
  // Проверка на авторизацию
  if (!user) return <Navigate to={ROUTES.WELCOME} replace />;
  
  // Если указана обязательная роль и она не совпадает - перенаправляем
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  
  return <>{children}</>;
};

/**
 * Компонент маршрутов приложения
 */
const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.WELCOME} element={<Index />} />
    
    <Route element={
      <RouteGuard>
        <Layout />
      </RouteGuard>
    }>
      <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
      <Route path={ROUTES.MOOD_TRACKER} element={<MoodTracker />} />
      <Route path={ROUTES.TEST_TRACKER} element={<TestTracker />} />
      <Route path={ROUTES.STATISTICS} element={<Statistics />} />
      
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
        element={<TopPlayers />} 
      />
      
      <Route 
        path={ROUTES.ANALYTICS} 
        element={
          <RouteGuard>
            <Analytics />
          </RouteGuard>
        } 
      />

      <Route 
        path={ROUTES.CS2_EXCEL_IMPORT} 
        element={
          <RouteGuard requiredRole="staff">
            <ExcelImport />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={ROUTES.FILE_STORAGE} 
        element={<FileStorage />} 
      />
      
      {/* Временно отключен маршрут к странице истории активности из-за технических проблем
      <Route 
        path={ROUTES.ACTIVITY_HISTORY} 
        element={<ActivityHistory />} 
      />
      */}
      
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
      
      <Route 
        path={ROUTES.NEW_ANALYTICS} 
        element={<NewAnalytics />} 
      />
      
      <Route 
        path="/correlation-analysis" 
        element={
          <RouteGuard requiredRole="staff">
            <CorrelationAnalysisPage />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={ROUTES.PLAYER_CARD} 
        element={
          <RouteGuard requiredRole="staff">
            <PlayerCard />
          </RouteGuard>
        } 
      />
      
      <Route 
        path={`${ROUTES.PLAYER_CARD}/:playerId`} 
        element={
          <RouteGuard requiredRole="staff">
            <PlayerCard />
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
 * Главный компонент приложения
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
