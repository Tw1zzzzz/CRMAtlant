/**
 * Хук для управления аутентификацией
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode,
  useMemo
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, LoginDto, CreateUserDto, AsyncState } from "@/types";
import { authService, AuthResult } from "@/services/auth.service";
import ROUTES from "@/lib/routes";

const BASELINE_REGISTER_MODAL_FLAG = "baselineAssessmentAfterRegister";

/**
 * Тип контекста аутентификации
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginDto) => Promise<AuthResult>;
  register: (userData: CreateUserDto) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  updateAvatar: (file: File) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

/**
 * Значение контекста по умолчанию
 */
const defaultContextValue: AuthContextType = {
  user: null,
  loading: true,
  error: null,
  login: async () => ({ success: false, error: 'Context not initialized' }),
  register: async () => ({ success: false, error: 'Context not initialized' }),
  requestPasswordReset: async () => ({ success: false, error: 'Context not initialized' }),
  resetPassword: async () => ({ success: false, error: 'Context not initialized' }),
  resendVerificationEmail: async () => ({ success: false, error: 'Context not initialized' }),
  verifyEmail: async () => ({ success: false, error: 'Context not initialized' }),
  changePassword: async () => ({ success: false, error: 'Context not initialized' }),
  logout: () => {},
  deleteAccount: async () => {},
  updateAvatar: async () => ({ success: false, error: 'Context not initialized' }),
  refreshUser: async () => {}
};

// Создание контекста
const AuthContext = createContext<AuthContextType>(defaultContextValue);

/**
 * Провайдер аутентификации
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  
  // Состояние аутентификации
  const [authState, setAuthState] = useState<AsyncState<User>>({
    data: null,
    loading: true,
    error: null
  });

  /**
   * Инициализация сессии пользователя при загрузке
   */
  const initializeAuth = useCallback(async () => {
    try {
      const user = await authService.getCurrentUser();
      setAuthState({
        data: user,
        loading: false,
        error: null
      });
    } catch (error) {
      setAuthState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Ошибка инициализации'
      });
    }
  }, []);

  /**
   * Обновление данных пользователя
   */
  const refreshUser = useCallback(async () => {
    if (!authState.data) return;
    
    try {
      const user = await authService.getCurrentUser();
      setAuthState(prev => ({
        ...prev,
        data: user
      }));
    } catch (error) {
      console.error('Ошибка обновления данных пользователя:', error);
    }
  }, [authState.data]);

  /**
   * Вход в систему
   */
  const login = useCallback(async (credentials: LoginDto): Promise<AuthResult> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await authService.login(credentials);
      
      if (result.success && result.user) {
        sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
        setAuthState({
          data: result.user,
          loading: false,
          error: null
        });
        
        toast.success(`Добро пожаловать, ${result.user.name}!`);
        
        // Навигация на главную страницу после успешного входа
        navigate(ROUTES.DASHBOARD);
      } else {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Ошибка входа'
        }));
        
        toast.error(result.error || 'Ошибка входа');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [navigate]);

  /**
   * Регистрация нового пользователя
   */
  const register = useCallback(async (userData: CreateUserDto): Promise<AuthResult> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await authService.register(userData);
      
      if (result.success && result.user) {
        sessionStorage.setItem(BASELINE_REGISTER_MODAL_FLAG, "1");
        setAuthState({
          data: result.user,
          loading: false,
          error: null
        });
        
        toast.success(`Аккаунт успешно создан! Добро пожаловать, ${result.user.name}!`);
        
        // Навигация на главную страницу после успешной регистрации
        navigate(ROUTES.DASHBOARD);
      } else if (result.success) {
        sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: null
        }));

        toast.success(result.message || 'Аккаунт создан. Подтвердите email и затем войдите в систему.');
      } else {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Ошибка регистрации'
        }));
        
        toast.error(result.error || 'Ошибка регистрации');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [navigate]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await authService.requestPasswordReset({ email });

    if (result.success) {
      toast.success('Если аккаунт существует, письмо для сброса уже отправлено');
    } else {
      toast.error(result.error || 'Не удалось отправить письмо для сброса');
    }

    return result;
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const result = await authService.resetPassword({ token, password });

    if (result.success) {
      toast.success('Пароль обновлен. Теперь можно войти.');
    } else {
      toast.error(result.error || 'Не удалось обновить пароль');
    }

    return result;
  }, []);

  const resendVerificationEmail = useCallback(async (email: string) => {
    const result = await authService.resendVerificationEmail({ email });

    if (result.success) {
      toast.success(result.message || 'Письмо с подтверждением отправлено');
    } else {
      toast.error(result.error || 'Не удалось отправить письмо подтверждения');
    }

    return {
      success: result.success,
      error: result.error
    };
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    const result = await authService.verifyEmail({ token });

    return {
      success: result.success,
      error: result.error
    };
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await authService.changePassword({ currentPassword, newPassword });

    if (result.success) {
      sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
      authService.logout();
      setAuthState({
        data: null,
        loading: false,
        error: null
      });
      toast.success(result.message || 'Пароль обновлен. Войдите заново.');
      navigate(ROUTES.WELCOME);
    } else {
      toast.error(result.error || 'Не удалось изменить пароль');
    }

    return {
      success: result.success,
      error: result.error
    };
  }, [navigate]);

  /**
   * Выход из системы
   */
  const logout = useCallback(() => {
    sessionStorage.removeItem(BASELINE_REGISTER_MODAL_FLAG);
    authService.logout();
    setAuthState({
      data: null,
      loading: false,
      error: null
    });
    
    toast.success("Вы вышли из системы");
    navigate(ROUTES.WELCOME);
  }, [navigate]);

  /**
   * Удаление аккаунта
   */
  const deleteAccount = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      await authService.deleteAccount();
      setAuthState({
        data: null,
        loading: false,
        error: null
      });
      
      toast.success("Аккаунт успешно удален");
      navigate(ROUTES.WELCOME);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка удаления аккаунта';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      
      toast.error(errorMessage);
      throw error;
    }
  }, [navigate]);

  /**
   * Обновление аватара пользователя
   */
  const updateAvatar = useCallback(async (file: File): Promise<AuthResult> => {
    if (!authState.data) {
      return { success: false, error: 'Пользователь не авторизован' };
    }
    
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      const result = await authService.updateAvatar(file);
      
      if (result.success) {
        // Обновляем данные пользователя
        if (result.user) {
          setAuthState({
            data: {
              ...result.user,
              _updateTimestamp: Date.now() // Для инвалидации кэша изображений
            },
            loading: false,
            error: null
          });
        } else {
          // Если сервер не вернул обновленного пользователя, запрашиваем его
          await refreshUser();
        }
        
        toast.success('Аватар успешно обновлен');
      } else {
        setAuthState(prev => ({
          ...prev,
          loading: false
        }));
        
        toast.error(result.error || 'Ошибка обновления аватара');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setAuthState(prev => ({
        ...prev,
        loading: false
      }));
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [authState.data, refreshUser]);

  // Инициализация при монтировании
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Обработка изменений в localStorage (синхронизация между вкладками)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token') {
        if (!event.newValue) {
          // Токен был удален в другой вкладке
          setAuthState({
            data: null,
            loading: false,
            error: null
          });
        } else {
          // Токен был обновлен в другой вкладке
          initializeAuth();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [initializeAuth]);

  // Мемоизация значения контекста
  const contextValue = useMemo<AuthContextType>(() => ({
    user: authState.data,
    loading: authState.loading,
    error: authState.error,
    login,
    register,
    requestPasswordReset,
    resetPassword,
    resendVerificationEmail,
    verifyEmail,
    changePassword,
    logout,
    deleteAccount,
    updateAvatar,
    refreshUser
  }), [authState, login, register, requestPasswordReset, resetPassword, resendVerificationEmail, verifyEmail, changePassword, logout, deleteAccount, updateAvatar, refreshUser]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Хук для использования контекста аутентификации
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === defaultContextValue) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  
  return context;
};
