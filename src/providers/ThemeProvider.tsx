import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { COLORS } from '@/styles/theme';
import { ThemeProvider as MUIThemeProvider, CssBaseline } from '@mui/material';
import darkTheme from '../theme';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: typeof COLORS;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // По умолчанию используем темную тему из Dashboard
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // В данной реализации мы всегда используем темную тему из COLORS
    // При желании здесь можно добавить логику для переключения на светлую тему
  };

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");

    return () => {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    };
  }, []);

  return (
    <ThemeContext.Provider 
      value={{ 
        isDarkMode, 
        toggleTheme,
        colors: COLORS
      }}
    >
      <MUIThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div style={{ 
          backgroundColor: COLORS.backgroundColor,
          color: COLORS.textColor,
          minHeight: '100vh'
        }}>
          {children}
        </div>
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 
