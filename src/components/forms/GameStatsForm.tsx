import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Save, Users, Trophy, Award, Crosshair, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '../../hooks/use-toast';

interface SideStatsData {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  totalRounds: number;
  roundsWon: number;
  roundsLost: number;
  pistolRounds: number;
  pistolRoundsWon: number;
}

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
  ctSide: SideStatsData;
  tSide: SideStatsData;
  userId?: string;
}

type OptionalMetricField =
  | 'adr'
  | 'kpr'
  | 'deathPerRound'
  | 'avgKr'
  | 'avgKd'
  | 'kast'
  | 'firstKills'
  | 'firstDeaths'
  | 'openingDuelDiff'
  | 'udr'
  | 'avgMultikills'
  | 'clutchesWon'
  | 'avgFlashTime';

interface CalculatedSideStats extends SideStatsData {
  winRate: number;
  roundWinRate: number;
  averageRoundsWon: number;
  averageRoundsLost: number;
  pistolWinRate: number;
}

interface CalculatedStats {
  ctSide: CalculatedSideStats;
  tSide: CalculatedSideStats;
  overall: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    kdRatio: number;
    totalRounds: number;
    roundsWon: number;
    roundsLost: number;
    roundWinRate: number;
    averageRoundsWon: number;
    averageRoundsLost: number;
    totalPistolRounds: number;
    pistolRoundsWon: number;
    pistolWinRate: number;
  };
}

interface Player {
  _id: string;
  name: string;
  email: string;
}

interface GameStatsFormProps {
  onSubmit: (data: GameStatsFormData) => Promise<void>;
  analysisMode: 'team' | 'individual';
  onAnalysisModeChange: (mode: 'team' | 'individual') => void;
  players: Player[];
  selectedPlayerId: string;
  onSelectedPlayerChange: (playerId: string) => void;
  loadingPlayers?: boolean;
  isLoading?: boolean;
  initialData?: Partial<GameStatsFormData>;
}

const defaultSideStats: SideStatsData = {
  totalMatches: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalRounds: 0,
  roundsWon: 0,
  roundsLost: 0,
  pistolRounds: 0,
  pistolRoundsWon: 0
};

const GameStatsForm: React.FC<GameStatsFormProps> = ({
  onSubmit,
  analysisMode,
  onAnalysisModeChange,
  players,
  selectedPlayerId,
  onSelectedPlayerChange,
  loadingPlayers = false,
  isLoading = false,
  initialData = {}
}) => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<GameStatsFormData>({
    date: initialData.date || new Date().toISOString().split('T')[0],
    kills: initialData.kills || 0,
    deaths: initialData.deaths || 0,
    assists: initialData.assists || 0,
    adr: initialData.adr ?? null,
    kpr: initialData.kpr ?? null,
    deathPerRound: initialData.deathPerRound ?? null,
    avgKr: initialData.avgKr ?? null,
    avgKd: initialData.avgKd ?? null,
    kast: initialData.kast ?? null,
    firstKills: initialData.firstKills ?? null,
    firstDeaths: initialData.firstDeaths ?? null,
    openingDuelDiff: initialData.openingDuelDiff ?? null,
    udr: initialData.udr ?? null,
    avgMultikills: initialData.avgMultikills ?? null,
    clutchesWon: initialData.clutchesWon ?? null,
    avgFlashTime: initialData.avgFlashTime ?? null,
    ctSide: initialData.ctSide || { ...defaultSideStats },
    tSide: initialData.tSide || { ...defaultSideStats },
    userId: initialData.userId || ''
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Обработчик изменения режима анализа
  const handleAnalysisModeChange = (mode: 'team' | 'individual') => {
    onAnalysisModeChange(mode);
    
    if (mode === 'team') {
      onSelectedPlayerChange('');
      setFormData(prev => ({ ...prev, userId: '' }));
    }
  };

  // Обработчик выбора игрока
  const handlePlayerSelect = (playerId: string) => {
    onSelectedPlayerChange(playerId);
    setFormData(prev => ({ ...prev, userId: playerId }));
  };

  // Функция для расчета статистики одной стороны
  const calculateSideStats = (sideData: SideStatsData): CalculatedSideStats => {
    const winRate = sideData.totalMatches > 0 
      ? Math.round((sideData.wins / sideData.totalMatches) * 100 * 100) / 100 
      : 0;
    
    const roundWinRate = sideData.totalRounds > 0 
      ? Math.round((sideData.roundsWon / sideData.totalRounds) * 100 * 100) / 100 
      : 0;
    
    const averageRoundsWon = sideData.totalMatches > 0 
      ? Math.round((sideData.roundsWon / sideData.totalMatches) * 100) / 100 
      : 0;
    
    const averageRoundsLost = sideData.totalMatches > 0 
      ? Math.round((sideData.roundsLost / sideData.totalMatches) * 100) / 100 
      : 0;
    
    const pistolWinRate = sideData.pistolRounds > 0 
      ? Math.round((sideData.pistolRoundsWon / sideData.pistolRounds) * 100 * 100) / 100 
      : 0;

    return {
      ...sideData,
      winRate,
      roundWinRate,
      averageRoundsWon,
      averageRoundsLost,
      pistolWinRate
    };
  };

  // Расчет всех показателей
  const calculatedStats: CalculatedStats = React.useMemo(() => {
    const ctCalculated = calculateSideStats(formData.ctSide);
    const tCalculated = calculateSideStats(formData.tSide);

    // Общая статистика
    const totalMatches = ctCalculated.totalMatches + tCalculated.totalMatches;
    const wins = ctCalculated.wins + tCalculated.wins;
    const losses = ctCalculated.losses + tCalculated.losses;
    const draws = ctCalculated.draws + tCalculated.draws;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100 * 100) / 100 : 0;
    
    const kdRatio = formData.deaths > 0 ? Math.round((formData.kills / formData.deaths) * 100) / 100 : formData.kills;
    
    const totalRounds = ctCalculated.totalRounds + tCalculated.totalRounds;
    const roundsWon = ctCalculated.roundsWon + tCalculated.roundsWon;
    const roundsLost = ctCalculated.roundsLost + tCalculated.roundsLost;
    const roundWinRate = totalRounds > 0 ? Math.round((roundsWon / totalRounds) * 100 * 100) / 100 : 0;
    
    const averageRoundsWon = totalMatches > 0 ? Math.round((roundsWon / totalMatches) * 100) / 100 : 0;
    const averageRoundsLost = totalMatches > 0 ? Math.round((roundsLost / totalMatches) * 100) / 100 : 0;
    
    const totalPistolRounds = ctCalculated.pistolRounds + tCalculated.pistolRounds;
    const pistolRoundsWon = ctCalculated.pistolRoundsWon + tCalculated.pistolRoundsWon;
    const pistolWinRate = totalPistolRounds > 0 ? Math.round((pistolRoundsWon / totalPistolRounds) * 100 * 100) / 100 : 0;

    return {
      ctSide: ctCalculated,
      tSide: tCalculated,
      overall: {
        totalMatches,
        wins,
        losses,
        draws,
        winRate,
        kdRatio,
        totalRounds,
        roundsWon,
        roundsLost,
        roundWinRate,
        averageRoundsWon,
        averageRoundsLost,
        totalPistolRounds,
        pistolRoundsWon,
        pistolWinRate
      }
    };
  }, [formData]);

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Проверяем выбор игрока для staff в индивидуальном режиме
    if (analysisMode === 'individual' && !selectedPlayerId) {
      errors.playerSelection = 'Необходимо выбрать игрока для индивидуальной статистики';
    }

    // Валидация даты
    if (!formData.date) {
      errors.date = 'Необходимо указать дату';
    }

    // Валидация CT Side (только если есть данные)
    const { ctSide } = formData;
    if (ctSide.totalMatches > 0) {
      if (ctSide.wins + ctSide.losses + ctSide.draws !== ctSide.totalMatches) {
        errors.ctMatches = 'CT: Сумма побед, поражений и ничьих должна равняться общему количеству матчей';
      }
    }
    if (ctSide.totalRounds > 0) {
      if (ctSide.roundsWon + ctSide.roundsLost !== ctSide.totalRounds) {
        errors.ctRounds = 'CT: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов';
      }
    }
    if (ctSide.pistolRounds > 0 && ctSide.pistolRoundsWon > ctSide.pistolRounds) {
      errors.ctPistol = 'CT: Выигранные пистолетные раунды не могут превышать общее количество';
    }

    // Валидация T Side (только если есть данные)
    const { tSide } = formData;
    if (tSide.totalMatches > 0) {
      if (tSide.wins + tSide.losses + tSide.draws !== tSide.totalMatches) {
        errors.tMatches = 'T: Сумма побед, поражений и ничьих должна равняться общему количеству матчей';
      }
    }
    if (tSide.totalRounds > 0) {
      if (tSide.roundsWon + tSide.roundsLost !== tSide.totalRounds) {
        errors.tRounds = 'T: Сумма выигранных и проигранных раундов должна равняться общему количеству раундов';
      }
    }
    if (tSide.pistolRounds > 0 && tSide.pistolRoundsWon > tSide.pistolRounds) {
      errors.tPistol = 'T: Выигранные пистолетные раунды не могут превышать общее количество';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: number, side?: 'ctSide' | 'tSide') => {
    if (side) {
      setFormData(prev => ({
        ...prev,
        [side]: {
          ...prev[side],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleOptionalMetricChange = (field: OptionalMetricField, rawValue: string) => {
    const normalized = rawValue.replace(',', '.').trim();
    if (!normalized) {
      setFormData(prev => ({ ...prev, [field]: null }));
      return;
    }

    const parsed = Number(normalized);
    setFormData(prev => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? parsed : null
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, исправьте ошибки в форме",
        variant: "destructive"
      });
      return;
    }

    try {
      // Подготавливаем данные для отправки
      const submitData = {
        ...formData,
        userId: analysisMode === 'individual' ? selectedPlayerId : undefined
      };
      
      console.log('Отправляем данные игровых показателей:', submitData);
      
      await onSubmit(submitData);
      
      toast({
        title: "Успешно",
        description: "Игровые показатели сохранены",
      });
      
      // Сбрасываем форму после успешного сохранения
      if (analysisMode === 'individual') {
        onSelectedPlayerChange('');
        setFormData(prev => ({ 
          ...prev, 
          date: new Date().toISOString().split('T')[0],
          kills: 0,
          deaths: 0,
          assists: 0,
          adr: null,
          kpr: null,
          deathPerRound: null,
          avgKr: null,
          avgKd: null,
          kast: null,
          firstKills: null,
          firstDeaths: null,
          openingDuelDiff: null,
          udr: null,
          avgMultikills: null,
          clutchesWon: null,
          avgFlashTime: null,
          ctSide: { ...defaultSideStats },
          tSide: { ...defaultSideStats },
          userId: ''
        }));
      }
    } catch (error: any) {
      console.error('Ошибка сохранения игровых показателей:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить данные",
        variant: "destructive"
      });
    }
  };

  const isFormValid = Object.keys(validationErrors).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Выбор режима и игрока */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Режим анализа
          </CardTitle>
          <CardDescription>
            Выберите режим для ввода игровых показателей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">Режим анализа</Label>
            <Select value={analysisMode} onValueChange={handleAnalysisModeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите режим анализа" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Индивидуальная статистика</SelectItem>
                <SelectItem value="team">Командная статистика</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analysisMode === 'individual' && (
            <div className="space-y-2">
              <Label className="text-base font-medium">Выберите игрока</Label>
              <Select 
                value={selectedPlayerId} 
                onValueChange={handlePlayerSelect}
                disabled={loadingPlayers}
              >
                <SelectTrigger className={validationErrors.playerSelection ? 'border-red-500' : ''}>
                  <SelectValue placeholder={loadingPlayers ? "Загрузка игроков..." : "Выберите игрока"} />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player._id} value={player._id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.playerSelection && (
                <p className="text-red-500 text-sm">{validationErrors.playerSelection}</p>
              )}
              {players.length === 0 && !loadingPlayers && (
                <p className="text-sm text-muted-foreground">
                  Игроки не найдены
                </p>
              )}
            </div>
          )}

          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm">
              {analysisMode === 'individual' ? (
                <>
                  <strong>Индивидуальная статистика:</strong> Данные будут сохранены для выбранного игрока
                </>
              ) : (
                <>
                  <strong>Командная статистика:</strong> Данные будут сохранены как общекомандные показатели
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Основные данные */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Основные данные
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={validationErrors.date ? 'border-red-500' : ''}
                required
              />
              {validationErrors.date && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.date}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* K/D Статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            K/D Статистика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="kills">Убийства</Label>
              <Input
                id="kills"
                type="number"
                min="0"
                value={formData.kills}
                onChange={(e) => handleInputChange('kills', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="deaths">Смерти</Label>
              <Input
                id="deaths"
                type="number"
                min="0"
                value={formData.deaths}
                onChange={(e) => handleInputChange('deaths', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="assists">Ассисты</Label>
              <Input
                id="assists"
                type="number"
                min="0"
                value={formData.assists}
                onChange={(e) => handleInputChange('assists', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          
          {/* Расчетные показатели K/D */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Автоматически рассчитывается:</div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between">
                <span>K/D Ratio:</span>
                <span className="font-mono">{calculatedStats.overall.kdRatio}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CT Side Статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Аналитические метрики игрока
          </CardTitle>
          <CardDescription>
            Заполняются аналитиком вручную для выбранного игрока и даты. Пустые поля могут быть посчитаны автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="adr">ADR (урон/раунд)</Label>
              <Input id="adr" value={formData.adr ?? ''} onChange={(e) => handleOptionalMetricChange('adr', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="kpr">KPR (киллы/раунд)</Label>
              <Input id="kpr" value={formData.kpr ?? ''} onChange={(e) => handleOptionalMetricChange('kpr', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="dpr">Death/round</Label>
              <Input id="dpr" value={formData.deathPerRound ?? ''} onChange={(e) => handleOptionalMetricChange('deathPerRound', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="avg-kr">AVG KR</Label>
              <Input id="avg-kr" value={formData.avgKr ?? ''} onChange={(e) => handleOptionalMetricChange('avgKr', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="avg-kd">AVG KD</Label>
              <Input id="avg-kd" value={formData.avgKd ?? ''} onChange={(e) => handleOptionalMetricChange('avgKd', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="kast">KAST (%)</Label>
              <Input id="kast" value={formData.kast ?? ''} onChange={(e) => handleOptionalMetricChange('kast', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="fk">First kills</Label>
              <Input id="fk" value={formData.firstKills ?? ''} onChange={(e) => handleOptionalMetricChange('firstKills', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="fd">First deaths</Label>
              <Input id="fd" value={formData.firstDeaths ?? ''} onChange={(e) => handleOptionalMetricChange('firstDeaths', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="odd">Разница опен дуэлей</Label>
              <Input id="odd" value={formData.openingDuelDiff ?? ''} onChange={(e) => handleOptionalMetricChange('openingDuelDiff', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="udr">UDR</Label>
              <Input id="udr" value={formData.udr ?? ''} onChange={(e) => handleOptionalMetricChange('udr', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="multi">Ср. мультикилы</Label>
              <Input id="multi" value={formData.avgMultikills ?? ''} onChange={(e) => handleOptionalMetricChange('avgMultikills', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="clutch">Выигранные клатчи</Label>
              <Input id="clutch" value={formData.clutchesWon ?? ''} onChange={(e) => handleOptionalMetricChange('clutchesWon', e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="flash">Ср. время ослепления</Label>
              <Input id="flash" value={formData.avgFlashTime ?? ''} onChange={(e) => handleOptionalMetricChange('avgFlashTime', e.target.value)} inputMode="decimal" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CT Side Статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            CT Side Статистика
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Матчи CT */}
          <div>
            <h4 className="font-semibold mb-3">Матчи</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ct-total-matches">Всего матчей</Label>
                <Input
                  id="ct-total-matches"
                  type="number"
                  min="0"
                  value={formData.ctSide.totalMatches}
                  onChange={(e) => handleInputChange('totalMatches', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-wins">Победы</Label>
                <Input
                  id="ct-wins"
                  type="number"
                  min="0"
                  value={formData.ctSide.wins}
                  onChange={(e) => handleInputChange('wins', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-losses">Поражения</Label>
                <Input
                  id="ct-losses"
                  type="number"
                  min="0"
                  value={formData.ctSide.losses}
                  onChange={(e) => handleInputChange('losses', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-draws">Ничьи</Label>
                <Input
                  id="ct-draws"
                  type="number"
                  min="0"
                  value={formData.ctSide.draws}
                  onChange={(e) => handleInputChange('draws', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.ctMatches && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctMatches}</p>
            )}
          </div>

          <Separator />

          {/* Раунды CT */}
          <div>
            <h4 className="font-semibold mb-3">Раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ct-total-rounds">Всего раундов</Label>
                <Input
                  id="ct-total-rounds"
                  type="number"
                  min="0"
                  value={formData.ctSide.totalRounds}
                  onChange={(e) => handleInputChange('totalRounds', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-rounds-won">Выиграно раундов</Label>
                <Input
                  id="ct-rounds-won"
                  type="number"
                  min="0"
                  value={formData.ctSide.roundsWon}
                  onChange={(e) => handleInputChange('roundsWon', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-rounds-lost">Проиграно раундов</Label>
                <Input
                  id="ct-rounds-lost"
                  type="number"
                  min="0"
                  value={formData.ctSide.roundsLost}
                  onChange={(e) => handleInputChange('roundsLost', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.ctRounds && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctRounds}</p>
            )}
          </div>

          <Separator />

          {/* Пистолетные раунды CT */}
          <div>
            <h4 className="font-semibold mb-3">Пистолетные раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ct-pistol-rounds">Всего пистолетных</Label>
                <Input
                  id="ct-pistol-rounds"
                  type="number"
                  min="0"
                  value={formData.ctSide.pistolRounds}
                  onChange={(e) => handleInputChange('pistolRounds', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctPistol ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="ct-pistol-won">Выиграно пистолетных</Label>
                <Input
                  id="ct-pistol-won"
                  type="number"
                  min="0"
                  value={formData.ctSide.pistolRoundsWon}
                  onChange={(e) => handleInputChange('pistolRoundsWon', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctPistol ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.ctPistol && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctPistol}</p>
            )}
          </div>

          {/* Расчетные показатели CT */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between">
                <span>Win-Rate:</span>
                <span className="font-mono">{calculatedStats.ctSide.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>Round Win-Rate:</span>
                <span className="font-mono">{calculatedStats.ctSide.roundWinRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>AVG Rounds Won:</span>
                <span className="font-mono">{calculatedStats.ctSide.averageRoundsWon}</span>
              </div>
              <div className="flex justify-between">
                <span>AVG Rounds Lost:</span>
                <span className="font-mono">{calculatedStats.ctSide.averageRoundsLost}</span>
              </div>
              <div className="flex justify-between">
                <span>Pistol Win-Rate:</span>
                <span className="font-mono">{calculatedStats.ctSide.pistolWinRate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* T Side Статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            T Side Статистика
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Матчи T */}
          <div>
            <h4 className="font-semibold mb-3">Матчи</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="t-total-matches">Всего матчей</Label>
                <Input
                  id="t-total-matches"
                  type="number"
                  min="0"
                  value={formData.tSide.totalMatches}
                  onChange={(e) => handleInputChange('totalMatches', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-wins">Победы</Label>
                <Input
                  id="t-wins"
                  type="number"
                  min="0"
                  value={formData.tSide.wins}
                  onChange={(e) => handleInputChange('wins', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-losses">Поражения</Label>
                <Input
                  id="t-losses"
                  type="number"
                  min="0"
                  value={formData.tSide.losses}
                  onChange={(e) => handleInputChange('losses', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-draws">Ничьи</Label>
                <Input
                  id="t-draws"
                  type="number"
                  min="0"
                  value={formData.tSide.draws}
                  onChange={(e) => handleInputChange('draws', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.tMatches && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tMatches}</p>
            )}
          </div>

          <Separator />

          {/* Раунды T */}
          <div>
            <h4 className="font-semibold mb-3">Раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="t-total-rounds">Всего раундов</Label>
                <Input
                  id="t-total-rounds"
                  type="number"
                  min="0"
                  value={formData.tSide.totalRounds}
                  onChange={(e) => handleInputChange('totalRounds', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-rounds-won">Выиграно раундов</Label>
                <Input
                  id="t-rounds-won"
                  type="number"
                  min="0"
                  value={formData.tSide.roundsWon}
                  onChange={(e) => handleInputChange('roundsWon', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-rounds-lost">Проиграно раундов</Label>
                <Input
                  id="t-rounds-lost"
                  type="number"
                  min="0"
                  value={formData.tSide.roundsLost}
                  onChange={(e) => handleInputChange('roundsLost', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.tRounds && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tRounds}</p>
            )}
          </div>

          <Separator />

          {/* Пистолетные раунды T */}
          <div>
            <h4 className="font-semibold mb-3">Пистолетные раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="t-pistol-rounds">Всего пистолетных</Label>
                <Input
                  id="t-pistol-rounds"
                  type="number"
                  min="0"
                  value={formData.tSide.pistolRounds}
                  onChange={(e) => handleInputChange('pistolRounds', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tPistol ? 'border-red-500' : ''}
                />
              </div>
              <div>
                <Label htmlFor="t-pistol-won">Выиграно пистолетных</Label>
                <Input
                  id="t-pistol-won"
                  type="number"
                  min="0"
                  value={formData.tSide.pistolRoundsWon}
                  onChange={(e) => handleInputChange('pistolRoundsWon', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tPistol ? 'border-red-500' : ''}
                />
              </div>
            </div>
            {validationErrors.tPistol && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tPistol}</p>
            )}
          </div>

          {/* Расчетные показатели T */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between">
                <span>Win-Rate:</span>
                <span className="font-mono">{calculatedStats.tSide.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>Round Win-Rate:</span>
                <span className="font-mono">{calculatedStats.tSide.roundWinRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>AVG Rounds Won:</span>
                <span className="font-mono">{calculatedStats.tSide.averageRoundsWon}</span>
              </div>
              <div className="flex justify-between">
                <span>AVG Rounds Lost:</span>
                <span className="font-mono">{calculatedStats.tSide.averageRoundsLost}</span>
              </div>
              <div className="flex justify-between">
                <span>Pistol Win-Rate:</span>
                <span className="font-mono">{calculatedStats.tSide.pistolWinRate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Общая статистика */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Общая статистика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-3">Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-center mb-2">Матчи</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-mono">{calculatedStats.overall.totalMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Победы:</span>
                    <span className="font-mono">{calculatedStats.overall.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win-Rate:</span>
                    <span className="font-mono">{calculatedStats.overall.winRate}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2">K/D</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>K/D Ratio:</span>
                    <span className="font-mono">{calculatedStats.overall.kdRatio}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2">Раунды</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-mono">{calculatedStats.overall.totalRounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Выиграно:</span>
                    <span className="font-mono">{calculatedStats.overall.roundsWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win-Rate:</span>
                    <span className="font-mono">{calculatedStats.overall.roundWinRate}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2">Пистолеты</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Всего:</span>
                    <span className="font-mono">{calculatedStats.overall.totalPistolRounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Выиграно:</span>
                    <span className="font-mono">{calculatedStats.overall.pistolRoundsWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win-Rate:</span>
                    <span className="font-mono">{calculatedStats.overall.pistolWinRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Кнопка отправки */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={isLoading || !isFormValid}
          className="min-w-[120px]"
        >
          {isLoading ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
};

export default GameStatsForm; 
