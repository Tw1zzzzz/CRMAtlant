import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Users, Trophy, Award, Crosshair, Shield } from 'lucide-react';
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
  allowTeamMode?: boolean;
  showPlayerSelect?: boolean;
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
  initialData = {},
  allowTeamMode = true,
  showPlayerSelect = true
}) => {
  const { toast } = useToast();
  const sectionCardStyle = {
    backgroundColor: 'rgba(26, 32, 44, 0.96)',
    borderColor: 'rgba(255,255,255,0.08)',
    boxShadow: '0 1px 20px 0 rgba(0,0,0,.1)'
  };
  const titleStyle = { color: '#FFFFFF' };
  const descriptionStyle = { color: '#A0AEC0' };
  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.08)'
  };
  const calcPanelStyle = {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)'
  };
  
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

  // РћР±СЂР°Р±РѕС‚С‡РёРє РёР·РјРµРЅРµРЅРёСЏ СЂРµР¶РёРјР° Р°РЅР°Р»РёР·Р°
  const handleAnalysisModeChange = (mode: 'team' | 'individual') => {
    if (!allowTeamMode && mode === 'team') {
      return;
    }
    onAnalysisModeChange(mode);
    
    if (mode === 'team') {
      onSelectedPlayerChange('');
      setFormData(prev => ({ ...prev, userId: '' }));
    }
  };

  // РћР±СЂР°Р±РѕС‚С‡РёРє РІС‹Р±РѕСЂР° РёРіСЂРѕРєР°
  const handlePlayerSelect = (playerId: string) => {
    onSelectedPlayerChange(playerId);
    setFormData(prev => ({ ...prev, userId: playerId }));
  };

  // Р¤СѓРЅРєС†РёСЏ РґР»СЏ СЂР°СЃС‡РµС‚Р° СЃС‚Р°С‚РёСЃС‚РёРєРё РѕРґРЅРѕР№ стороны
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

  // Р Р°СЃС‡РµС‚ РІСЃРµС… РїРѕРєР°Р·Р°С‚РµР»РµР№
  const calculatedStats: CalculatedStats = React.useMemo(() => {
    const ctCalculated = calculateSideStats(formData.ctSide);
    const tCalculated = calculateSideStats(formData.tSide);

    // РћР±С‰Р°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°
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

  // Р’Р°Р»РёРґР°ция формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // РџСЂРѕРІРµСЂСЏРµРј РІС‹Р±РѕСЂ РёРіСЂРѕРєР° РґР»СЏ staff РІ РёРЅРґРёРІРёРґСѓР°Р»СЊРЅРѕРј СЂРµР¶РёРјРµ
    if (showPlayerSelect && analysisMode === 'individual' && !selectedPlayerId) {
      errors.playerSelection = 'Необходимо выбрать игрока для индивидуальной статистики';
    }

    // Р’Р°Р»РёРґР°С†РёСЏ РґР°ты
    if (!formData.date) {
      errors.date = 'Необходимо указать дату';
    }

    // Р’Р°Р»РёРґР°С†РёСЏ CT Side (С‚РѕР»СЊРєРѕ РµСЃР»Рё РµСЃС‚СЊ РґР°РЅРЅС‹Рµ)
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

    // Р’Р°Р»РёРґР°С†РёСЏ T Side (С‚РѕР»СЊРєРѕ РµСЃР»Рё РµСЃС‚СЊ РґР°РЅРЅС‹Рµ)
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
      // РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј РґР°РЅРЅС‹Рµ РґР»СЏ РѕС‚РїСЂР°вки
      const submitData = {
        ...formData,
        userId: analysisMode === 'individual' ? selectedPlayerId : undefined
      };
      
      console.log('РћС‚РїСЂР°РІР»СЏРµРј РґР°РЅРЅС‹Рµ РёРіСЂРѕРІС‹С… РїРѕРєР°Р·Р°С‚РµР»РµР№:', submitData);
      
      await onSubmit(submitData);
      
      toast({
        title: "Успешно",
        description: "Игровые показатели сохранены",
      });
      
      // РЎР±СЂР°СЃС‹РІР°РµРј С„РѕСЂРјСѓ РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ СЃРѕС…СЂР°РЅРµния
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
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[28px] p-4 md:p-5">
      {/* Р’С‹Р±РѕСЂ СЂРµР¶РёРјР° Рё РёРіСЂРѕРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Users className="h-5 w-5" />
            Режим анализа
          </CardTitle>
          <CardDescription style={descriptionStyle}>
            Выберите режим для ввода игровых показателей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium" style={titleStyle}>Режим анализа</Label>
            <Select value={analysisMode} onValueChange={handleAnalysisModeChange} disabled={!allowTeamMode}>
              <SelectTrigger style={inputStyle}>
                <SelectValue placeholder="Выберите режим анализа" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}>
                <SelectItem value="individual">Индивидуальная статистика</SelectItem>
                {allowTeamMode && <SelectItem value="team">Командная статистика</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {analysisMode === 'individual' && showPlayerSelect && (
            <div className="space-y-2">
              <Label className="text-base font-medium" style={titleStyle}>Выберите игрока</Label>
              <Select 
                value={selectedPlayerId} 
                onValueChange={handlePlayerSelect}
                disabled={loadingPlayers}
              >
                <SelectTrigger className={validationErrors.playerSelection ? 'border-red-500' : ''} style={inputStyle}>
                  <SelectValue placeholder={loadingPlayers ? "Загрузка игроков..." : "Выберите игрока"} />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: '#1A202C', borderColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}>
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
                <p className="text-sm" style={descriptionStyle}>
                  Игроки не найдены
                </p>
              )}
            </div>
          )}

          <div className="rounded-[20px] border p-4 text-sm leading-6" style={calcPanelStyle}>
            <div style={descriptionStyle}>
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

      {/* РћСЃРЅРѕРІРЅС‹Рµ РґР°РЅРЅС‹Рµ */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Trophy className="h-5 w-5 text-white" />
            Основные данные
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" style={titleStyle}>Дата</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={validationErrors.date ? 'border-red-500' : ''}
                style={inputStyle}
                required
              />
              {validationErrors.date && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.date}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* K/D РЎС‚Р°С‚РёСЃС‚РёРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Crosshair className="h-5 w-5" />
            K/D Статистика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="kills" style={titleStyle}>Убийства</Label>
              <Input
                id="kills"
                type="number"
                min="0"
                value={formData.kills}
                onChange={(e) => handleInputChange('kills', parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <Label htmlFor="deaths" style={titleStyle}>Смерти</Label>
              <Input
                id="deaths"
                type="number"
                min="0"
                value={formData.deaths}
                onChange={(e) => handleInputChange('deaths', parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            <div>
              <Label htmlFor="assists" style={titleStyle}>Ассисты</Label>
              <Input
                id="assists"
                type="number"
                min="0"
                value={formData.assists}
                onChange={(e) => handleInputChange('assists', parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
          </div>
          
          {/* Р Р°СЃС‡РµС‚РЅС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё K/D */}
          <div className="mt-4 rounded-[20px] border p-4" style={calcPanelStyle}>
            <div className="text-sm font-medium mb-2" style={titleStyle}>Автоматически рассчитывается:</div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between text-sm">
                <span style={descriptionStyle}>K/D Ratio:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.overall.kdRatio}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CT Side РЎС‚Р°С‚РёСЃС‚РёРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Target className="h-5 w-5 text-white" />
            Аналитические метрики игрока
          </CardTitle>
          <CardDescription style={descriptionStyle}>
            Заполняются аналитиком вручную для выбранного игрока и даты. Пустые поля могут быть посчитаны автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="adr" style={titleStyle}>ADR (урон/раунд)</Label>
              <Input id="adr" value={formData.adr ?? ''} onChange={(e) => handleOptionalMetricChange('adr', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="kpr" style={titleStyle}>KPR (киллы/раунд)</Label>
              <Input id="kpr" value={formData.kpr ?? ''} onChange={(e) => handleOptionalMetricChange('kpr', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="dpr" style={titleStyle}>Death/round</Label>
              <Input id="dpr" value={formData.deathPerRound ?? ''} onChange={(e) => handleOptionalMetricChange('deathPerRound', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="avg-kr" style={titleStyle}>AVG KR</Label>
              <Input id="avg-kr" value={formData.avgKr ?? ''} onChange={(e) => handleOptionalMetricChange('avgKr', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="avg-kd" style={titleStyle}>AVG KD</Label>
              <Input id="avg-kd" value={formData.avgKd ?? ''} onChange={(e) => handleOptionalMetricChange('avgKd', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="kast" style={titleStyle}>KAST (%)</Label>
              <Input id="kast" value={formData.kast ?? ''} onChange={(e) => handleOptionalMetricChange('kast', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="fk" style={titleStyle}>First kills</Label>
              <Input id="fk" value={formData.firstKills ?? ''} onChange={(e) => handleOptionalMetricChange('firstKills', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="fd" style={titleStyle}>First deaths</Label>
              <Input id="fd" value={formData.firstDeaths ?? ''} onChange={(e) => handleOptionalMetricChange('firstDeaths', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="odd" style={titleStyle}>Разница опен дуэлей</Label>
              <Input id="odd" value={formData.openingDuelDiff ?? ''} onChange={(e) => handleOptionalMetricChange('openingDuelDiff', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="udr" style={titleStyle}>UDR</Label>
              <Input id="udr" value={formData.udr ?? ''} onChange={(e) => handleOptionalMetricChange('udr', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="multi" style={titleStyle}>Ср. мультикилы</Label>
              <Input id="multi" value={formData.avgMultikills ?? ''} onChange={(e) => handleOptionalMetricChange('avgMultikills', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="clutch" style={titleStyle}>Выигранные клатчи</Label>
              <Input id="clutch" value={formData.clutchesWon ?? ''} onChange={(e) => handleOptionalMetricChange('clutchesWon', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <Label htmlFor="flash" style={titleStyle}>Ср. время ослепления</Label>
              <Input id="flash" value={formData.avgFlashTime ?? ''} onChange={(e) => handleOptionalMetricChange('avgFlashTime', e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CT Side РЎС‚Р°С‚РёСЃС‚РёРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Shield className="h-5 w-5" />
            CT Side Статистика
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* РњР°тчи CT */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Матчи</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ct-total-matches" style={titleStyle}>Всего матчей</Label>
                <Input
                  id="ct-total-matches"
                  type="number"
                  min="0"
                  value={formData.ctSide.totalMatches}
                  onChange={(e) => handleInputChange('totalMatches', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-wins" style={titleStyle}>Победы</Label>
                <Input
                  id="ct-wins"
                  type="number"
                  min="0"
                  value={formData.ctSide.wins}
                  onChange={(e) => handleInputChange('wins', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-losses" style={titleStyle}>Поражения</Label>
                <Input
                  id="ct-losses"
                  type="number"
                  min="0"
                  value={formData.ctSide.losses}
                  onChange={(e) => handleInputChange('losses', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-draws" style={titleStyle}>Ничьи</Label>
                <Input
                  id="ct-draws"
                  type="number"
                  min="0"
                  value={formData.ctSide.draws}
                  onChange={(e) => handleInputChange('draws', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.ctMatches && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctMatches}</p>
            )}
          </div>

          <Separator style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* Р Р°СѓРЅРґС‹ CT */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ct-total-rounds" style={titleStyle}>Всего раундов</Label>
                <Input
                  id="ct-total-rounds"
                  type="number"
                  min="0"
                  value={formData.ctSide.totalRounds}
                  onChange={(e) => handleInputChange('totalRounds', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-rounds-won" style={titleStyle}>Выиграно раундов</Label>
                <Input
                  id="ct-rounds-won"
                  type="number"
                  min="0"
                  value={formData.ctSide.roundsWon}
                  onChange={(e) => handleInputChange('roundsWon', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-rounds-lost" style={titleStyle}>Проиграно раундов</Label>
                <Input
                  id="ct-rounds-lost"
                  type="number"
                  min="0"
                  value={formData.ctSide.roundsLost}
                  onChange={(e) => handleInputChange('roundsLost', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.ctRounds && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctRounds}</p>
            )}
          </div>

          <Separator style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* РџРёСЃС‚РѕР»РµС‚РЅС‹Рµ СЂР°СѓРЅРґС‹ CT */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Пистолетные раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ct-pistol-rounds" style={titleStyle}>Всего пистолетных</Label>
                <Input
                  id="ct-pistol-rounds"
                  type="number"
                  min="0"
                  value={formData.ctSide.pistolRounds}
                  onChange={(e) => handleInputChange('pistolRounds', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctPistol ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="ct-pistol-won" style={titleStyle}>Выиграно пистолетных</Label>
                <Input
                  id="ct-pistol-won"
                  type="number"
                  min="0"
                  value={formData.ctSide.pistolRoundsWon}
                  onChange={(e) => handleInputChange('pistolRoundsWon', parseInt(e.target.value) || 0, 'ctSide')}
                  className={validationErrors.ctPistol ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.ctPistol && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.ctPistol}</p>
            )}
          </div>

          {/* Р Р°СЃС‡РµС‚РЅС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё CT */}
          <div className="rounded-[20px] border p-4" style={calcPanelStyle}>
            <div className="text-sm font-medium mb-2" style={titleStyle}>Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between">
                <span style={descriptionStyle}>Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.ctSide.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>Round Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.ctSide.roundWinRate}%</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>AVG Rounds Won:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.ctSide.averageRoundsWon}</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>AVG Rounds Lost:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.ctSide.averageRoundsLost}</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>Pistol Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.ctSide.pistolWinRate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* T Side РЎС‚Р°С‚РёСЃС‚РёРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Target className="h-5 w-5 text-white" />
            T Side Статистика
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* РњР°тчи T */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Матчи</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="t-total-matches" style={titleStyle}>Всего матчей</Label>
                <Input
                  id="t-total-matches"
                  type="number"
                  min="0"
                  value={formData.tSide.totalMatches}
                  onChange={(e) => handleInputChange('totalMatches', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-wins" style={titleStyle}>Победы</Label>
                <Input
                  id="t-wins"
                  type="number"
                  min="0"
                  value={formData.tSide.wins}
                  onChange={(e) => handleInputChange('wins', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-losses" style={titleStyle}>Поражения</Label>
                <Input
                  id="t-losses"
                  type="number"
                  min="0"
                  value={formData.tSide.losses}
                  onChange={(e) => handleInputChange('losses', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-draws" style={titleStyle}>Ничьи</Label>
                <Input
                  id="t-draws"
                  type="number"
                  min="0"
                  value={formData.tSide.draws}
                  onChange={(e) => handleInputChange('draws', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tMatches ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.tMatches && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tMatches}</p>
            )}
          </div>

          <Separator style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* Р Р°СѓРЅРґС‹ T */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="t-total-rounds" style={titleStyle}>Всего раундов</Label>
                <Input
                  id="t-total-rounds"
                  type="number"
                  min="0"
                  value={formData.tSide.totalRounds}
                  onChange={(e) => handleInputChange('totalRounds', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-rounds-won" style={titleStyle}>Выиграно раундов</Label>
                <Input
                  id="t-rounds-won"
                  type="number"
                  min="0"
                  value={formData.tSide.roundsWon}
                  onChange={(e) => handleInputChange('roundsWon', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-rounds-lost" style={titleStyle}>Проиграно раундов</Label>
                <Input
                  id="t-rounds-lost"
                  type="number"
                  min="0"
                  value={formData.tSide.roundsLost}
                  onChange={(e) => handleInputChange('roundsLost', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tRounds ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.tRounds && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tRounds}</p>
            )}
          </div>

          <Separator style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* РџРёСЃС‚РѕР»РµС‚РЅС‹Рµ СЂР°СѓРЅРґС‹ T */}
          <div>
            <h4 className="font-semibold mb-3" style={titleStyle}>Пистолетные раунды</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="t-pistol-rounds" style={titleStyle}>Всего пистолетных</Label>
                <Input
                  id="t-pistol-rounds"
                  type="number"
                  min="0"
                  value={formData.tSide.pistolRounds}
                  onChange={(e) => handleInputChange('pistolRounds', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tPistol ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label htmlFor="t-pistol-won" style={titleStyle}>Выиграно пистолетных</Label>
                <Input
                  id="t-pistol-won"
                  type="number"
                  min="0"
                  value={formData.tSide.pistolRoundsWon}
                  onChange={(e) => handleInputChange('pistolRoundsWon', parseInt(e.target.value) || 0, 'tSide')}
                  className={validationErrors.tPistol ? 'border-red-500' : ''}
                  style={inputStyle}
                />
              </div>
            </div>
            {validationErrors.tPistol && (
              <p className="text-red-500 text-sm mt-1">{validationErrors.tPistol}</p>
            )}
          </div>

          {/* Р Р°СЃС‡РµС‚РЅС‹Рµ РїРѕРєР°Р·Р°С‚РµР»Рё T */}
          <div className="rounded-[20px] border p-4" style={calcPanelStyle}>
            <div className="text-sm font-medium mb-2" style={titleStyle}>Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between">
                <span style={descriptionStyle}>Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.tSide.winRate}%</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>Round Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.tSide.roundWinRate}%</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>AVG Rounds Won:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.tSide.averageRoundsWon}</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>AVG Rounds Lost:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.tSide.averageRoundsLost}</span>
              </div>
              <div className="flex justify-between">
                <span style={descriptionStyle}>Pistol Win-Rate:</span>
                <span className="font-mono" style={titleStyle}>{calculatedStats.tSide.pistolWinRate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* РћР±С‰Р°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР° */}
      <Card style={sectionCardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={titleStyle}>
            <Award className="h-5 w-5" />
            Общая статистика
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-[20px] border p-4" style={calcPanelStyle}>
            <div className="text-sm font-medium mb-3" style={titleStyle}>Автоматически рассчитывается:</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-center mb-2" style={titleStyle}>Матчи</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Всего:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.totalMatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Победы:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Win-Rate:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.winRate}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2" style={titleStyle}>K/D</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>K/D Ratio:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.kdRatio}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2" style={titleStyle}>Раунды</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Всего:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.totalRounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Выиграно:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.roundsWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Win-Rate:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.roundWinRate}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="font-medium text-center mb-2" style={titleStyle}>Пистолеты</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Всего:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.totalPistolRounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Выиграно:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.pistolRoundsWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={descriptionStyle}>Win-Rate:</span>
                    <span className="font-mono" style={titleStyle}>{calculatedStats.overall.pistolWinRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* РљРЅРѕРїРєР° РѕС‚РїСЂР°вки */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={isLoading || !isFormValid}
          className="min-w-[160px] rounded-2xl"
          style={{ backgroundColor: '#3590FF', color: '#FFFFFF' }}
        >
          {isLoading ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
};

export default GameStatsForm; 
