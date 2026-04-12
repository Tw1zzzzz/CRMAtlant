import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, Pencil, X, Check, ArrowRightLeft, Link2, ShieldCheck, UserPlus2 } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import StaffPrivilegeUpgrade from "@/components/StaffPrivilegeUpgrade";
import TeamManagement from "@/pages/TeamManagement";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/imageUtils";
import { TeamLinkSummary } from "@/types";
import { cn } from "@/lib/utils";



/**
 * Интерфейс состояния профиля
 */
interface ProfileState {
  isDeleting: boolean;
  isDialogOpen: boolean;
  isUploadingAvatar: boolean;
  lastAvatarUpdate: number;
}

interface PendingTeamRelink {
  teamCode: string;
  targetProfileKey: string;
  currentTeam: TeamLinkSummary;
  nextTeam: TeamLinkSummary;
}

/**
 * Компонент страницы профиля пользователя
 * Отображает данные профиля и предоставляет возможность удаления аккаунта
 */
const Profile: React.FC = () => {
  const {
    user,
    deleteAccount,
    updateAvatar,
    refreshUser,
    changePassword,
    resendVerificationEmail,
    createPlayerProfile,
    linkTeamProfile,
    switchProfile
  } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Объединение связанных состояний в один объект
  const [state, setState] = useState<ProfileState>({
    isDeleting: false,
    isDialogOpen: false,
    isUploadingAvatar: false,
    lastAvatarUpdate: 0
  });

  // Состояния для редактирования FACEIT ссылки
  const [isEditingFaceit, setIsEditingFaceit] = useState(false);
  const [faceitUrl, setFaceitUrl] = useState('');
  const [currentFaceitUrl, setCurrentFaceitUrl] = useState<string | null>(null);
  const [isSavingFaceit, setIsSavingFaceit] = useState(false);
  const [loadingFaceit, setLoadingFaceit] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingVerificationEmail, setIsSendingVerificationEmail] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [playerProfileForm, setPlayerProfileForm] = useState({
    playerType: "team" as "team" | "solo",
    faceitUrl: "",
    nickname: "",
  });
  const [isCreatingPlayerProfile, setIsCreatingPlayerProfile] = useState(false);
  const [teamCode, setTeamCode] = useState("");
  const [isLinkingTeamProfile, setIsLinkingTeamProfile] = useState(false);
  const [pendingTeamRelink, setPendingTeamRelink] = useState<PendingTeamRelink | null>(null);
  const [teamSwitchSuggestion, setTeamSwitchSuggestion] = useState<{
    profileKey: string;
    label: string;
  } | null>(null);
  const [staffProfileTab, setStaffProfileTab] = useState<"profile" | "team">("profile");

  // Загружаем текущую FACEIT ссылку при монтировании
  useEffect(() => {
    if (!user) return;
    setLoadingFaceit(true);
    const token = localStorage.getItem('token');
    fetch('/api/auth/faceit-url', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setCurrentFaceitUrl(data.faceitUrl);
      })
      .catch(() => {})
      .finally(() => setLoadingFaceit(false));
  }, [user]);

  /**
   * Сохранение новой FACEIT ссылки
   */
  const handleSaveFaceitUrl = async (): Promise<void> => {
    if (!faceitUrl.trim()) {
      toast.error('Введите ссылку FACEIT');
      return;
    }

    setIsSavingFaceit(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/auth/update-faceit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ faceitUrl: faceitUrl.trim() })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('FACEIT ссылка успешно обновлена');
        setCurrentFaceitUrl(faceitUrl.trim());
        setIsEditingFaceit(false);
        await refreshUser();
      } else {
        toast.error(data.message || 'Не удалось обновить FACEIT ссылку');
      }
    } catch (error) {
      console.error('Ошибка при обновлении FACEIT ссылки:', error);
      toast.error('Ошибка при сохранении FACEIT ссылки');
    } finally {
      setIsSavingFaceit(false);
    }
  };

  const handlePasswordFieldChange = (
    field: "currentPassword" | "newPassword" | "confirmPassword",
    value: string
  ): void => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async (): Promise<void> => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Заполните все поля для смены пароля");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Новый пароль должен содержать минимум 8 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleResendVerificationEmail = async (): Promise<void> => {
    if (!user?.email) {
      return;
    }

    setIsSendingVerificationEmail(true);
    try {
      await resendVerificationEmail(user.email);
    } finally {
      setIsSendingVerificationEmail(false);
    }
  };

  const handleCreatePlayerProfile = async (): Promise<void> => {
    if (!playerProfileForm.faceitUrl.trim()) {
      toast.error("Укажите Faceit-ссылку для профиля игрока");
      return;
    }

    setIsCreatingPlayerProfile(true);
    try {
      const result = await createPlayerProfile({
        playerType: playerProfileForm.playerType,
        faceitUrl: playerProfileForm.faceitUrl.trim(),
        nickname: playerProfileForm.nickname.trim() || undefined,
      });

      if (result.success) {
        setPlayerProfileForm({
          playerType: "team",
          faceitUrl: "",
          nickname: "",
        });
      }
    } finally {
      setIsCreatingPlayerProfile(false);
    }
  };

  const handleTeamLinkSubmit = async (
    confirmRelink = false,
    overrideCode?: string
  ): Promise<void> => {
    const normalizedTeamCode = (overrideCode || teamCode).trim();

    if (!normalizedTeamCode) {
      toast.error("Введите team-код");
      return;
    }

    setIsLinkingTeamProfile(true);
    try {
      const result = await linkTeamProfile({
        teamCode: normalizedTeamCode,
        confirmRelink,
      });

      if (!result.success) {
        toast.error(result.error || "Не удалось привязать профиль к команде");
        return;
      }

      if (
        result.status === "confirmation_required" &&
        result.currentTeam &&
        result.nextTeam &&
        result.targetProfileKey
      ) {
        setPendingTeamRelink({
          teamCode: normalizedTeamCode,
          targetProfileKey: result.targetProfileKey,
          currentTeam: result.currentTeam,
          nextTeam: result.nextTeam,
        });
        return;
      }

      setPendingTeamRelink(null);
      setTeamCode("");

      const targetProfileKey = result.targetProfileKey || null;
      const activeProfileKey = result.user?.activeProfileKey || user?.activeProfileKey || null;
      if (targetProfileKey && activeProfileKey && targetProfileKey !== activeProfileKey) {
        setTeamSwitchSuggestion({
          profileKey: targetProfileKey,
          label: targetProfileKey === "staff_team" ? "Переключиться в Staff / Team" : "Переключиться в Игрок / Team",
        });
      } else {
        setTeamSwitchSuggestion(null);
      }

      toast.success(result.message || "Team-профиль успешно привязан");
    } finally {
      setIsLinkingTeamProfile(false);
    }
  };

  const handleConfirmTeamRelink = async (): Promise<void> => {
    if (!pendingTeamRelink) {
      return;
    }

    await handleTeamLinkSubmit(true, pendingTeamRelink.teamCode);
  };



  /**
   * Обработчик для изменения состояния диалога
   */
  const handleDialogChange = (open: boolean): void => {
    setState(prevState => ({ ...prevState, isDialogOpen: open }));
  };

  /**
   * Обработчик удаления аккаунта пользователя
   */
  const handleDeleteAccount = async (): Promise<void> => {
    // Устанавливаем состояние удаления
    setState(prevState => ({ ...prevState, isDeleting: true }));
    
    try {
      await deleteAccount();
      // После успешного удаления перенаправляем на страницу входа
      navigate("/login");
    } catch (error) {
      console.error("Ошибка при удалении аккаунта:", error);
    } finally {
      // Сбрасываем состояния независимо от результата
      setState(prevState => ({ 
        ...prevState, 
        isDeleting: false, 
        isDialogOpen: false 
      }));
    }
  };

  /**
   * Открывает диалог выбора файла
   */
  const handleAvatarClick = (): void => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /**
   * Обработчик загрузки аватара
   */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера файла (макс. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер - 5MB');
      return;
    }

    setState(prevState => ({ ...prevState, isUploadingAvatar: true }));
    
    try {
      console.log('Отправляем запрос на загрузку аватара...');
      const result = await updateAvatar(file);
      
      if (result.success) {
        console.log('Аватар успешно загружен:', result.avatar);
        
        // Принудительно обновляем состояние компонента
        setState(prevState => ({ 
          ...prevState, 
          isUploadingAvatar: false,
          // Добавляем временную метку, чтобы принудительно обновить UI
          lastAvatarUpdate: Date.now() 
        }));
        
        // Добавляем небольшую задержку перед проверкой 
        setTimeout(() => {
          // Делаем GET-запрос для проверки статуса аватара
          fetch('/api/auth/avatar/check')
            .then(res => res.json())
            .then(data => {
              console.log('Проверка аватара:', data);
            })
            .catch(err => {
              console.error('Ошибка при проверке аватара:', err);
            });
        }, 500);
      } else {
        console.error('Ошибка при загрузке аватара:', result.error);
        setState(prevState => ({ ...prevState, isUploadingAvatar: false }));
      }
    } catch (error) {
      console.error("Ошибка при загрузке аватара:", error);
      setState(prevState => ({ ...prevState, isUploadingAvatar: false }));
    } finally {
      // Очищаем поле ввода для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const canCreateTeamPlayerProfileNext = (user.availableProfiles || []).some(
      (profile) => profile.role === "staff" && profile.playerType === "team" && profile.teamId
    );

    if (!canCreateTeamPlayerProfileNext && playerProfileForm.playerType === "team") {
      setPlayerProfileForm((prev) => ({ ...prev, playerType: "solo" }));
    }
  }, [playerProfileForm.playerType, user]);

  useEffect(() => {
    if (!user || !teamSwitchSuggestion?.profileKey) {
      return;
    }

    if (user.activeProfileKey === teamSwitchSuggestion.profileKey) {
      setTeamSwitchSuggestion(null);
    }
  }, [teamSwitchSuggestion, user]);



  /**
   * Компонент для неавторизованных пользователей
   */
  const UnauthenticatedView = () => (
    <div className="flex items-center justify-center h-full performance-page">
      <Card className="w-full max-w-md performance-hero">
        <CardHeader>
          <CardTitle>Требуется авторизация</CardTitle>
          <CardDescription>
            Для доступа к профилю необходимо войти в систему
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => navigate("/login")}>
            Войти
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  // Если пользователь не авторизован, показываем соответствующий компонент
  if (!user) {
    return <UnauthenticatedView />;
  }

  const { isDeleting, isDialogOpen, isUploadingAvatar, lastAvatarUpdate } = state;
  const isTeamStaff = user.role === "staff" && user.playerType === "team";
  const teamName = user.teamName?.trim() || "";
  const teamLogo = user.teamLogo?.trim() || "";
  const teamLogoUrl = getImageUrl(teamLogo) || teamLogo;
  const availableProfiles = user.availableProfiles || [];
  const hasPlayerProfile = availableProfiles.some((profile) => profile.role === "player");
  const canCreateTeamPlayerProfile = availableProfiles.some(
    (profile) => profile.role === "staff" && profile.playerType === "team" && profile.teamId
  );
  const hasLinkedTeamProfileForActiveRole = availableProfiles.some(
    (profile) => profile.role === user.role && profile.playerType === "team" && Boolean(profile.teamId)
  );
  const teamLinkTargetLabel = user.role === "staff" ? "staff-код" : "player-код";
  const teamLinkTitle = user.role === "staff" ? "Привязка Staff / Team" : "Привязка Игрок / Team";
  const teamLinkDescription =
    user.playerType === "team" && teamName
      ? `Сейчас активный team-профиль привязан к команде «${teamName}». Здесь можно перепривязать его по новому ${teamLinkTargetLabel}.`
      : hasLinkedTeamProfileForActiveRole
        ? `У вас уже есть Team-профиль для роли «${user.role === "staff" ? "staff" : "player"}». Введите новый ${teamLinkTargetLabel}, чтобы обновить привязку команды.`
        : user.role === "staff"
          ? "Введите staff-код, чтобы добавить отдельный профиль Staff / Team и затем переключаться между контекстами."
          : "Введите player-код, чтобы добавить отдельный профиль Игрок / Team и затем переключаться между Solo и Team.";
  const currentActiveProfile = availableProfiles.find((profile) => profile.key === user.activeProfileKey) || null;
  const hasMultipleProfiles = availableProfiles.length > 1;

  return (
    <div className="container mx-auto py-6 performance-page">
      <span className="performance-eyebrow">Identity Center</span>
      <h1 className="text-3xl font-bold mb-2 performance-title">Профиль пользователя</h1>
      <p className="text-muted-foreground performance-subtitle mb-6">
        Управление персональными данными, правами и настройками аккаунта.
      </p>
      
      <div
        className={cn(
          "grid grid-cols-1 gap-8",
          isTeamStaff ? "xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]" : "lg:grid-cols-2"
        )}
      >
        {/* Карточка с информацией о профиле */}
        <Card className="performance-hero">
          <CardHeader>
            <CardTitle>Информация о профиле</CardTitle>
            <CardDescription>
              Ваши персональные данные
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Аватар пользователя */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <UserAvatar 
                  user={user} 
                  size="xl" 
                  className="cursor-pointer"
                  onClick={handleAvatarClick}
                  key={`profile-avatar-${lastAvatarUpdate}`}
                  forceUpdate={true}
                />
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  <Camera className="text-white" size={24} />
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs flex items-center gap-1"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
              >
                <Upload size={14} />
                Изменить аватар
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Имя</Label>
              <div className="p-2 bg-muted rounded">{user.name}</div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 bg-muted rounded space-y-2">
                <div>{user.email}</div>
                <div className="text-xs text-muted-foreground">
                  {user.emailVerified ? "Email подтвержден" : "Email пока не подтвержден"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <div className="p-2 bg-muted rounded">
                {user.role === "player" ? "Игрок" : "Стафф"}
              </div>
            </div>
            {user.playerType === "team" && (
              <div className="rounded-2xl border border-sky-400/25 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_40px_rgba(14,165,233,0.12)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    {teamLogo ? (
                      <img
                        src={teamLogoUrl}
                        alt={teamName}
                        className="h-16 w-16 rounded-2xl border object-cover"
                        style={{ borderColor: "rgba(125,211,252,0.18)" }}
                      />
                    ) : null}
                    <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/80">
                      Текущая команда
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {teamName || "Команда пока не назначена"}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {teamName
                        ? user.role === "staff"
                          ? "Вы работаете внутри этой команды и управляете её составом."
                          : "Ваш профиль привязан к этой команде."
                        : user.role === "staff"
                          ? "Создайте команду или присоединитесь по staff-коду, чтобы начать работу."
                        : "Команда появится здесь после привязки по team-коду."}
                    </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">
                    {user.role === "staff" ? "Staff / Team" : "Player / Team"}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Тип профиля</Label>
              <div className="p-2 bg-muted rounded">
                {user.playerType === "team" ? "Командный" : "Solo"}
              </div>
            </div>

            {/* Секция FACEIT профиля */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>FACEIT профиль</Label>
                {!isEditingFaceit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFaceitUrl(currentFaceitUrl || '');
                      setIsEditingFaceit(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Изменить
                  </Button>
                )}
              </div>

              {isEditingFaceit ? (
                <div className="space-y-2">
                  <Input
                    placeholder="https://www.faceit.com/en/players/ваш-никнейм"
                    value={faceitUrl}
                    onChange={(e) => setFaceitUrl(e.target.value)}
                    disabled={isSavingFaceit}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveFaceitUrl}
                      disabled={isSavingFaceit}
                    >
                      {isSavingFaceit ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin rounded-full h-3 w-3 border-t-2 border-white" />
                          Сохранение...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Сохранить
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingFaceit(false)}
                      disabled={isSavingFaceit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-muted rounded text-sm break-all">
                  {loadingFaceit ? (
                    <span className="text-muted-foreground">Загрузка...</span>
                  ) : currentFaceitUrl ? (
                    <a
                      href={currentFaceitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {currentFaceitUrl}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Не указан</span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Безопасность</h2>
                <p className="text-sm text-muted-foreground">
                  Подтверждение почты и смена пароля аккаунта.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Статус email</p>
                      <p className="text-sm text-muted-foreground">
                        {user.emailVerified
                          ? "Почта подтверждена, аккаунт активен."
                          : "Почта еще не подтверждена. Без этого вход может быть ограничен."}
                      </p>
                    </div>
                    {!user.emailVerified && (
                      <Button
                        variant="outline"
                        onClick={handleResendVerificationEmail}
                        disabled={isSendingVerificationEmail}
                      >
                        {isSendingVerificationEmail ? "Отправляем..." : "Отправить письмо"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Сменить пароль</p>
                    <p className="text-sm text-muted-foreground">
                      После смены пароля потребуется войти в аккаунт заново.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current-password">Текущий пароль</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => handlePasswordFieldChange("currentPassword", event.target.value)}
                      autoComplete="current-password"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">Новый пароль</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => handlePasswordFieldChange("newPassword", event.target.value)}
                      autoComplete="new-password"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Повторите новый пароль</Label>
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => handlePasswordFieldChange("confirmPassword", event.target.value)}
                      autoComplete="new-password"
                      disabled={isChangingPassword}
                    />
                  </div>

                  <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                    {isChangingPassword ? "Сохраняем..." : "Обновить пароль"}
                  </Button>
                </div>
              </div>
            </div>

          </CardContent>
          <CardFooter>
            {/* Диалог подтверждения удаления аккаунта */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button variant="destructive">Удалить аккаунт</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Вы уверены?</DialogTitle>
                  <DialogDescription>
                    Эта операция безвозвратно удалит ваш аккаунт и все связанные данные.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleDialogChange(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Удаление..." : "Удалить"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <div className="space-y-8">
          {isTeamStaff && (
            <Tabs
              value={staffProfileTab}
              onValueChange={(value) => setStaffProfileTab(value as "profile" | "team")}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                <TabsTrigger value="profile">Профиль и доступ</TabsTrigger>
                <TabsTrigger value="team">Моя команда и коды приглашения</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {(!isTeamStaff || staffProfileTab === "profile") && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Активный профиль</CardTitle>
                  <CardDescription>
                    {hasMultipleProfiles
                      ? "Один аккаунт может работать в нескольких контекстах. Переключение сразу меняет доступные разделы и права."
                      : "Сейчас у аккаунта один доступный контекст. Когда появятся дополнительные профили, переключение будет доступно здесь."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasMultipleProfiles && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                            Сейчас активен
                          </p>
                          <p className="mt-2 text-lg font-semibold">
                            {currentActiveProfile?.label || "Текущий профиль"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {currentActiveProfile?.teamName
                              ? `${currentActiveProfile.teamName} • ${currentActiveProfile.role === "staff" ? "staff" : "player"} / ${currentActiveProfile.playerType}`
                              : "Переключение ниже сразу меняет видимые разделы, доступы и контекст работы."}
                          </p>
                        </div>
                        <Badge className="w-fit">{availableProfiles.length} профиля</Badge>
                      </div>
                    </div>
                  )}
                  {availableProfiles.map((profile) => {
                    const isActive = profile.key === user.activeProfileKey;
                    return (
                      <div
                        key={profile.key}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                          isActive
                            ? "border-primary/35 bg-primary/5 shadow-[0_12px_30px_rgba(53,144,255,0.08)]"
                            : "border-border/80 bg-background/40 hover:border-primary/20"
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{profile.label}</p>
                            {isActive && <Badge>Активен</Badge>}
                            {profile.teamId && <Badge variant="secondary">Команда подключена</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {profile.teamName ? `${profile.teamName} • ` : ""}
                            {profile.role === "staff" ? "staff" : "player"} / {profile.playerType}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isActive
                              ? "Именно этот контекст сейчас определяет доступные разделы и действия в системе."
                              : "Можно безопасно переключиться без выхода из аккаунта."}
                          </p>
                        </div>
                        {hasMultipleProfiles ? (
                          <Button
                            variant={isActive ? "secondary" : "outline"}
                            className="sm:min-w-[140px]"
                            onClick={() => {
                              if (!isActive) {
                                void switchProfile(profile.key);
                              }
                            }}
                            disabled={isActive}
                          >
                            {isActive ? "Активен" : "Переключить"}
                          </Button>
                        ) : (
                          <Badge className="w-fit">Текущий профиль</Badge>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

          <Card>
            <CardHeader>
              <CardTitle>{teamLinkTitle}</CardTitle>
              <CardDescription>
                {teamLinkDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-border/80 bg-muted/20">
                <Link2 className="h-4 w-4" />
                <AlertTitle>
                  {user.playerType === "team" && teamName ? "Профиль уже связан с командой" : "Нужен корректный код команды"}
                </AlertTitle>
                <AlertDescription>
                  {user.playerType === "team" && teamName
                    ? `Сейчас активна команда «${teamName}». Новый код обновит привязку только после проверки и, при необходимости, подтверждения.`
                    : `Используйте ${teamLinkTargetLabel}, который выдал владелец команды. Сценарий работы аккаунта не изменится, добавится только новый team-контекст.`}
                </AlertDescription>
              </Alert>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleTeamLinkSubmit();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="team-profile-code">Team-код</Label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      id="team-profile-code"
                      placeholder={user.role === "staff" ? "Введите staff-код команды" : "Введите player-код команды"}
                      value={teamCode}
                      onChange={(event) => setTeamCode(event.target.value)}
                      disabled={isLinkingTeamProfile}
                      aria-describedby="team-profile-code-hint"
                    />
                    <Button type="submit" disabled={isLinkingTeamProfile} className="sm:min-w-[240px]">
                      {isLinkingTeamProfile ? "Проверяем код..." : user.playerType === "team" ? "Обновить привязку Team-профиля" : "Добавить Team-профиль"}
                    </Button>
                  </div>
                  <p id="team-profile-code-hint" className="text-sm text-muted-foreground">
                    После успешной проверки система либо сразу добавит team-профиль, либо попросит подтвердить перепривязку.
                  </p>
                </div>
              </form>
              {teamSwitchSuggestion && teamSwitchSuggestion.profileKey !== user.activeProfileKey && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4" aria-live="polite">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="font-medium text-emerald-100">Team-профиль готов</p>
                      <p className="mt-1 text-sm text-emerald-50/80">
                        Можно сразу перейти в новый контекст и открыть командные разделы без повторного входа.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => {
                      void switchProfile(teamSwitchSuggestion.profileKey);
                      setTeamSwitchSuggestion(null);
                    }}
                  >
                    {teamSwitchSuggestion.label}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {!hasPlayerProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Добавить профиль игрока</CardTitle>
                <CardDescription>
                  Можно оставить один логин и добавить второй контекст игрока. Для Team-профиля команда возьмётся из текущего staff/team аккаунта.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      playerProfileForm.playerType === "team"
                        ? "border-primary/35 bg-primary/5"
                        : "border-border/80 bg-background/40 hover:border-primary/20",
                      !canCreateTeamPlayerProfile && "cursor-not-allowed opacity-60"
                    )}
                    onClick={() => setPlayerProfileForm((prev) => ({ ...prev, playerType: "team" }))}
                    disabled={!canCreateTeamPlayerProfile}
                  >
                    <p className="font-medium">Игрок / Team</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Командный игровой контекст с привязкой к текущей staff/team команде.
                    </p>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      playerProfileForm.playerType === "solo"
                        ? "border-primary/35 bg-primary/5"
                        : "border-border/80 bg-background/40 hover:border-primary/20"
                    )}
                    onClick={() => setPlayerProfileForm((prev) => ({ ...prev, playerType: "solo" }))}
                  >
                    <p className="font-medium">Игрок / Solo</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Отдельный личный игровой контекст без командной привязки.
                    </p>
                  </button>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleCreatePlayerProfile();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="player-profile-faceit">Faceit-ссылка</Label>
                    <Input
                      id="player-profile-faceit"
                      placeholder="https://www.faceit.com/..."
                      value={playerProfileForm.faceitUrl}
                      onChange={(event) => setPlayerProfileForm((prev) => ({ ...prev, faceitUrl: event.target.value }))}
                      disabled={isCreatingPlayerProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="player-profile-nickname">Никнейм</Label>
                    <Input
                      id="player-profile-nickname"
                      placeholder="Необязательно"
                      value={playerProfileForm.nickname}
                      onChange={(event) => setPlayerProfileForm((prev) => ({ ...prev, nickname: event.target.value }))}
                      disabled={isCreatingPlayerProfile}
                    />
                  </div>
                  <Button type="submit" disabled={isCreatingPlayerProfile} className="sm:min-w-[220px]">
                    {isCreatingPlayerProfile ? "Добавляем..." : "Добавить профиль игрока"}
                  </Button>
                </form>
                {!canCreateTeamPlayerProfile && (
                  <Alert className="border-border/80 bg-muted/20">
                    <UserPlus2 className="h-4 w-4" />
                    <AlertTitle>Сначала подключите команду</AlertTitle>
                    <AlertDescription>
                      Team-профиль игрока станет доступен после привязки staff/team к конкретной команде.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Dialog
            open={Boolean(pendingTeamRelink)}
            onOpenChange={(open) => {
              if (!open) {
                setPendingTeamRelink(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Подтвердите перепривязку Team-профиля</DialogTitle>
                <DialogDescription>
                  {pendingTeamRelink
                    ? `Сейчас профиль привязан к команде «${pendingTeamRelink.currentTeam.name || "Без названия"}». После подтверждения он будет перепривязан к «${pendingTeamRelink.nextTeam.name}».`
                    : "Подтвердите действие."}
                </DialogDescription>
              </DialogHeader>
              {pendingTeamRelink && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Сейчас
                    </p>
                    <p className="mt-2 font-medium">{pendingTeamRelink.currentTeam.name || "Без названия"}</p>
                  </div>
                  <div className="flex items-center justify-center text-muted-foreground">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                      Будет подключено
                    </p>
                    <p className="mt-2 font-medium">{pendingTeamRelink.nextTeam.name}</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPendingTeamRelink(null)}
                  disabled={isLinkingTeamProfile}
                >
                  Отмена
                </Button>
                <Button onClick={() => void handleConfirmTeamRelink()} disabled={isLinkingTeamProfile}>
                  {isLinkingTeamProfile ? "Перепривязываем..." : "Подтвердить перепривязку"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {user.role !== "staff" && (
            <Card>
              <CardHeader>
                <CardTitle>Статистика</CardTitle>
                <CardDescription>
                  Сводка вашей активности
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded">
                  <p className="text-sm">Подробная статистика доступна в разделах «Статистика», «Настроение и энергия» и «Тесты».</p>
                </div>
              </CardContent>
            </Card>
          )}

          {user.role === "staff" && !isTeamStaff && (
            <Card>
              <CardHeader>
                <CardTitle>Права и доступ</CardTitle>
                <CardDescription>
                  Управление привилегиями сотрудника
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffPrivilegeUpgrade
                  onUpgradeSuccess={refreshUser}
                />
              </CardContent>
            </Card>
          )}
            </>
          )}

          {isTeamStaff && staffProfileTab === "team" && <TeamManagement />}
        </div>
      </div>
    </div>
  );
};

export default Profile;
