import React, { createContext, useContext, useState, ReactNode } from 'react';
import { COLORS } from '@/styles/theme';
import { ThemeProvider as MUIThemeProvider, CssBaseline } from '@mui/material';
import darkTheme from '../theme';

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: typeof COLORS;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children, ...restProps }) => {
  // Отфильтруем все data-* атрибуты, чтобы они не передавались в MUIThemeProvider
  const filteredProps = Object.fromEntries(
    Object.entries(restProps).filter(([key]) => !key.startsWith('data-'))
  );

  // По умолчанию используем темную тему из Dashboard
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // В данной реализации мы всегда используем темную тему из COLORS
    // При желании здесь можно добавить логику для переключения на светлую тему
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        isDarkMode, 
        toggleTheme,
        colors: COLORS
      }}
    >
      <MUIThemeProvider theme={darkTheme} {...filteredProps}>
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