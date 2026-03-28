import React, { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ROUTES from "@/lib/routes";

interface LoginFormState {
  email: string;
  password: string;
}

interface RegisterFormState {
  email: string;
  password: string;
  name: string;
  faceitUrl: string;
  teamCode: string;
  role: "player" | "staff";
}

type RegisterMode = "solo" | "team";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, requestPasswordReset, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [registerMode, setRegisterMode] = useState<RegisterMode>("solo");
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: ""
  });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    email: "",
    password: "",
    name: "",
    faceitUrl: "",
    teamCode: "",
    role: "player"
  });

  useEffect(() => {
    if (user) {
      navigate(ROUTES.DASHBOARD);
    }
  }, [user, navigate]);

  const updateLoginField = (field: keyof LoginFormState, value: string): void => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRegisterField = <K extends keyof RegisterFormState>(field: K, value: RegisterFormState[K]): void => {
    setRegisterForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const { email, password } = loginForm;
    if (!email.trim() || !password) {
      toast.error("Пожалуйста, заполните email и пароль");
      return;
    }

    try {
      setLoading(true);
      await login({ email, password });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Укажите email для восстановления");
      return;
    }

    try {
      setLoading(true);
      const result = await requestPasswordReset(forgotEmail.trim());
      if (result.success) {
        setForgotEmail("");
        setShowForgotPassword(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const { email, password, name, faceitUrl, teamCode, role } = registerForm;
    if (!email.trim() || !password || !name.trim()) {
      toast.error("Пожалуйста, заполните обязательные поля");
      return;
    }

    if (registerMode === "solo" && !faceitUrl.trim()) {
      toast.error("Для solo-регистрации ссылка Faceit обязательна");
      return;
    }

    if (registerMode === "team" && role === "player" && !teamCode.trim()) {
      toast.error("Для командной регистрации нужен код команды");
      return;
    }

    try {
      setLoading(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: registerMode === "team" ? role : "player",
        playerType: registerMode,
        faceitUrl: faceitUrl.trim() || undefined,
        teamCode: registerMode === "team" && teamCode.trim() ? teamCode.trim() : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl lg:text-6xl font-bold text-esports-blue mb-4">Performance Hub</h1>
          <p className="text-xl lg:text-2xl text-esports-darkGray mb-8">Отследи свой успех</p>
          <p className="text-muted-foreground max-w-xl">
            Платформа для мониторинга и улучшения прогресса. Для командного доступа используйте код, который выдал
            тренер, админ или другой участник staff.
          </p>
        </div>

        <div className="flex-1 w-full max-w-md space-y-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Вход в аккаунт</CardTitle>
                  <CardDescription>Введите ваши данные для входа в систему</CardDescription>
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
                        onChange={(event) => updateLoginField("email", event.target.value)}
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
                        onChange={(event) => updateLoginField("password", event.target.value)}
                        disabled={loading}
                        autoComplete="current-password"
                      />
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary underline-offset-4 hover:underline"
                      onClick={() => setShowForgotPassword((prev) => !prev)}
                    >
                      {showForgotPassword ? "Скрыть форму восстановления" : "Забыли пароль?"}
                    </button>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Вход..." : "Войти"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Создание аккаунта</CardTitle>
                  <CardDescription>Выберите solo или командный доступ и заполните форму ниже.</CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={registerMode === "solo" ? "default" : "outline"}
                        onClick={() => setRegisterMode("solo")}
                        disabled={loading}
                      >
                        Solo
                      </Button>
                      <Button
                        type="button"
                        variant={registerMode === "team" ? "default" : "outline"}
                        onClick={() => setRegisterMode("team")}
                        disabled={loading}
                      >
                        Team
                      </Button>
                    </div>

                    {registerMode === "team" && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={registerForm.role === "player" ? "default" : "outline"}
                          onClick={() => updateRegisterField("role", "player")}
                          disabled={loading}
                        >
                          Игрок
                        </Button>
                        <Button
                          type="button"
                          variant={registerForm.role === "staff" ? "default" : "outline"}
                          onClick={() => updateRegisterField("role", "staff")}
                          disabled={loading}
                        >
                          Стафф
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-name">Имя</Label>
                      <Input
                        id="register-name"
                        placeholder="Иван Иванов"
                        value={registerForm.name}
                        onChange={(event) => updateRegisterField("name", event.target.value)}
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
                        onChange={(event) => updateRegisterField("email", event.target.value)}
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
                        onChange={(event) => updateRegisterField("password", event.target.value)}
                        disabled={loading}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-faceit">
                        Ссылка Faceit {registerMode === "solo" ? "" : "(обязательно для игроков)"}
                      </Label>
                      <Input
                        id="register-faceit"
                        placeholder="https://www.faceit.com/..."
                        value={registerForm.faceitUrl}
                        onChange={(event) => updateRegisterField("faceitUrl", event.target.value)}
                        disabled={loading}
                      />
                    </div>

                    {registerMode === "team" && (
                      <div className="space-y-2">
                        <Label htmlFor="team-code">Код команды</Label>
                        <Input
                          id="team-code"
                          placeholder={registerForm.role === "staff" ? "Необязательно, если вы создаете новую команду" : "Код для player или staff"}
                          value={registerForm.teamCode}
                          onChange={(event) => updateRegisterField("teamCode", event.target.value)}
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Игроку код обязателен. Staff-профиль типа team может оставить поле пустым, если сначала создаст свою команду в профиле.
                        </p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Создание..." : "Зарегистрироваться"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>

          {showForgotPassword && (
            <Card>
              <CardHeader>
                <CardTitle>Восстановление пароля</CardTitle>
                <CardDescription>Введите email, и мы отправим ссылку для смены пароля.</CardDescription>
              </CardHeader>
              <form onSubmit={handleForgotPassword}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="example@email.com"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      disabled={loading}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Отправляем..." : "Отправить ссылку"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
