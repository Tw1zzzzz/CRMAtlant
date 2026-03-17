import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GameStatsForm from '@/components/forms/GameStatsForm';
import { Sparkles, LayoutGrid, Table2 } from 'lucide-react';
import { COLORS } from '@/styles/theme';

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
  const shellCardStyle = {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.borderColor,
    boxShadow: '0 1px 20px 0 rgba(0,0,0,.1)'
  };
  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: COLORS.textColor,
    borderColor: 'rgba(255,255,255,0.08)'
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <section
        className="overflow-hidden rounded-[32px] border px-5 py-6 md:px-7"
        style={{
          background: 'linear-gradient(135deg, rgba(53, 144, 255, 0.18), rgba(0, 227, 150, 0.08) 48%, rgba(17, 24, 39, 0.96))',
          borderColor: 'rgba(96, 165, 250, 0.3)',
          boxShadow: '0 36px 100px -68px rgba(53, 144, 255, 0.9)'
        }}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em]"
              style={{
                backgroundColor: 'rgba(11, 16, 32, 0.4)',
                border: '1px solid rgba(125, 211, 252, 0.22)',
                color: '#B6F0FF'
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Performance Metrics
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold md:text-4xl" style={{ color: COLORS.textColor }}>
                Игровая статистика в более удобной аналитической витрине
              </h1>
              <p className="max-w-2xl text-sm leading-7 md:text-base" style={{ color: 'rgba(226, 232, 240, 0.82)' }}>
                Тот же функционал ввода и та же логика расчётов, но с более понятной структурой: сверху фильтр и таблица для обзора, ниже форма для занесения матчевых показателей.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:min-w-[420px]">
            <div className="rounded-[22px] border p-4" style={{ backgroundColor: 'rgba(9, 14, 26, 0.34)', borderColor: 'rgba(148, 163, 184, 0.18)' }}>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'rgba(191, 219, 254, 0.78)' }}>Режим</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: COLORS.textColor }}>
                {gameStatsMode === 'team' ? 'Команда' : 'Игрок'}
              </div>
            </div>
            <div className="rounded-[22px] border p-4" style={{ backgroundColor: 'rgba(9, 14, 26, 0.34)', borderColor: 'rgba(148, 163, 184, 0.18)' }}>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'rgba(191, 219, 254, 0.78)' }}>Период</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: COLORS.textColor }}>
                {gameStatsDateFrom && gameStatsDateTo ? `${gameStatsDateFrom} - ${gameStatsDateTo}` : 'Не выбран'}
              </div>
            </div>
            <div className="rounded-[22px] border p-4" style={{ backgroundColor: 'rgba(9, 14, 26, 0.34)', borderColor: 'rgba(148, 163, 184, 0.18)' }}>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'rgba(191, 219, 254, 0.78)' }}>Колонки</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: COLORS.textColor }}>{gameStatsColumns.length || 0}</div>
            </div>
            <div className="rounded-[22px] border p-4" style={{ backgroundColor: 'rgba(9, 14, 26, 0.34)', borderColor: 'rgba(148, 163, 184, 0.18)' }}>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'rgba(191, 219, 254, 0.78)' }}>Строки</div>
              <div className="mt-2 text-lg font-semibold" style={{ color: COLORS.textColor }}>{gameStatsRows.length || 0}</div>
            </div>
          </div>
        </div>
      </section>

      <Card style={shellCardStyle}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: COLORS.textColorSecondary }}>
                <Table2 className="h-3.5 w-3.5" />
                Витрина метрик
              </div>
              <CardTitle style={{ color: COLORS.textColor }}>Сводная таблица игровых показателей</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                Интерфейс обновлён только визуально: загрузка, режимы, игроки и шаблон таблицы работают по прежней логике.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div
            className="rounded-[24px] border p-4 md:p-5"
            style={{
              background: 'linear-gradient(160deg, rgba(53, 144, 255, 0.08), rgba(17, 24, 39, 0.96) 68%)',
              borderColor: 'rgba(96, 165, 250, 0.16)'
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label style={{ color: COLORS.textColor }}>Режим</Label>
                <Select
                  value={gameStatsMode}
                  onValueChange={(value: 'team' | 'individual') => setGameStatsMode(value)}
                  disabled={!allowTeamMode}
                >
                  <SelectTrigger style={inputStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, color: COLORS.textColor }}>
                    <SelectItem value="individual">Один игрок</SelectItem>
                    {allowTeamMode && <SelectItem value="team">Команда</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label style={{ color: COLORS.textColor }}>Игрок</Label>
                <Select
                  value={gameStatsPlayerId}
                  onValueChange={setGameStatsPlayerId}
                  disabled={!showPlayerSelect || gameStatsMode !== 'individual' || loadingPlayers}
                >
                  <SelectTrigger style={inputStyle}>
                    <SelectValue placeholder={gameStatsMode === 'individual' ? 'Выберите игрока' : 'Только для режима игрока'} />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, color: COLORS.textColor }}>
                    {players.map((player) => (
                      <SelectItem key={player._id} value={player._id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label style={{ color: COLORS.textColor }}>С даты</Label>
                <Input type="date" value={gameStatsDateFrom} onChange={(e) => setGameStatsDateFrom(e.target.value)} style={inputStyle} />
              </div>

              <div className="space-y-2">
                <Label style={{ color: COLORS.textColor }}>По дату</Label>
                <Input type="date" value={gameStatsDateTo} onChange={(e) => setGameStatsDateTo(e.target.value)} style={inputStyle} />
              </div>

              <div className="space-y-2">
                <Label style={{ color: COLORS.textColor }}>Действие</Label>
                <Button className="h-10 w-full rounded-2xl" onClick={fetchGameStatsTemplate} disabled={gameStatsLoading} style={{ backgroundColor: COLORS.primary, color: 'white' }}>
                  {gameStatsLoading ? 'Загрузка...' : 'Обновить таблицу'}
                </Button>
              </div>
            </div>
          </div>

          <div
            className="flex items-start gap-3 rounded-[20px] border px-4 py-3 text-sm leading-6"
            style={{
              backgroundColor: 'rgba(0, 227, 150, 0.08)',
              borderColor: 'rgba(0, 227, 150, 0.22)',
              color: COLORS.textColorSecondary
            }}
          >
            <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#7EF3D1' }} />
            <span>
              Сначала обновляйте таблицу сверху, затем вводите данные игрока ниже за одну тренировочную сессию или матч: верхняя таблица служит рабочей витриной для уже загруженных показателей.
            </span>
          </div>

          <div
            className="overflow-auto rounded-[24px] border"
            style={{
              borderColor: COLORS.borderColor,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))'
            }}
          >
            <table className="min-w-[980px] w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: 'rgba(17, 24, 39, 0.96)' }}>
                  <th className="sticky left-0 z-20 min-w-[260px] border px-4 py-3 text-left text-base font-semibold" style={{ borderColor: COLORS.borderColor, backgroundColor: 'rgba(15, 23, 42, 0.98)', color: COLORS.textColor }}>
                    Показатели
                  </th>
                  <th className="sticky left-[260px] z-20 min-w-[170px] border px-4 py-3 text-left text-base font-semibold" style={{ borderColor: COLORS.borderColor, backgroundColor: 'rgba(30, 41, 59, 0.98)', color: COLORS.textColor }}>
                    Данные
                  </th>
                  {gameStatsColumns.map((column, index) => {
                    const [main, meta] = column.split('\n');
                    return (
                      <th key={index} className="min-w-[150px] border px-3 py-3 text-center align-top" style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}>
                        <div className="text-sm font-semibold">{main}</div>
                        <div className="mt-1 text-xs font-normal" style={{ color: COLORS.textColorSecondary }}>{meta}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {gameStatsRows.length === 0 && !gameStatsLoading && (
                  <tr>
                    <td
                      colSpan={Math.max(2 + gameStatsColumns.length, 3)}
                      className="px-4 py-10 text-center text-sm"
                      style={{ color: COLORS.textColorSecondary }}
                    >
                      Нажмите "Обновить таблицу", чтобы загрузить игровые показатели.
                    </td>
                  </tr>
                )}
                {gameStatsRows.map((row, rowIndex) => (
                  <tr
                    key={row.label}
                    style={{ backgroundColor: rowIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)' }}
                  >
                    <td className="sticky left-0 z-10 border px-4 py-3 text-sm font-semibold md:text-base" style={{ borderColor: COLORS.borderColor, backgroundColor: 'rgba(15, 23, 42, 0.98)', color: COLORS.textColor }}>
                      {row.label}
                    </td>
                    <td className="sticky left-[260px] z-10 border px-4 py-3 text-base font-bold" style={{ borderColor: COLORS.borderColor, backgroundColor: 'rgba(30, 41, 59, 0.98)', color: '#BFE7FF' }}>
                      {row.summary}
                    </td>
                    {row.values.map((value, valueIndex) => (
                      <td
                        key={`${row.label}-${valueIndex}`}
                        className="border px-3 py-3 text-center text-sm md:text-base"
                        style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}
                      >
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

      <div className="rounded-[28px] border p-1" style={{ borderColor: 'rgba(96, 165, 250, 0.16)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
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
