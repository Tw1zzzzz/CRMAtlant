import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/utils/api/api-client";
import { TeamSummary, User } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Copy, ImagePlus, Loader2, RefreshCcw, Shield, Users } from "lucide-react";

type TeamListResponse = {
  teams: TeamSummary[];
};

type TeamMembersResponse = {
  team: {
    id: string;
    name: string;
    logo?: string;
    playerLimit: number;
    isCreator?: boolean;
  };
  members: User[];
};

const normalizeTeamId = (team: TeamSummary & { _id?: string }, index: number): string => {
  return team.id || team._id || `${team.name || "team"}-${index}`;
};

const normalizeMemberId = (member: User & { _id?: string }, index: number): string => {
  return member.id || member._id || member.email || `${member.name || "member"}-${index}`;
};

const getMemberInitials = (member: User): string => {
  const source = member.name?.trim() || member.email || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getRoleLabel = (member: User): string => (member.role === "staff" ? "staff" : "игрок");
const getPlayerTypeLabel = (member: User): string | null => {
  if (!member.playerType) {
    return null;
  }

  return member.playerType === "team" ? "team" : "solo";
};

const TeamManagement: React.FC = () => {
  const { refreshUser, user } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [selectedTeamMeta, setSelectedTeamMeta] = useState<TeamMembersResponse["team"] | null>(null);
  const [playerCode, setPlayerCode] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [brandingName, setBrandingName] = useState("");
  const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<"create-team" | "update-branding" | "regenerate-player" | "regenerate-staff" | null>(null);
  const hasExistingTeam = teams.length > 0 || Boolean(user?.teamId);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || teams[0] || null;
  const currentTeamName =
    user?.teamName?.trim() ||
    selectedTeam?.name ||
    "";
  const currentTeamLogo = selectedTeamMeta?.logo || selectedTeam?.logo || user?.teamLogo || "";
  const currentTeamLogoUrl = getImageUrl(currentTeamLogo) || currentTeamLogo;
  const brandingLogoPreviewUrl = brandingLogoPreview.startsWith("blob:")
    ? brandingLogoPreview
    : (getImageUrl(brandingLogoPreview) || brandingLogoPreview);
  const isBrandingDirty = useMemo(() => {
    if (!selectedTeamMeta) {
      return false;
    }

    return brandingName.trim() !== (selectedTeamMeta.name || "").trim() || Boolean(brandingLogoFile);
  }, [brandingLogoFile, brandingName, selectedTeamMeta]);

  const loadTeams = useCallback(async () => {
    const response = await apiClient.get<TeamListResponse>("/teams");
    const nextTeams = (response.teams || []).map((team, index) => ({
      ...team,
      id: normalizeTeamId(team as TeamSummary & { _id?: string }, index),
    }));
    setTeams(nextTeams);
    return nextTeams;
  }, []);

  const loadMembers = useCallback(async (teamId: string) => {
    setMembersLoading(true);
    try {
      const response = await apiClient.get<TeamMembersResponse>(`/teams/${teamId}/members`);
      const nextMembers = (response.members || []).map((member, index) => ({
        ...member,
        id: normalizeMemberId(member as User & { _id?: string }, index),
      }));
      setSelectedTeamMeta(response.team);
      setBrandingName(response.team.name || "");
      setBrandingLogoPreview(response.team.logo || "");
      setBrandingLogoFile(null);
      setMembers(nextMembers);
      setSelectedTeamId(teamId);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (brandingLogoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(brandingLogoPreview);
      }
    };
  }, [brandingLogoPreview]);

  useEffect(() => {
    if (!(user?.role === "staff" && user.playerType === "team")) {
      return;
    }

    loadTeams()
      .then((nextTeams) => {
        if (!nextTeams.length) {
          setSelectedTeamId(null);
          setSelectedTeamMeta(null);
          setMembers([]);
          return;
        }

        const preferredTeamId =
          (user.teamId && nextTeams.some((team) => team.id === user.teamId) ? user.teamId : null) ||
          nextTeams[0].id;

        if (preferredTeamId) {
          loadMembers(preferredTeamId).catch((error) => {
            console.error("Не удалось загрузить состав команды:", error);
          });
        }
      })
      .catch((error) => {
        console.error("Не удалось загрузить команды:", error);
      });
  }, [loadMembers, loadTeams, user]);

  if (!(user?.role === "staff" && user.playerType === "team")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Команда</CardTitle>
          <CardDescription>Создание команды доступно только staff-профилю с типом аккаунта team.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teamName.trim()) {
      return;
    }

    if (hasExistingTeam) {
      return;
    }

    setLoading(true);
    setBusyAction("create-team");
    try {
      const response = await apiClient.post<{
        team: TeamSummary;
        inviteCodes: { player: string; staff: string };
      }>("/teams", { name: teamName.trim() });
      setPlayerCode(response.inviteCodes.player);
      setStaffCode(response.inviteCodes.staff);
      setTeamName("");
      await loadTeams();
      await loadMembers(response.team.id);
      await refreshUser();
    } catch (error) {
      console.error("Не удалось создать команду:", error);
    } finally {
      setBusyAction(null);
      setLoading(false);
    }
  };

  const updateBranding = async () => {
    if (!selectedTeamId) {
      return;
    }

    const formData = new FormData();
    if (brandingName.trim()) {
      formData.append("name", brandingName.trim());
    }
    if (brandingLogoFile) {
      formData.append("logo", brandingLogoFile);
    }

    setLoading(true);
    setBusyAction("update-branding");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/teams/${selectedTeamId}/branding`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Не удалось обновить брендинг команды");
      }

      setBrandingLogoFile(null);
      setBrandingLogoPreview(payload.team?.logo || "");
      await loadTeams();
      await loadMembers(selectedTeamId);
      await refreshUser();
    } catch (error) {
      console.error("Не удалось обновить брендинг команды:", error);
    } finally {
      setBusyAction(null);
      setLoading(false);
    }
  };

  const regenerateCode = async (teamId: string, type: "player" | "staff") => {
    setLoading(true);
    setBusyAction(type === "player" ? "regenerate-player" : "regenerate-staff");
    try {
      const response = await apiClient.post<{ playerCode?: string; staffCode?: string }>(
        `/teams/${teamId}/regenerate-${type}-code`
      );
      if (type === "player") {
        setPlayerCode(response.playerCode || "");
      } else {
        setStaffCode(response.staffCode || "");
      }
      await loadTeams();
    } finally {
      setBusyAction(null);
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async (value: string, label: string) => {
    if (!value.trim()) {
      toast.error(`Пока нет ${label.toLowerCase()}`);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Копирование недоступно в этом браузере");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} скопирован`);
    } catch (error) {
      console.error(`Не удалось скопировать ${label.toLowerCase()}:`, error);
      toast.error("Не удалось скопировать код");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Моя команда и коды приглашения</CardTitle>
          <CardDescription>
            Здесь вы создаете свою команду, задаете название и получаете коды для игроков и staff. В команде может быть максимум {selectedTeamMeta?.playerLimit || selectedTeam?.playerLimit || 7} игроков.
          </CardDescription>
          {currentTeamName && (
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100">
              {currentTeamLogo ? (
                <img src={currentTeamLogoUrl} alt={currentTeamName} className="h-8 w-8 rounded-full object-cover" />
              ) : null}
              <span>Команда: {currentTeamName}</span>
            </div>
          )}
        </CardHeader>
        <form onSubmit={handleCreateTeam} className="space-y-0">
          <CardContent className="space-y-6">
            {hasExistingTeam && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-50">
                <Shield className="h-4 w-4 text-amber-300" />
                <AlertTitle className="text-amber-100">Команда уже привязана</AlertTitle>
                <AlertDescription className="text-amber-100/85">
                  Для этого профиля уже создана или назначена команда. Ниже можно управлять только текущей командой, её кодами приглашения и брендингом.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Название команды</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="Например, ATLANT Main"
                    disabled={loading || hasExistingTeam}
                    aria-describedby="team-name-hint"
                  />
                  <p id="team-name-hint" className="text-sm text-muted-foreground">
                    Название увидят игроки и staff при привязке кода. Его можно будет обновить позже в блоке брендинга.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button type="submit" disabled={loading || hasExistingTeam} className="sm:min-w-[220px]">
                    {busyAction === "create-team" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Создаем команду...
                      </>
                    ) : hasExistingTeam ? (
                      "Команда уже привязана"
                    ) : (
                      "Создать команду"
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    После создания коды появятся ниже. Их можно будет обновлять отдельно для игроков и staff.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                <p className="text-sm font-semibold">Что будет дальше</p>
                <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      1
                    </div>
                    <p>Создайте команду или выберите уже привязанную.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      2
                    </div>
                    <p>Используйте отдельные коды для приглашения игроков и staff.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      3
                    </div>
                    <p>Настройте название, логотип и проверьте текущий состав команды справа.</p>
                  </div>
                </div>
              </div>
            </div>

            {(playerCode || staffCode) ? (
              <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
                <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Код для игроков</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Используйте этот код для подключения игроков к текущей команде.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCopyInviteCode(playerCode, "Код для игроков")}
                      disabled={!playerCode}
                    >
                      <Copy className="h-4 w-4" />
                      Копировать
                    </Button>
                  </div>
                  <p className="mt-4 break-all rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 font-mono text-lg font-semibold tracking-[0.18em]">
                    {playerCode || "Сгенерируйте код"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Код для staff</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Этот код нужен сотрудникам, которым нужен доступ к разделам команды.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCopyInviteCode(staffCode, "Код для staff")}
                      disabled={!staffCode}
                    >
                      <Copy className="h-4 w-4" />
                      Копировать
                    </Button>
                  </div>
                  <p className="mt-4 break-all rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-3 font-mono text-lg font-semibold tracking-[0.18em]">
                    {staffCode || "Сгенерируйте код"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                Коды приглашения появятся здесь сразу после создания команды или после ручного обновления через кнопки в списке команд.
              </div>
            )}
          </CardContent>
        </form>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Моя команда</CardTitle>
            <CardDescription>Выберите команду, чтобы открыть состав справа, обновить инвайт-коды и быстро проверить лимиты.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Команд пока нет</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Сначала создайте команду выше, после этого здесь появится карточка состава и инструменты управления.
                </p>
              </div>
            )}
            {teams.map((team) => (
              <div
                key={team.id}
                className={cn(
                  "rounded-2xl border p-5 transition-colors",
                  team.id === selectedTeamId
                    ? "border-primary/40 bg-primary/5 shadow-[0_12px_30px_rgba(53,144,255,0.08)]"
                    : "border-border/80 bg-background/40 hover:border-primary/25"
                )}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    {team.logo ? (
                      <img
                        src={getImageUrl(team.logo) || team.logo}
                        alt={team.name}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{team.name}</p>
                        {team.id === selectedTeamId && <Badge>Открыта</Badge>}
                        {team.isCreator && <Badge variant="secondary">Создатель</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Игроки: {team.playerCount}/{team.playerLimit} • staff: {team.staffCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={team.id === selectedTeamId ? "secondary" : "outline"}
                      onClick={() => loadMembers(team.id)}
                      disabled={membersLoading && team.id === selectedTeamId}
                      className="h-auto justify-start whitespace-normal py-3 text-left leading-snug"
                    >
                      {membersLoading && team.id === selectedTeamId ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Загружаем...
                        </>
                      ) : team.id === selectedTeamId ? (
                        "Открыто"
                      ) : (
                        "Показать состав"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => regenerateCode(team.id, "player")}
                      disabled={loading}
                      className="h-auto justify-start whitespace-normal py-3 text-left leading-snug"
                    >
                      {busyAction === "regenerate-player" ? (
                        <>
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                          Обновляем код игроков...
                        </>
                      ) : (
                        "Новый player-код"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => regenerateCode(team.id, "staff")}
                      disabled={loading}
                      className="h-auto justify-start whitespace-normal py-3 text-left leading-snug"
                    >
                      {busyAction === "regenerate-staff" ? (
                        <>
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                          Обновляем код staff...
                        </>
                      ) : (
                        "Новый staff-код"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedTeamMeta?.isCreator ? "Брендинг и состав команды" : "Состав команды"}</CardTitle>
            <CardDescription>
              {selectedTeamId
                ? selectedTeamMeta?.isCreator
                  ? "Вы создали эту команду и можете менять её название и логотип."
                  : "Участники выбранной команды. Название и логотип доступны только для просмотра."
                : "Выберите команду слева."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedTeamId && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Выберите команду слева</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  После выбора здесь откроются брендинг, текущий состав и связанные действия для выбранной команды.
                </p>
              </div>
            )}
            {selectedTeamMeta && (
              <div className="space-y-5 rounded-2xl border border-border/80 bg-background/60 p-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {brandingLogoPreview ? (
                      <img
                        src={brandingLogoPreviewUrl}
                        alt={brandingName || currentTeamName}
                        className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-[0_16px_36px_rgba(24,92,214,0.18)]"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
                        Лого
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
                        Брендинг команды
                      </p>
                      <p className="mt-2 text-2xl font-semibold leading-tight">{brandingName || selectedTeamMeta.name}</p>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        {selectedTeam?.playerCount || 0}/{selectedTeam?.playerLimit || selectedTeamMeta.playerLimit} игроков • {selectedTeam?.staffCount || 0} staff
                      </p>
                    </div>
                  </div>
                  <Badge variant={selectedTeamMeta.isCreator ? "default" : "outline"} className="w-fit">
                    {selectedTeamMeta.isCreator ? "Можно редактировать" : "Только просмотр"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branding-name">Название команды</Label>
                  <Input
                    id="branding-name"
                    value={brandingName}
                    onChange={(event) => setBrandingName(event.target.value)}
                    disabled={!selectedTeamMeta.isCreator || loading}
                    aria-describedby="branding-name-hint"
                  />
                  <p id="branding-name-hint" className="text-sm text-muted-foreground">
                    Обновлённое название увидят участники команды и пользователи при привязке профиля.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branding-logo">Логотип команды</Label>
                  <Input
                    id="branding-logo"
                    type="file"
                    accept="image/*"
                    disabled={!selectedTeamMeta.isCreator || loading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setBrandingLogoFile(file);
                      if (brandingLogoPreview.startsWith("blob:")) {
                        URL.revokeObjectURL(brandingLogoPreview);
                      }
                      setBrandingLogoPreview(file ? URL.createObjectURL(file) : (selectedTeamMeta.logo || ""));
                    }}
                  />
                  <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span>{brandingLogoFile ? `Выбран файл: ${brandingLogoFile.name}` : "Подходит PNG, JPG и другие изображения."}</span>
                    {selectedTeamMeta.isCreator && !brandingLogoFile && (
                      <span className="inline-flex items-center gap-1">
                        <ImagePlus className="h-4 w-4" />
                        Можно оставить текущий логотип без изменений.
                      </span>
                    )}
                  </div>
                </div>
                {selectedTeamMeta.isCreator ? (
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={updateBranding}
                      disabled={loading || !isBrandingDirty}
                      className="w-full justify-center sm:w-auto"
                    >
                      {busyAction === "update-branding" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Сохраняем брендинг...
                        </>
                      ) : (
                        "Сохранить брендинг"
                      )}
                    </Button>
                    {!isBrandingDirty && (
                      <p className="text-sm text-muted-foreground">
                        Измените название или логотип, чтобы кнопка сохранения стала активной.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Название и логотип может менять только создатель команды.
                  </p>
                )}
              </div>
            )}
            {membersLoading && (
              <div className="rounded-2xl border border-border/80 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <p className="mt-3">Загружаем состав команды...</p>
              </div>
            )}
            {!membersLoading && members.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                Состав пока не загружен или в команде ещё нет участников.
              </div>
            )}
            {!membersLoading && members.length > 0 && (
              <div className="space-y-3">
                {members.map((member) => {
                  const memberPlayerType = getPlayerTypeLabel(member);

                  return (
                    <div
                      key={member.id || member.email}
                      className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getMemberInitials(member)}
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={member.role === "staff" ? "default" : "secondary"}>
                          {getRoleLabel(member)}
                        </Badge>
                        {memberPlayerType && <Badge variant="outline">{memberPlayerType}</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamManagement;
