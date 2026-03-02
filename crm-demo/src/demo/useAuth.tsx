/**
 * Демо useAuth: пользователь всегда есть (staff), без запросов к серверу.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User, LoginDto, CreateUserDto, AsyncState } from "@/types";
import { authService, type AuthResult } from "@/services/auth.service";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginDto) => Promise<AuthResult>;
  register: (userData: CreateUserDto) => Promise<AuthResult>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  updateAvatar: (file: File) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

const defaultContextValue: AuthContextType = {
  user: null,
  loading: true,
  error: null,
  login: async () => ({ success: false, error: "Context not initialized" }),
  register: async () => ({ success: false, error: "Context not initialized" }),
  logout: () => {},
  deleteAccount: async () => {},
  updateAvatar: async () => ({ success: false, error: "Context not initialized" }),
  refreshUser: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AsyncState<User>>({
    data: null,
    loading: true,
    error: null,
  });

  const init = useCallback(async () => {
    const user = await authService.getCurrentUser();
    setAuthState({ data: user, loading: false, error: null });
  }, []);

  const refreshUser = useCallback(async () => {
    const user = await authService.getCurrentUser();
    setAuthState((prev) => ({ ...prev, data: user }));
  }, []);

  const login = useCallback(async (credentials: LoginDto): Promise<AuthResult> => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    const result = await authService.login(credentials);
    setAuthState({
      data: result.user ?? null,
      loading: false,
      error: result.error ?? null,
    });
    return result;
  }, []);

  const register = useCallback(async (userData: CreateUserDto): Promise<AuthResult> => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    const result = await authService.register(userData);
    setAuthState({
      data: result.user ?? null,
      loading: false,
      error: result.error ?? null,
    });
    return result;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setAuthState({ data: null, loading: false, error: null });
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    setAuthState({ data: null, loading: false, error: null });
  }, []);

  const updateAvatar = useCallback(async (file: File): Promise<AuthResult> => {
    return authService.updateAvatar(file);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: authState.data,
      loading: authState.loading,
      error: authState.error,
      login,
      register,
      logout,
      deleteAccount,
      updateAvatar,
      refreshUser,
    }),
    [authState, login, register, logout, deleteAccount, updateAvatar, refreshUser]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === defaultContextValue) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return context;
};
