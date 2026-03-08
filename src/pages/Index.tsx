import React, { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PlayerType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

/**
 * Тип роли пользователя
 */
type UserRole = "player" | "staff";

/**
 * Интерфейс для формы входа
 */
interface LoginFormState {
  email: string;
  password: string;
}

/**
 * Интерфейс для формы регистрации
 */
interface RegisterFormState {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  faceitUrl: string;
  playerType: PlayerType;
}

/**
 * Главная страница с формами входа и регистрации
 */
const Index: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  
  // Состояние форм в объектах для лучшей организации
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: ""
  });
  
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    email: "",
    password: "",
    name: "",
    role: "player",
    faceitUrl: "",
    playerType: "team"
  });

  /**
   * Обновление полей формы входа
   */
  const updateLoginField = (field: keyof LoginFormState, value: string): void => {
    setLoginForm(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Обновление полей формы регистрации
   */
  const updateRegisterField = <K extends keyof RegisterFormState>(
    field: K, 
    value: RegisterFormState[K]
  ): void => {
    setRegisterForm(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Перенаправление пользователя после аутентификации
   */
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  /**
   * Обработчик отправки формы входа
   */
  const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const { email, password } = loginForm;
    
    if (!email.trim() || !password) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }
    
    try {
      setLoading(true);
      await login({ email, password });
    } catch (error) {
      console.error('Ошибка входа:', error);
      toast.error("Не удалось выполнить вход. Проверьте данные и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Обработчик отправки формы регистрации
   */
  const handleRegister = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const { email, password, name, role, faceitUrl, playerType } = registerForm;
    
    if (!email.trim() || !password || !name.trim()) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }

    if (role === "player" && !faceitUrl.trim()) {
      toast.error("Для игрока ссылка Faceit обязательна");
      return;
    }
    
    try {
      setLoading(true);
      await register({ name, email, password, role, playerType, faceitUrl: faceitUrl.trim() || undefined });
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      toast.error("Не удалось зарегистрироваться. Попробуйте позже или обратитесь в поддержку.");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-center">
        {/* Левая сторона - приветственный текст */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl lg:text-6xl font-bold text-esports-blue mb-4">
            Performance Hub
          </h1>
          <p className="text-xl lg:text-2xl text-esports-darkGray mb-8">
            Отследи свой успех
          </p>
          <p className="text-muted-foreground">
            Платформа для мониторинга и улучшения вашего прогресса. Анализируйте свое настроение, 
            энергию и баланс жизни для достижения лучших результатов.
          </p>
        </div>
        
        {/* Правая сторона - формы аутентификации */}
        <div className="flex-1 w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
            
            {/* Вкладка входа */}
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Вход в аккаунт</CardTitle>
                  <CardDescription>
                    Введите ваши данные для входа в систему
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@email.com"
                        value={loginForm.email}
                        onChange={(e) => updateLoginField('email', e.target.value)}
                        disabled={loading}
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Пароль</Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => updateLoginField('password', e.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading}
                    >
                      {loading ? "Вход..." : "Войти"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            {/* Вкладка регистрации */}
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Создание аккаунта</CardTitle>
                  <CardDescription>
                    Заполните форму для регистрации
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Имя</Label>
                      <Input
                        id="register-name"
                        placeholder="Иван Иванов"
                        value={registerForm.name}
                        onChange={(e) => updateRegisterField('name', e.target.value)}
                        disabled={loading}
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="example@email.com"
                        value={registerForm.email}
                        onChange={(e) => updateRegisterField('email', e.target.value)}
                        disabled={loading}
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Пароль</Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => updateRegisterField('password', e.target.value)}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Роль</Label>
                      <div className="flex space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            checked={registerForm.role === "player"}
                            onChange={() => updateRegisterField('role', "player")}
                            className="h-4 w-4"
                            disabled={loading}
                          />
                          <span>Игрок</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            checked={registerForm.role === "staff"}
                            onChange={() => updateRegisterField('role', "staff")}
                            className="h-4 w-4"
                            disabled={loading}
                          />
                          <span>Персонал</span>
                        </label>
                      </div>
                    </div>
                    {registerForm.role === "player" && (
  <div className="space-y-2">
    <Label>Тип игрока</Label>
    <div className="flex space-x-4">
      <label className="flex items-center space-x-2">
        <input
          type="radio"
          checked={registerForm.playerType === "team"}
          onChange={() => updateRegisterField('playerType', "team")}
          className="h-4 w-4"
          disabled={loading}
        />
        <span>Член команды</span>
      </label>
      <label className="flex items-center space-x-2">
        <input
          type="radio"
          checked={registerForm.playerType === "solo"}
          onChange={() => updateRegisterField('playerType', "solo")}
          className="h-4 w-4"
          disabled={loading}
        />
        <span>Одиночный игрок</span>
      </label>
    </div>
  </div>
)}
                    {registerForm.role === "player" && (
  <div className="space-y-2">
    <Label htmlFor="register-faceit">Ссылка Faceit</Label>
                        <Input
                          id="register-faceit"
                          placeholder="https://www.faceit.com/en/players/your_nickname"
                          value={registerForm.faceitUrl}
                          onChange={(e) => updateRegisterField('faceitUrl', e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loading}
                    >
                      {loading ? "Регистрация..." : "Зарегистрироваться"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;











