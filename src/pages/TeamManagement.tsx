import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/utils/api/api-client";
import { TeamSummary, User } from "@/types";

type TeamListResponse = {
  teams: TeamSummary[];
};

type TeamMembersResponse = {
  team: {
    id: string;
    name: string;
    playerLimit: number;
  };
  members: User[];
};

const normalizeTeamId = (team: TeamSummary & { _id?: string }, index: number): string => {
  return team.id || team._id || `${team.name || "team"}-${index}`;
};

const normalizeMemberId = (member: User & { _id?: string }, index: number): string => {
  return member.id || member._id || member.email || `${member.name || "member"}-${index}`;
};

const TeamManagement: React.FC = () => {
  const { refreshUser, user } = useAuth();
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [playerCode, setPlayerCode] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const hasExistingTeam = teams.length > 0 || Boolean(user?.teamId);
  const currentTeamName =
    user?.teamName?.trim() ||
    teams.find((team) => team.id === selectedTeamId)?.name ||
    teams[0]?.name ||
    "";

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
      setMembers(nextMembers);
      setSelectedTeamId(teamId);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!(user?.role === "staff" && user.playerType === "team")) {
      return;
    }

    loadTeams()
      .then((nextTeams) => {
        if (!nextTeams.length) {
          setSelectedTeamId(null);
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
      setLoading(false);
    }
  };

  const regenerateCode = async (teamId: string, type: "player" | "staff") => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Моя команда и коды приглашения</CardTitle>
          <CardDescription>
            Здесь вы создаете свою команду, задаете название и получаете коды для игроков и staff. В команде может быть максимум 7 игроков.
          </CardDescription>
          {currentTeamName && (
            <div className="inline-flex w-fit items-center rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-100">
              Команда: {currentTeamName}
            </div>
          )}
        </CardHeader>
        <form onSubmit={handleCreateTeam}>
          <CardContent className="space-y-4">
            {hasExistingTeam && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Для этого профиля уже создана или назначена команда. Ниже можно управлять только текущей командой и её кодами приглашения.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="team-name">Название команды</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Например, ATLANT Main"
                disabled={loading || hasExistingTeam}
              />
            </div>
            {(playerCode || staffCode) && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Код для игроков</p>
                  <p className="mt-1 break-all text-lg font-semibold">{playerCode || "Сгенерируйте код"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Код для staff</p>
                  <p className="mt-1 break-all text-lg font-semibold">{staffCode || "Сгенерируйте код"}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading || hasExistingTeam}>
              {loading ? "Создаем..." : hasExistingTeam ? "Команда уже привязана" : "Создать команду"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Моя команда</CardTitle>
            <CardDescription>После создания команды здесь можно посмотреть состав и обновить коды.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.length === 0 && <p className="text-sm text-muted-foreground">Команд пока нет.</p>}
            {teams.map((team) => (
              <div key={team.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Игроки: {team.playerCount}/{team.playerLimit} • staff: {team.staffCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => loadMembers(team.id)} disabled={membersLoading}>
                      Состав
                    </Button>
                    <Button variant="outline" onClick={() => regenerateCode(team.id, "player")} disabled={loading}>
                      Новый player-код
                    </Button>
                    <Button variant="outline" onClick={() => regenerateCode(team.id, "staff")} disabled={loading}>
                      Новый staff-код
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Состав команды</CardTitle>
            <CardDescription>
              {selectedTeamId ? "Участники выбранной команды." : "Выберите команду слева."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {membersLoading && <p className="text-sm text-muted-foreground">Загружаем состав...</p>}
            {!membersLoading && members.length === 0 && (
              <p className="text-sm text-muted-foreground">Состав пока не загружен.</p>
            )}
            {members.map((member) => (
              <div key={member.id || member.email} className="rounded-lg border p-3">
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">
                  {member.email} • {member.role} {member.playerType ? `• ${member.playerType}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamManagement;
