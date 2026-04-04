import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ROUTES from "@/lib/routes";
import atlantTechnologyLogo from "@/assets/atlant-technology-logo.jpg";
import atlantTechnologyMark from "@/assets/atlant-technology-mark.png";

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

const heroHighlights = [
  "Персональный трекинг состояния игроков",
  "Быстрая регистрация для solo и team",
  "Удобный onboarding через Faceit и код команды",
];

const platformMetrics = [
  { value: "24/7", label: "Доступ к данным и прогрессу" },
  { value: "Solo", label: "Режим для индивидуальных игроков" },
  { value: "Team", label: "Подключение состава и staff" },
];

const leftColumnFontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, requestPasswordReset, resendVerificationEmail, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [registerMode, setRegisterMode] = useState<RegisterMode>("solo");
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({
    email: "",
    password: "",
    name: "",
    faceitUrl: "",
    teamCode: "",
    role: "player",
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
      const result = await login({ email, password });
      if (result.success) {
        setPendingVerificationEmail("");
        return;
      }

      if (result.code === "EMAIL_NOT_VERIFIED") {
        setPendingVerificationEmail(email.trim());
      }
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
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: registerMode === "team" ? role : "player",
        playerType: registerMode,
        faceitUrl: faceitUrl.trim() || undefined,
        teamCode: registerMode === "team" && teamCode.trim() ? teamCode.trim() : undefined,
      });

      if (result.success && !result.user) {
        setAuthTab("login");
        setPendingVerificationEmail(email.trim());
        setRegisterForm((prev) => ({
          ...prev,
          password: "",
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    if (!pendingVerificationEmail.trim()) {
      toast.error("Сначала укажите email аккаунта");
      return;
    }

    try {
      setLoading(true);
      await resendVerificationEmail(pendingVerificationEmail.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-4rem] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute right-[-10rem] top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-700/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_88%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] xl:gap-14">
          <div className="space-y-8" style={{ fontFamily: leftColumnFontFamily }}>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200 backdrop-blur-sm">
              Atlant Technology
            </div>

            <div className="max-w-2xl space-y-6">
              <div className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-md sm:max-w-md">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-sky-900/20">
                  <img
                    src={atlantTechnologyLogo}
                    alt="Atlant Technology"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-200/90">
                    Esports Platform
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    Performance Hub
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl leading-tight text-white sm:text-5xl lg:text-6xl">
                  Регистрация и вход в экосистему{" "}
                  <span className="font-heading bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    Atlant Technology
                  </span>
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  Платформа для мониторинга состояния игроков, прогресса команды и ежедневной аналитики.
                  Для командного доступа используйте код, который выдал тренер, админ или другой участник staff.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {platformMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-lg shadow-slate-950/20 backdrop-blur-md"
                  >
                    <div className="text-2xl font-semibold text-white">{metric.value}</div>
                    <div className="mt-1 text-sm leading-5 text-slate-300">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-sky-400/20 bg-gradient-to-br from-sky-500/14 via-slate-900/70 to-slate-900/90 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur-md">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-200">
                  Что внутри
                </p>
                <div className="mt-4 space-y-3">
                  {heroHighlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
                    >
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-sky-300 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                      <p className="text-sm leading-6 text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-6 shadow-2xl shadow-black/25 backdrop-blur-md">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">
                  Быстрый старт
                </p>
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-sm text-slate-400">1. Выберите режим</p>
                    <p className="mt-1 text-base font-medium text-white">Solo для игрока или Team для состава и staff</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">2. Заполните форму</p>
                    <p className="mt-1 text-base font-medium text-white">Email, пароль, имя и при необходимости ссылка Faceit</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">3. Подтвердите почту</p>
                    <p className="mt-1 text-base font-medium text-white">После этого можно сразу перейти к дашборду</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl justify-self-center lg:justify-self-end">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
              <div className="rounded-[28px] border border-white/8 bg-slate-950/70 p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-white p-1 shadow-md shadow-sky-950/30">
                      <img
                        src={atlantTechnologyMark}
                        alt="Логотип Atlant Technology"
                        className="h-full w-full rounded-xl object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">
                        Atlant Technology
                      </p>
                      <p className="text-sm text-slate-300">Вход и регистрация в системе</p>
                    </div>
                  </div>
                  <div className="hidden rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 sm:block">
                    Secure access
                  </div>
                </div>

                <Tabs value={authTab} onValueChange={(value) => setAuthTab(value as "login" | "register")} className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
                    <TabsTrigger
                      value="login"
                      className="rounded-xl py-2.5 text-sm font-semibold text-slate-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-400 data-[state=active]:to-blue-500 data-[state=active]:text-white"
                    >
                      Вход
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="rounded-xl py-2.5 text-sm font-semibold text-slate-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-400 data-[state=active]:to-blue-500 data-[state=active]:text-white"
                    >
                      Регистрация
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-4">
                    <Card className="border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-950/40">
                      <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl text-white">Вход в аккаунт</CardTitle>
                        <CardDescription className="text-slate-300">
                          Введите ваши данные для входа в систему.
                        </CardDescription>
                      </CardHeader>
                      <form onSubmit={handleLogin}>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="login-email" className="text-slate-200">Email</Label>
                            <Input
                              id="login-email"
                              type="email"
                              placeholder="example@email.com"
                              value={loginForm.email}
                              onChange={(event) => updateLoginField("email", event.target.value)}
                              disabled={loading}
                              autoComplete="email"
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="login-password" className="text-slate-200">Пароль</Label>
                            <Input
                              id="login-password"
                              type="password"
                              value={loginForm.password}
                              onChange={(event) => updateLoginField("password", event.target.value)}
                              disabled={loading}
                              autoComplete="current-password"
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>
                          <button
                            type="button"
                            className="text-sm font-medium text-sky-300 underline-offset-4 transition hover:text-sky-200 hover:underline"
                            onClick={() => setShowForgotPassword((prev) => !prev)}
                          >
                            {showForgotPassword ? "Скрыть форму восстановления" : "Забыли пароль?"}
                          </button>
                        </CardContent>
                        <CardFooter>
                          <Button
                            type="submit"
                            className="h-11 w-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-400 text-white shadow-lg shadow-sky-950/30 hover:from-sky-300 hover:via-blue-400 hover:to-cyan-300"
                            disabled={loading}
                          >
                            {loading ? "Вход..." : "Войти"}
                          </Button>
                        </CardFooter>
                      </form>
                    </Card>
                  </TabsContent>

                  <TabsContent value="register" className="mt-4">
                    <Card className="border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-950/40">
                      <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl text-white">Создание аккаунта</CardTitle>
                        <CardDescription className="text-slate-300">
                          Выберите solo или командный доступ и заполните форму ниже.
                        </CardDescription>
                      </CardHeader>
                      <form onSubmit={handleRegister}>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className={registerMode === "solo"
                                ? "border-sky-300/30 bg-sky-400/15 text-white hover:bg-sky-400/20 hover:text-white"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"}
                              onClick={() => setRegisterMode("solo")}
                              disabled={loading}
                            >
                              Solo
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={registerMode === "team"
                                ? "border-sky-300/30 bg-sky-400/15 text-white hover:bg-sky-400/20 hover:text-white"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"}
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
                                variant="outline"
                                className={registerForm.role === "player"
                                  ? "border-sky-300/30 bg-sky-400/15 text-white hover:bg-sky-400/20 hover:text-white"
                                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"}
                                onClick={() => updateRegisterField("role", "player")}
                                disabled={loading}
                              >
                                Игрок
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={registerForm.role === "staff"
                                  ? "border-sky-300/30 bg-sky-400/15 text-white hover:bg-sky-400/20 hover:text-white"
                                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"}
                                onClick={() => updateRegisterField("role", "staff")}
                                disabled={loading}
                              >
                                Стафф
                              </Button>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="register-name" className="text-slate-200">Имя</Label>
                            <Input
                              id="register-name"
                              placeholder="Иван Иванов"
                              value={registerForm.name}
                              onChange={(event) => updateRegisterField("name", event.target.value)}
                              disabled={loading}
                              autoComplete="name"
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-email" className="text-slate-200">Email</Label>
                            <Input
                              id="register-email"
                              type="email"
                              placeholder="example@email.com"
                              value={registerForm.email}
                              onChange={(event) => updateRegisterField("email", event.target.value)}
                              disabled={loading}
                              autoComplete="email"
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-password" className="text-slate-200">Пароль</Label>
                            <Input
                              id="register-password"
                              type="password"
                              value={registerForm.password}
                              onChange={(event) => updateRegisterField("password", event.target.value)}
                              disabled={loading}
                              autoComplete="new-password"
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="register-faceit" className="text-slate-200">
                              Ссылка Faceit {registerMode === "solo" ? "" : "(обязательно для игроков)"}
                            </Label>
                            <Input
                              id="register-faceit"
                              placeholder="https://www.faceit.com/..."
                              value={registerForm.faceitUrl}
                              onChange={(event) => updateRegisterField("faceitUrl", event.target.value)}
                              disabled={loading}
                              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                            />
                          </div>

                          {registerMode === "team" && (
                            <div className="space-y-2">
                              <Label htmlFor="team-code" className="text-slate-200">Код команды</Label>
                              <Input
                                id="team-code"
                                placeholder={registerForm.role === "staff" ? "Необязательно, если вы создаете новую команду" : "Код для player или staff"}
                                value={registerForm.teamCode}
                                onChange={(event) => updateRegisterField("teamCode", event.target.value)}
                                disabled={loading}
                                className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                              />
                              <p className="text-xs leading-5 text-slate-400">
                                Игроку код обязателен. Staff-профиль типа team может оставить поле пустым, если сначала создаст свою команду в профиле.
                              </p>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter>
                          <Button
                            type="submit"
                            className="h-11 w-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-400 text-white shadow-lg shadow-sky-950/30 hover:from-sky-300 hover:via-blue-400 hover:to-cyan-300"
                            disabled={loading}
                          >
                            {loading ? "Создание..." : "Зарегистрироваться"}
                          </Button>
                        </CardFooter>
                      </form>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="mt-4 space-y-4">
                  {pendingVerificationEmail && (
                    <Card className="border-amber-300/25 bg-gradient-to-br from-amber-400/15 via-orange-400/10 to-white/5 text-amber-50 shadow-lg shadow-amber-950/10">
                      <CardHeader className="space-y-3 pb-4">
                        <div className="inline-flex w-fit rounded-full border border-amber-200/30 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-amber-100">
                          Нужно действие
                        </div>
                        <CardTitle className="text-lg font-semibold text-amber-50">
                          Подтвердите email
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed text-amber-100/75">
                          Мы создали аккаунт, но для первого входа нужно подтвердить почту.
                        </CardDescription>
                        <div className="break-all rounded-lg border border-amber-100/20 bg-black/15 px-4 py-3 text-sm font-medium text-amber-50">
                          {pendingVerificationEmail}
                        </div>
                      </CardHeader>
                      <CardFooter className="pt-0">
                        <Button
                          type="button"
                          className="w-full bg-amber-100 text-slate-950 hover:bg-amber-50"
                          onClick={handleResendVerification}
                          disabled={loading}
                        >
                          {loading ? "Отправляем..." : "Отправить письмо повторно"}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {showForgotPassword && (
                    <Card className="border-white/10 bg-white/5 text-white shadow-lg shadow-slate-950/20 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white">Восстановление пароля</CardTitle>
                        <CardDescription className="text-slate-300">
                          Введите email, и мы отправим ссылку для смены пароля.
                        </CardDescription>
                      </CardHeader>
                      <form onSubmit={handleForgotPassword}>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email" className="text-slate-200">Email</Label>
                            <Input
                              id="forgot-email"
                              type="email"
                              placeholder="example@email.com"
                              value={forgotEmail}
                              onChange={(event) => setForgotEmail(event.target.value)}
                              disabled={loading}
                              className="border-white/10 bg-black/10 text-white placeholder:text-slate-500"
                            />
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            type="submit"
                            className="h-11 w-full bg-white text-slate-950 hover:bg-slate-100"
                            disabled={loading}
                          >
                            {loading ? "Отправляем..." : "Отправить ссылку"}
                          </Button>
                        </CardFooter>
                      </form>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
