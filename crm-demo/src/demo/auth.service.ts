/**
 * Демо-сервис аутентификации: без бэкенда, всегда «залогинен» как staff.
 */
import type { User, LoginDto, CreateUserDto } from "@/types";

export interface AuthResult {
  success: boolean;
  user?: User | null;
  error?: string;
}

const DEMO_USER: User = {
  id: "demo-user-id",
  email: "demo@crm.local",
  name: "Демо-пользователь",
  role: "staff",
};

export class AuthService {
  private static instance: AuthService;
  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async login(_credentials: LoginDto): Promise<AuthResult> {
    return { success: true, user: DEMO_USER };
  }

  public async register(_userData: CreateUserDto): Promise<AuthResult> {
    return { success: true, user: DEMO_USER };
  }

  public async getCurrentUser(): Promise<User | null> {
    return DEMO_USER;
  }

  public logout(): void {}

  public async updateAvatar(_file: File): Promise<AuthResult> {
    return { success: true, user: DEMO_USER };
  }

  public async deleteAccount(): Promise<void> {}
}

export const authService = AuthService.getInstance();
