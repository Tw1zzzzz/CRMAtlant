import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GameStatsForm from '@/components/forms/GameStatsForm';

interface GameStatsFormData {
  date: string;
  kills: number;
  deaths: number;
  assists: number;
  adr?: number | null;
  kpr?: number | null;
  deathPerRound?: number | null;
  avgKr?: number | null;
  avgKd?: number | null;
  kast?: number | null;
  firstKills?: number | null;
  firstDeaths?: number | null;
  openingDuelDiff?: number | null;
  udr?: number | null;
  avgMultikills?: number | null;
  clutchesWon?: number | null;
  avgFlashTime?: number | null;
  ctSide: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    totalRounds: number;
    roundsWon: number;
    roundsLost: number;
    pistolRounds: number;
    pistolRoundsWon: number;
  };
  tSide: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    totalRounds: number;
    roundsWon: number;
    roundsLost: number;
    pistolRounds: number;
    pistolRoundsWon: number;
  };
  userId?: string;
}

interface GameStatsUser {
  _id?: string;
  name?: string;
  email?: string;
}

interface GameStatsEntry {
  _id: string;
  date: string;
  userId?: string | GameStatsUser;
  kills: number;
  deaths: number;
  assists: number;
  adr?: number | null;
  kpr?: number | null;
  deathPerRound?: number | null;
  avgKr?: number | null;
  avgKd?: number | null;
  kast?: number | null;
  firstKills?: number | null;
  firstDeaths?: number | null;
  openingDuelDiff?: number | null;
  udr?: number | null;
  avgMultikills?: number | null;
  clutchesWon?: number | null;
  avgFlashTime?: number | null;
  kdRatio: number;
  winRate: number;
  totalRounds: number;
  roundsWon: number;
  roundsLost: number;
  roundWinRate: number;
  ctSide?: {
    winRate?: number;
  };
  tSide?: {
    winRate?: number;
  };
}

type TemplateMetric = {
  label: string;
  summary: string;
  values: string[];
};

type TemplateColumn = {
  label: string;
  meta: string;
};

const PLACEHOLDER_VALUE = '—';

const templateLabels: string[] = [
  'Total kills',
  'Total deaths',
  'K/D Ratio',
  'Rounds played',
  'ADR (Damage/Round)',
  'KPR (Kills/round)',
  'Death/round',
  'AVG KR',
  'AVG KD',
  'KAST',
  'First kills',
  'First deaths',
  'Разница опен дуэлей',
  'UDR',
  'Ср. мультикиллы',
  'Выигранные клатчи',
  'Ср. время ослепления',
  'Win-Rate',
  'Round Win-Rate',
  'CT Win-Rate',
  'T Win-Rate'
];

const formatNumber = (value: number, decimals = 2) => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
};

const formatPercent = (value: number, decimals = 1) => `${formatNumber(value, decimals)}%`;
const formatNullable = (value: number | null, decimals = 2) => (value === null ? '–' : formatNumber(value, decimals));
const formatNullablePercent = (value: number | null, decimals = 1) => (value === null ? '–' : formatPercent(value, decimals));

const safeDivide = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
};

const buildPlaceholderRows = (columnsCount: number): TemplateMetric[] => {
  return templateLabels.map((label) => ({
    label,
    summary: PLACEHOLDER_VALUE,
    values: Array.from({ length: columnsCount }, () => PLACEHOLDER_VALUE)
  }));
};

const buildSampleDates = (dateFrom: string, dateTo: string): Date[] => {
  const now = new Date();
  if (!dateFrom || !dateTo) {
    return [
      now,
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
      new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    ];
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [now, new Date(now.getTime() + 24 * 60 * 60 * 1000), new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)];
  }

  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const unique = new Map<string, Date>();
  [start, mid, end].forEach((date) => {
    const key = date.toISOString().split('T')[0];
    unique.set(key, date);
  });

  return Array.from(unique.values()).slice(0, 3);
};

const buildPlaceholderColumns = (dateFrom: string, dateTo: string, mode: 'team' | 'individual'): TemplateColumn[] => {
  const sampleDates = buildSampleDates(dateFrom, dateTo);
  return sampleDates.map((date, index) => {
    const dateLabel = date.toLocaleDateString('ru-RU');
    const meta = mode === 'team' ? `Пример игрока • ${dateLabel}` : dateLabel;
    return {
      label: `№${index + 1}`,
      meta
    };
  });
};

const GameStatsPage: React.FC = () => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [gameStatsMode, setGameStatsMode] = useState<'team' | 'individual'>('team');
  const [gameStatsPlayerId, setGameStatsPlayerId] = useState('');
  const [gameStatsRows, setGameStatsRows] = useState<TemplateMetric[]>([]);
  const [gameStatsColumns, setGameStatsColumns] = useState<string[]>([]);
  const [gameStatsLoading, setGameStatsLoading] = useState(false);
  const [gameStatsDateFrom, setGameStatsDateFrom] = useState('');
  const [gameStatsDateTo, setGameStatsDateTo] = useState('');

  const isStaff = user?.role === 'staff';

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setGameStatsDateTo(today.toISOString().split('T')[0]);
    setGameStatsDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isStaff) {
      setGameStatsMode('individual');
      if (user.id) {
        setGameStatsPlayerId(user.id);
      }
      return;
    }

    const fetchPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await fetch('/api/users/players', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const playersData = await response.json();
          setPlayers(playersData || []);
        } else {
          console.error('Ошибка загрузки игроков:', response.statusText);
        }
      } catch (error) {
        console.error('Ошибка загрузки игроков:', error);
        toast.error('Ошибка при загрузке списка игроков');
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, [isStaff, user]);

  const normalizeGameStatsEntries = (entries: GameStatsEntry[]) => {
    return entries.map((entry, index) => {
      const userName =
        typeof entry.userId === 'object' && entry.userId !== null
          ? entry.userId.name || 'Игрок'
          : 'Игрок';
      const dateLabel = new Date(entry.date).toLocaleDateString('ru-RU');
      return {
        ...entry,
        columnLabel: `№${index + 1}`,
        columnMeta: gameStatsMode === 'team' ? `${userName} • ${dateLabel}` : dateLabel
      };
    });
  };

  const buildTemplateRows = (entries: ReturnType<typeof normalizeGameStatsEntries>): TemplateMetric[] => {
    const totalKills = entries.reduce((sum, e) => sum + (e.kills || 0), 0);
    const totalDeaths = entries.reduce((sum, e) => sum + (e.deaths || 0), 0);
    const totalRounds = entries.reduce((sum, e) => sum + (e.totalRounds || 0), 0);

    const averageNullable = (values: Array<number | null | undefined>): number | null => {
      const filtered = values.filter((value): value is number => Number.isFinite(value as number));
      if (!filtered.length) return null;
      return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
    };

    const avgKD = entries.length
      ? entries.reduce((sum, e) => sum + (e.kdRatio || 0), 0) / entries.length
      : 0;
    const avgWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.winRate || 0), 0) / entries.length
      : 0;
    const avgRoundWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.roundWinRate || 0), 0) / entries.length
      : 0;
    const avgCTWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.ctSide?.winRate || 0), 0) / entries.length
      : 0;
    const avgTWinRate = entries.length
      ? entries.reduce((sum, e) => sum + (e.tSide?.winRate || 0), 0) / entries.length
      : 0;

    const avgAdr = averageNullable(entries.map((e) => e.adr));
    const avgKpr = averageNullable(entries.map((e) => e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0)));
    const avgDeathPerRound = averageNullable(entries.map((e) => e.deathPerRound ?? safeDivide(e.deaths || 0, e.totalRounds || 0)));
    const avgAvgKr = averageNullable(entries.map((e) => e.avgKr ?? e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0)));
    const avgAvgKd = averageNullable(entries.map((e) => e.avgKd ?? e.kdRatio));
    const avgKast = averageNullable(entries.map((e) => e.kast));
    const avgFirstKills = averageNullable(entries.map((e) => e.firstKills));
    const avgFirstDeaths = averageNullable(entries.map((e) => e.firstDeaths));
    const avgOpeningDuelDiff = averageNullable(
      entries.map((e) => e.openingDuelDiff ?? ((e.firstKills != null && e.firstDeaths != null) ? e.firstKills - e.firstDeaths : null))
    );
    const avgUdr = averageNullable(entries.map((e) => e.udr));
    const avgMultikills = averageNullable(entries.map((e) => e.avgMultikills));
    const avgClutchesWon = averageNullable(entries.map((e) => e.clutchesWon));
    const avgFlashTime = averageNullable(entries.map((e) => e.avgFlashTime));

    return [
      {
        label: 'Total kills',
        summary: formatNumber(totalKills, 0),
        values: entries.map((e) => formatNumber(e.kills || 0, 0))
      },
      {
        label: 'Total deaths',
        summary: formatNumber(totalDeaths, 0),
        values: entries.map((e) => formatNumber(e.deaths || 0, 0))
      },
      {
        label: 'K/D Ratio',
        summary: formatNullable(safeDivide(totalKills, totalDeaths), 2),
        values: entries.map((e) => formatNullable(e.kdRatio ?? safeDivide(e.kills || 0, e.deaths || 0), 2))
      },
      {
        label: 'Rounds played',
        summary: formatNumber(totalRounds, 0),
        values: entries.map((e) => formatNumber(e.totalRounds || 0, 0))
      },
      {
        label: 'ADR (Damage/Round)',
        summary: formatNullable(avgAdr, 1),
        values: entries.map((e) => formatNullable(e.adr ?? null, 1))
      },
      {
        label: 'KPR (Kills/round)',
        summary: formatNullable(avgKpr, 2),
        values: entries.map((e) => formatNullable(e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'Death/round',
        summary: formatNullable(avgDeathPerRound, 2),
        values: entries.map((e) => formatNullable(e.deathPerRound ?? safeDivide(e.deaths || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'AVG KR',
        summary: formatNullable(avgAvgKr, 2),
        values: entries.map((e) => formatNullable(e.avgKr ?? e.kpr ?? safeDivide(e.kills || 0, e.totalRounds || 0), 2))
      },
      {
        label: 'AVG KD',
        summary: formatNullable(avgAvgKd ?? avgKD, 2),
        values: entries.map((e) => formatNullable(e.avgKd ?? e.kdRatio, 2))
      },
      {
        label: 'KAST',
        summary: formatNullablePercent(avgKast, 1),
        values: entries.map((e) => formatNullablePercent(e.kast ?? null, 1))
      },
      {
        label: 'First kills',
        summary: formatNullable(avgFirstKills, 2),
        values: entries.map((e) => formatNullable(e.firstKills ?? null, 2))
      },
      {
        label: 'First deaths',
        summary: formatNullable(avgFirstDeaths, 2),
        values: entries.map((e) => formatNullable(e.firstDeaths ?? null, 2))
      },
      {
        label: 'Разница опен дуэлей',
        summary: formatNullable(avgOpeningDuelDiff, 2),
        values: entries.map((e) =>
          formatNullable(
            e.openingDuelDiff ?? ((e.firstKills != null && e.firstDeaths != null) ? e.firstKills - e.firstDeaths : null),
            2
          )
        )
      },
      {
        label: 'UDR',
        summary: formatNullable(avgUdr, 2),
        values: entries.map((e) => formatNullable(e.udr ?? null, 2))
      },
      {
        label: 'Ср. мультикиллы',
        summary: formatNullable(avgMultikills, 2),
        values: entries.map((e) => formatNullable(e.avgMultikills ?? null, 2))
      },
      {
        label: 'Выигранные клатчи',
        summary: formatNullable(avgClutchesWon, 2),
        values: entries.map((e) => formatNullable(e.clutchesWon ?? null, 2))
      },
      {
        label: 'Ср. время ослепления',
        summary: formatNullable(avgFlashTime, 2),
        values: entries.map((e) => formatNullable(e.avgFlashTime ?? null, 2))
      },
      {
        label: 'Win-Rate',
        summary: formatPercent(avgWinRate, 1),
        values: entries.map((e) => formatPercent(e.winRate || 0, 1))
      },
      {
        label: 'Round Win-Rate',
        summary: formatPercent(avgRoundWinRate, 1),
        values: entries.map((e) => formatPercent(e.roundWinRate || 0, 1))
      },
      {
        label: 'CT Win-Rate',
        summary: formatPercent(avgCTWinRate, 1),
        values: entries.map((e) => formatPercent(e.ctSide?.winRate || 0, 1))
      },
      {
        label: 'T Win-Rate',
        summary: formatPercent(avgTWinRate, 1),
        values: entries.map((e) => formatPercent(e.tSide?.winRate || 0, 1))
      }
    ];
  };

  const fetchGameStatsTemplate = async () => {
    if (!gameStatsDateFrom || !gameStatsDateTo) {
      toast.error('Выберите период для таблицы игровых показателей');
      return;
    }

    if (gameStatsMode === 'individual' && isStaff && !gameStatsPlayerId) {
      toast.error('Выберите игрока для индивидуальной таблицы');
      return;
    }

    setGameStatsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: gameStatsDateFrom,
        endDate: gameStatsDateTo,
        mode: gameStatsMode,
        limit: '200',
        page: '1'
      });

      if (gameStatsMode === 'individual' && gameStatsPlayerId && isStaff) {
        params.set('playerId', gameStatsPlayerId);
      }

      const response = await fetch(`/api/game-stats?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки таблицы (${response.status})`);
      }

      const result = await response.json();
      const entries = normalizeGameStatsEntries((result.data || []) as GameStatsEntry[]);

      if (entries.length === 0) {
        const placeholderColumns = buildPlaceholderColumns(gameStatsDateFrom, gameStatsDateTo, gameStatsMode);
        setGameStatsColumns(placeholderColumns.map((column) => `${column.label}\n${column.meta}`));
        setGameStatsRows(buildPlaceholderRows(placeholderColumns.length));
        toast.success('Показан шаблон таблицы для заполнения');
        return;
      }

      setGameStatsColumns(entries.map((entry) => `${entry.columnLabel}\n${entry.columnMeta}`));
      setGameStatsRows(buildTemplateRows(entries));

      const targetLabel =
        gameStatsMode === 'team'
          ? 'команды'
          : players.find((p) => p._id === gameStatsPlayerId)?.name || 'игрока';
      toast.success(`Таблица игровых показателей для ${targetLabel} обновлена`);
    } catch (error: any) {
      console.error('[GameStatsPage] Ошибка загрузки таблицы игровых показателей:', error);
      toast.error(error?.message || 'Не удалось загрузить таблицу игровых показателей');
      setGameStatsColumns([]);
      setGameStatsRows([]);
    } finally {
      setGameStatsLoading(false);
    }
  };

  const handleGameStatsSubmit = async (data: GameStatsFormData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/game-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при сохранении данных');
      }

      await response.json();
      toast.success('Игровые показатели успешно сохранены');

      await fetchGameStatsTemplate();
    } catch (error: any) {
      console.error('[GameStatsPage] Ошибка сохранения игровых показателей:', error);
      throw error;
    }
  };

  const showPlayerSelect = isStaff;
  const allowTeamMode = isStaff;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="overflow-hidden border-2 border-[#204f14]">
        <CardHeader className="bg-[#204f14] text-[#e8f4df]">
          <CardTitle>Игровые показатели</CardTitle>
          <CardDescription className="text-[#cfe6bf]">
            Рабочая таблица аналитика: вводите данные игрока ниже и сразу обновляйте общую витрину метрик.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 bg-[#eef5e8] p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-2">
              <Label>Режим</Label>
              <Select
                value={gameStatsMode}
                onValueChange={(value: 'team' | 'individual') => setGameStatsMode(value)}
                disabled={!allowTeamMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Один игрок</SelectItem>
                  {allowTeamMode && <SelectItem value="team">Команда</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Игрок</Label>
              <Select
                value={gameStatsPlayerId}
                onValueChange={setGameStatsPlayerId}
                disabled={!showPlayerSelect || gameStatsMode !== 'individual' || loadingPlayers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={gameStatsMode === 'individual' ? 'Выберите игрока' : 'Только для режима игрока'} />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player._id} value={player._id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>С даты</Label>
              <Input type="date" value={gameStatsDateFrom} onChange={(e) => setGameStatsDateFrom(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>По дату</Label>
              <Input type="date" value={gameStatsDateTo} onChange={(e) => setGameStatsDateTo(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Действие</Label>
              <Button className="w-full" onClick={fetchGameStatsTemplate} disabled={gameStatsLoading}>
                {gameStatsLoading ? 'Загрузка...' : 'Обновить таблицу'}
              </Button>
            </div>
          </div>

          <div className="overflow-auto border border-[#204f14] rounded-md bg-[#dbe8d4]">
            <table className="min-w-[980px] w-full border-collapse text-[#234b1a]">
              <thead>
                <tr className="bg-[#204f14] text-[#e8f4df]">
                  <th className="sticky left-0 z-20 min-w-[260px] border border-[#15360d] px-3 py-2 text-left text-xl font-semibold">
                    Показатели
                  </th>
                  <th className="sticky left-[260px] z-20 min-w-[170px] border border-[#15360d] px-3 py-2 text-left text-xl font-semibold">
                    Данные
                  </th>
                  {gameStatsColumns.map((column, index) => {
                    const [main, meta] = column.split('\n');
                    return (
                      <th key={index} className="min-w-[140px] border border-[#15360d] px-2 py-2 text-center font-semibold">
                        <div>{main}</div>
                        <div className="text-xs font-normal text-[#b8d7a6]">{meta}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {gameStatsRows.length === 0 && !gameStatsLoading && (
                  <tr>
                    <td colSpan={Math.max(2 + gameStatsColumns.length, 3)} className="px-4 py-8 text-center text-sm text-[#3a5e32]">
                      Нажмите "Обновить таблицу", чтобы загрузить игровые показатели.
                    </td>
                  </tr>
                )}
                {gameStatsRows.map((row, rowIndex) => (
                  <tr key={row.label} className={rowIndex % 2 === 0 ? 'bg-[#dbe8d4]' : 'bg-[#cfe0c8]'}>
                    <td className="sticky left-0 z-10 border border-[#6d8a62] bg-[#204f14] px-3 py-2 text-lg font-semibold text-[#e8f4df]">
                      {row.label}
                    </td>
                    <td className="sticky left-[260px] z-10 border border-[#6d8a62] bg-[#c4d6bd] px-3 py-2 text-lg font-bold">
                      {row.summary}
                    </td>
                    {row.values.map((value, valueIndex) => (
                      <td key={`${row.label}-${valueIndex}`} className="border border-[#6d8a62] px-3 py-2 text-center text-lg">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <GameStatsForm
          onSubmit={handleGameStatsSubmit}
          analysisMode={gameStatsMode}
          onAnalysisModeChange={setGameStatsMode}
          players={players}
          selectedPlayerId={gameStatsPlayerId}
          onSelectedPlayerChange={setGameStatsPlayerId}
          loadingPlayers={loadingPlayers}
          allowTeamMode={allowTeamMode}
          showPlayerSelect={showPlayerSelect}
        />
      </div>
    </div>
  );
};

export default GameStatsPage;
