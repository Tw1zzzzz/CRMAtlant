import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import SupportRequestDialog from "./SupportRequestDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLORS } from "@/styles/theme";
import { LineChart } from "lucide-react";
import ROUTES from "@/lib/routes";

/**
 * Основной компонент макета приложения
 * Организует структуру с боковой панелью, шапкой и основным контентом
 */
const Layout: React.FC = () => {
  const styles = {
    container: { 
      backgroundColor: COLORS.backgroundColor 
    },
    content: {
      backgroundColor: COLORS.backgroundColor,
      color: COLORS.textColor
    }
  };

  return (
    <div 
      className="flex min-h-screen layout-container" 
      style={styles.container}
    >
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <ScrollArea className="flex-1" style={styles.container}>
          <main className="p-4" style={styles.content}>
            <Outlet />
          </main>
        </ScrollArea>

        <SupportRequestDialog variant="floating" />
      </div>
    </div>
  );
};

export default Layout;
