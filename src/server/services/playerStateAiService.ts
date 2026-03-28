import axios from 'axios';
import mongoose from 'mongoose';
import MoodEntry from '../models/MoodEntry';
import BalanceWheel from '../models/BalanceWheel';
import ScreenTime from '../models/ScreenTime';
import GameStats from '../models/GameStats';
import BrainTestAttempt from '../models/BrainTestAttempt';
import type { BodyZone, PlayerStateReport, ZoneData, ZoneSeverity } from '../../types/playerState.types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/auto';

// ─── helpers ────────────────────────────────────────────────────────────────

const avg = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

const clamp = (v: number, lo = 0, hi = 100): number => Math.min(hi, Math.max(lo, v));

const toSeverity = (score: number): ZoneSeverity => {
  if (score >= 75) return 'ok';
  if (score >= 50) return 'warning';
  return 'critical';
};

const extractJsonObject = (content: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(content);
  } catch {
    const jsonBlock = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonBlock) {
      try {
        return JSON.parse(jsonBlock[1]);
      } catch {
        // fall through
      }
    }
    const bare = content.match(/\{[\s\S]*\}/);
    if (bare) {
      try {
        return JSON.parse(bare[0]);
      } catch {
        // fall through
      }
    }
    return null;
  }
};

// ─── data aggregation ───────────────────────────────────────────────────────

interface AggregatedPlayerData {
  userId: mongoose.Types.ObjectId | string;
  moodEntries: Array<{ date: Date; mood: number; energy: number }>;
  latestBalanceWheel: {
    physical: number;
    emotional: number;
    intellectual: number;
    spiritual: number;
    occupational: number;
    social: number;
    environmental: number;
    financial: number;
  } | null;
  screenTimeLast7: Array<{ date: Date; totalTime: number; entertainment: number }>;
  gameStatsSummary: {
    avgKdRatio: number;
    avgWinRate: number;
    totalMatches: number;
  } | null;
  brainDomainScores: Record<string, number>;
  stateSnapshots: Array<{
    fatigue?: number;
    focus?: number;
    stress?: number;
    sleepHours?: number;
    mood?: number;
    energy?: number;
  }>;
}

const aggregatePlayerData = async (
  userId: mongoose.Types.ObjectId | string,
): Promise<AggregatedPlayerData> => {
  const now = new Date();
  const date14ago = new Date(now);
  date14ago.setDate(date14ago.getDate() - 14);

  const date7ago = new Date(now);
  date7ago.setDate(date7ago.getDate() - 7);

  // Mood + energy last 14 days
  const moodDocs = await MoodEntry.find({
    userId,
    date: { $gte: date14ago },
  })
    .sort({ date: -1 })
    .lean();

  const moodEntries = moodDocs.map((d) => ({
    date: d.date as Date,
    mood: Number(d.mood ?? 0),
    energy: Number(d.energy ?? 0),
  }));

  // Latest balance wheel
  const bwDoc = await BalanceWheel.findOne({ userId }).sort({ date: -1 }).lean();
  const latestBalanceWheel = bwDoc
    ? {
        physical: Number(bwDoc.physical ?? 5),
        emotional: Number(bwDoc.emotional ?? 5),
        intellectual: Number(bwDoc.intellectual ?? 5),
        spiritual: Number(bwDoc.spiritual ?? 5),
        occupational: Number(bwDoc.occupational ?? 5),
        social: Number(bwDoc.social ?? 5),
        environmental: Number(bwDoc.environmental ?? 5),
        financial: Number(bwDoc.financial ?? 5),
      }
    : null;

  // Screen time last 7 days
  const stDocs = await ScreenTime.find({
    userId,
    date: { $gte: date7ago },
  })
    .sort({ date: -1 })
    .lean();

  const screenTimeLast7 = stDocs.map((d) => ({
    date: d.date as Date,
    totalTime: Number(d.totalTime ?? 0),
    entertainment: Number(d.entertainment ?? 0),
  }));

  // Game stats summary (last 30 days)
  const date30ago = new Date(now);
  date30ago.setDate(date30ago.getDate() - 30);

  const gsDocs = await GameStats.find({ userId, date: { $gte: date30ago } }).lean();
  let gameStatsSummary: AggregatedPlayerData['gameStatsSummary'] = null;
  if (gsDocs.length > 0) {
    const kdValues = gsDocs.map((d) => Number(d.kdRatio ?? 0));
    const wrValues = gsDocs.map((d) => Number(d.winRate ?? 0));
    gameStatsSummary = {
      avgKdRatio: avg(kdValues),
      avgWinRate: avg(wrValues),
      totalMatches: gsDocs.reduce((s, d) => s + Number(d.totalMatches ?? 0), 0),
    };
  }

  // Brain test domain scores (latest attempt per domain)
  const brainDocs = await BrainTestAttempt.find({
    userId,
    status: 'completed',
    validityStatus: 'valid',
  })
    .sort({ completedAt: -1 })
    .lean();

  const brainDomainScores: Record<string, number> = {};
  for (const doc of brainDocs) {
    const domain = String(doc.domain ?? '');
    if (domain && !(domain in brainDomainScores)) {
      brainDomainScores[domain] = Number(doc.rawCompositeScore ?? doc.formScore ?? 0);
    }
  }

  // State snapshots from recent brain test attempts
  const stateSnapshots = brainDocs
    .slice(0, 10)
    .map((d) => (d as Record<string, unknown>).stateSnapshot)
    .filter(Boolean) as AggregatedPlayerData['stateSnapshots'];

  return {
    userId,
    moodEntries,
    latestBalanceWheel,
    screenTimeLast7,
    gameStatsSummary,
    brainDomainScores,
    stateSnapshots,
  };
};

// ─── fallback analysis ──────────────────────────────────────────────────────

const buildFallbackAnalysis = (data: AggregatedPlayerData): PlayerStateReport => {
  const moodValues = data.moodEntries.map((e) => e.mood);
  const energyValues = data.moodEntries.map((e) => e.energy);
  const avgMood = avg(moodValues);
  const avgEnergy = avg(energyValues);

  const bw = data.latestBalanceWheel;
  const avgPhysical = bw ? bw.physical : 5;
  const avgEmotional = bw ? bw.emotional : 5;
  const avgIntellectual = bw ? bw.intellectual : 5;

  const avgScreenTime = avg(data.screenTimeLast7.map((s) => s.totalTime));
  const avgEntertainment = avg(data.screenTimeLast7.map((s) => s.entertainment));

  const snapFatigue = avg(
    data.stateSnapshots.map((s) => s.fatigue ?? 5).filter((v) => v > 0),
  );
  const snapFocus = avg(
    data.stateSnapshots.map((s) => s.focus ?? 5).filter((v) => v > 0),
  );
  const snapStress = avg(
    data.stateSnapshots.map((s) => s.stress ?? 5).filter((v) => v > 0),
  );
  const snapSleep = avg(
    data.stateSnapshots.map((s) => s.sleepHours ?? 7).filter((v) => v > 0),
  );

  // Attention domain from brain tests
  const attentionKeys = Object.keys(data.brainDomainScores).filter((k) =>
    k.toLowerCase().includes('attention'),
  );
  const attentionScore =
    attentionKeys.length > 0
      ? avg(attentionKeys.map((k) => data.brainDomainScores[k]))
      : null;

  // head: cognitive load (brain attention + intellectual balance wheel)
  const headRaw =
    attentionScore !== null
      ? attentionScore * 0.6 + ((avgIntellectual / 10) * 100) * 0.4
      : (avgIntellectual / 10) * 100;
  const headScore = clamp(Math.round(headRaw));

  // eyes: visual fatigue (screen time — more hours = lower score)
  const eyesRaw =
    avgScreenTime > 0
      ? clamp(100 - ((avgScreenTime - 4) / 12) * 100)
      : avgEntertainment > 0
      ? clamp(100 - ((avgEntertainment - 2) / 8) * 100)
      : 75;
  const eyesScore = clamp(Math.round(eyesRaw));

  // chest: stress + emotional state
  const stressComponent = snapStress > 0 ? clamp(100 - ((snapStress - 1) / 9) * 100) : 70;
  const emotionalComponent = bw ? (avgEmotional / 10) * 100 : (avgMood / 10) * 100;
  const chestScore = clamp(Math.round(stressComponent * 0.5 + emotionalComponent * 0.5));

  // arms: gaming performance
  const gs = data.gameStatsSummary;
  const armsRaw = gs
    ? clamp(
        (gs.avgKdRatio > 0 ? Math.min(gs.avgKdRatio / 2, 1) : 0.5) * 50 +
          gs.avgWinRate * 0.5,
      )
    : 60;
  const armsScore = clamp(Math.round(armsRaw));

  // back: fatigue + recovery (sleep + fatigue snapshot)
  const fatigueComponent =
    snapFatigue > 0 ? clamp(100 - ((snapFatigue - 1) / 9) * 100) : 65;
  const sleepComponent =
    snapSleep > 0 ? clamp(Math.min(snapSleep / 8, 1) * 100) : 65;
  const backScore = clamp(Math.round(fatigueComponent * 0.6 + sleepComponent * 0.4));

  // legs: overall energy (energy entries + physical balance wheel)
  const energyComponent = avgEnergy > 0 ? (avgEnergy / 10) * 100 : 60;
  const physicalComponent = (avgPhysical / 10) * 100;
  const focusComponent = snapFocus > 0 ? clamp(((snapFocus - 1) / 9) * 100) : 60;
  const legsScore = clamp(
    Math.round(energyComponent * 0.5 + physicalComponent * 0.3 + focusComponent * 0.2),
  );

  const severityLabel = (score: number): string => {
    if (score >= 75) return 'В норме';
    if (score >= 50) return 'Повышенная нагрузка';
    return 'Требует внимания';
  };

  // dataBreakdown per zone
  const headBreakdown: string[] = [];
  if (attentionScore !== null) headBreakdown.push(`Внимание: ${Math.round(attentionScore)}`);
  const reactionKeys = Object.keys(data.brainDomainScores).filter((k) => k.toLowerCase().includes('reaction'));
  if (reactionKeys.length > 0) headBreakdown.push(`Реакция: ${Math.round(avg(reactionKeys.map((k) => data.brainDomainScores[k])))}`);
  const memKeys = Object.keys(data.brainDomainScores).filter((k) => k.toLowerCase().includes('memory'));
  if (memKeys.length > 0) headBreakdown.push(`Рабочая память: ${Math.round(avg(memKeys.map((k) => data.brainDomainScores[k])))}`);
  if (bw) headBreakdown.push(`Интеллект (колесо): ${Math.round((bw.intellectual / 10) * 100)}`);

  const eyesBreakdown: string[] = [];
  if (avgScreenTime > 0) eyesBreakdown.push(`Экранное время: ${avgScreenTime.toFixed(1)} ч/день`);
  if (avgEntertainment > 0) eyesBreakdown.push(`Развлечения: ${avgEntertainment.toFixed(1)} ч/день`);
  const goNoGoKeys = Object.keys(data.brainDomainScores).filter((k) => k.toLowerCase().includes('inhibition'));
  if (goNoGoKeys.length > 0) eyesBreakdown.push(`Go/No-Go: ${Math.round(avg(goNoGoKeys.map((k) => data.brainDomainScores[k])))}`);
  const flexKeys = Object.keys(data.brainDomainScores).filter((k) => k.toLowerCase().includes('flexibility'));
  if (flexKeys.length > 0) eyesBreakdown.push(`Гибкость: ${Math.round(avg(flexKeys.map((k) => data.brainDomainScores[k])))}`);

  const chestBreakdown: string[] = [];
  if (avgMood > 0) chestBreakdown.push(`Настроение: ${avgMood.toFixed(1)}/10`);
  if (snapStress > 0) chestBreakdown.push(`Стресс: ${snapStress.toFixed(1)}/10`);
  if (bw) chestBreakdown.push(`Эмоции (колесо): ${Math.round((bw.emotional / 10) * 100)}`);
  if (bw) chestBreakdown.push(`Духовность: ${Math.round((bw.spiritual / 10) * 100)}`);

  const armsBreakdown: string[] = [];
  if (gs) {
    armsBreakdown.push(`K/D: ${gs.avgKdRatio.toFixed(2)}`);
    armsBreakdown.push(`Win Rate: ${gs.avgWinRate.toFixed(1)}%`);
    armsBreakdown.push(`Матчей: ${gs.totalMatches}`);
  } else {
    armsBreakdown.push('Игровые данные отсутствуют');
  }

  const backBreakdown: string[] = [];
  if (snapFatigue > 0) backBreakdown.push(`Усталость: ${snapFatigue.toFixed(1)}/10`);
  if (snapSleep > 0) backBreakdown.push(`Сон: ${snapSleep.toFixed(1)} ч`);
  if (avgEnergy > 0) backBreakdown.push(`Энергия: ${avgEnergy.toFixed(1)}/10`);
  if (bw) backBreakdown.push(`Физ. (колесо): ${Math.round((bw.physical / 10) * 100)}`);

  const legsBreakdown: string[] = [];
  if (bw) {
    legsBreakdown.push(`Социальное: ${Math.round((bw.social / 10) * 100)}`);
    legsBreakdown.push(`Окружение: ${Math.round((bw.environmental / 10) * 100)}`);
    legsBreakdown.push(`Финансы: ${Math.round((bw.financial / 10) * 100)}`);
    legsBreakdown.push(`Занятость: ${Math.round((bw.occupational / 10) * 100)}`);
  } else {
    legsBreakdown.push('Данные колеса баланса отсутствуют');
  }

  const zones: Record<BodyZone, ZoneData> = {
    head: {
      score: headScore,
      label: severityLabel(headScore),
      description: `Когнитивный потенциал: балл ${headScore}/100. ${headScore >= 75 ? 'Когнитивные ресурсы в норме.' : headScore >= 50 ? 'Возможно небольшое снижение концентрации.' : 'Высокая когнитивная нагрузка, рекомендуется отдых.'}`,
      severity: toSeverity(headScore),
      dataBreakdown: headBreakdown.slice(0, 5),
    },
    eyes: {
      score: eyesScore,
      label: severityLabel(eyesScore),
      description: `Фокус и концентрация: балл ${eyesScore}/100. ${eyesScore >= 75 ? 'Нагрузка на зрение в пределах нормы.' : eyesScore >= 50 ? 'Умеренная нагрузка на зрение.' : 'Высокое экранное время, зрение перегружено.'}`,
      severity: toSeverity(eyesScore),
      dataBreakdown: eyesBreakdown.slice(0, 5),
    },
    chest: {
      score: chestScore,
      label: severityLabel(chestScore),
      description: `Психологическое ядро: балл ${chestScore}/100. ${chestScore >= 75 ? 'Эмоциональный фон стабильный.' : chestScore >= 50 ? 'Умеренный уровень стресса.' : 'Высокий стресс, требуется восстановление.'}`,
      severity: toSeverity(chestScore),
      dataBreakdown: chestBreakdown.slice(0, 5),
    },
    arms: {
      score: armsScore,
      label: severityLabel(armsScore),
      description: `Игровой перформанс: балл ${armsScore}/100. ${gs ? `K/D: ${gs.avgKdRatio.toFixed(2)}, Win Rate: ${gs.avgWinRate.toFixed(1)}%.` : 'Игровые данные за последние 30 дней отсутствуют.'}`,
      severity: toSeverity(armsScore),
      dataBreakdown: armsBreakdown.slice(0, 5),
    },
    back: {
      score: backScore,
      label: severityLabel(backScore),
      description: `Восстановление: балл ${backScore}/100. ${backScore >= 75 ? 'Уровень усталости в норме.' : backScore >= 50 ? 'Умеренная усталость.' : 'Высокая усталость, необходим отдых.'}`,
      severity: toSeverity(backScore),
      dataBreakdown: backBreakdown.slice(0, 5),
    },
    legs: {
      score: legsScore,
      label: severityLabel(legsScore),
      description: `Жизненный фундамент: балл ${legsScore}/100. ${legsScore >= 75 ? 'Жизненный баланс хороший.' : legsScore >= 50 ? 'Умеренный уровень жизненного баланса.' : 'Низкий уровень жизненного баланса.'}`,
      severity: toSeverity(legsScore),
      dataBreakdown: legsBreakdown.slice(0, 5),
    },
  };

  const dataUsed: string[] = [];
  if (data.moodEntries.length > 0) dataUsed.push(`Настроение и энергия: ${data.moodEntries.length} записей`);
  if (data.latestBalanceWheel) dataUsed.push('Колесо баланса: последняя запись');
  if (data.screenTimeLast7.length > 0) dataUsed.push(`Экранное время: ${data.screenTimeLast7.length} дней`);
  if (data.gameStatsSummary) dataUsed.push(`Игровая статистика: ${data.gameStatsSummary.totalMatches} матчей`);
  if (Object.keys(data.brainDomainScores).length > 0)
    dataUsed.push(`Мозговые тесты: ${Object.keys(data.brainDomainScores).length} доменов`);

  const avgZoneScore = avg(Object.values(zones).map((z) => z.score));
  const worstZone = Object.entries(zones).reduce(
    (acc, [k, v]) => (v.score < acc.score ? { zone: k, score: v.score } : acc),
    { zone: 'head', score: 100 },
  );

  const recommendations = [
    avgZoneScore < 60
      ? 'Обеспечьте достаточный сон (7–9 часов) и сократите нагрузку на ближайшие 2–3 дня.'
      : 'Поддерживайте текущий режим восстановления и тренировок.',
    zones.eyes.severity !== 'ok'
      ? 'Сделайте перерывы от экрана: правило 20-20-20 (каждые 20 минут смотреть на объект в 6 метрах в течение 20 секунд).'
      : 'Следите за балансом экранного времени и живого общения.',
    `Уделите особое внимание зоне "${worstZone.zone === 'head' ? 'Когнитивный потенциал' : worstZone.zone === 'eyes' ? 'Фокус и концентрация' : worstZone.zone === 'chest' ? 'Психологическое ядро' : worstZone.zone === 'arms' ? 'Игровой перформанс' : worstZone.zone === 'back' ? 'Восстановление' : 'Жизненный фундамент'}" с баллом ${worstZone.score}/100.`,
  ];

  return {
    report: `Анализ состояния игрока сформирован на основе доступных данных. Средний балл по всем зонам: ${Math.round(avgZoneScore)}/100.\n\nНастроение и энергия отражают ${avgMood > 0 ? `средний уровень ${avgMood.toFixed(1)}/10 по настроению и ${avgEnergy.toFixed(1)}/10 по энергии за последние 14 дней` : 'недостаточно данных для точной оценки'}.\n\nЭмоциональный фон ${chestScore >= 75 ? 'стабилен' : chestScore >= 50 ? 'умеренно напряжён' : 'требует внимания'}, уровень стресса ${zones.chest.label.toLowerCase()}.\n\nФизическая готовность и энергия оцениваются как "${zones.legs.label}", игровая производительность "${zones.arms.label}".\n\nАнализ выполнен автоматически без участия AI в связи с недоступностью API.`,
    zones,
    recommendations,
    dataUsed,
    generatedAt: new Date().toISOString(),
    model: 'local-fallback',
    fallbackUsed: true,
  };
};

// ─── AI prompt ───────────────────────────────────────────────────────────────

const buildPrompt = (data: AggregatedPlayerData) => {
  const system = `Ты — AI-аналитик профиля состояния киберспортивного игрока.
Отвечай только на русском языке.
Анализируй данные объективно: не придумывай причин, если они не следуют из цифр.

Рассматривай игрока как целостную систему: нейро-когнитивные способности, психологическое состояние, образ жизни и игровые показатели взаимосвязаны. Объясни, как внеигровые факторы (сон, стресс, психология, когниции) влияют на игровую результативность.

Оцени шесть зон по шкале 0–100:
- head (Когнитивный потенциал): результаты brain-тестов (домены attention, working_memory, reaction, flexibility) + intellectual из колеса баланса. Отражает способность к обучению, скорость принятия решений, рабочую память.
- eyes (Фокус и концентрация): go/no-go тест (reaction_inhibition), stroop (flexibility), экранное время (totalTime, entertainment hours). Отражает устойчивость фокуса и селективное внимание.
- chest (Психологическое ядро): настроение (mood), уровень стресса (stress snapshot), emotional из колеса баланса. Отражает эмоциональную стабильность, устойчивость к давлению, мотивацию.
- arms (Игровой перформанс): K/D ratio, Win Rate, ADR (если есть) из game stats, количество матчей. Отражает итоговую результативность в игре.
- back (Восстановление): fatigue snapshot, sleep hours, energy из mood entries, physical из колеса баланса. Отражает способность восстанавливаться и поддерживать форму.
- legs (Жизненный фундамент): social, environmental, financial, occupational из колеса баланса. Отражает стабильность жизненного контекста как основы для роста.

Severity:
- score >= 75 → "ok"
- score 50–74 → "warning"
- score < 50 → "critical"

Для каждой зоны сформируй dataBreakdown — массив из 2–5 строк с конкретными числовыми показателями, питающими зону (напр. "Внимание: 78", "K/D: 1.42", "Стресс: 6.2/10").

Верни JSON-объект строго в формате:
\`\`\`json
{
  "report": "3-5 абзацев текстового анализа на русском, объясняющего взаимосвязи между зонами",
  "zones": {
    "head": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] },
    "eyes": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] },
    "chest": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] },
    "arms": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] },
    "back": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] },
    "legs": { "score": 0-100, "label": "краткий ярлык", "description": "детальное объяснение", "severity": "ok|warning|critical", "dataBreakdown": ["показатель 1", "показатель 2"] }
  },
  "recommendations": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}
\`\`\`
Не пиши ничего вне блока \`\`\`json ... \`\`\`.`;

  // Only numeric/date fields — no free-text strings to prevent prompt injection
  const sanitizedMood = data.moodEntries.slice(0, 14).map((e) => ({
    date: e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10),
    mood: Number(e.mood),
    energy: Number(e.energy),
  }));

  const sanitizedBalanceWheel = data.latestBalanceWheel
    ? {
        physical: Number(data.latestBalanceWheel.physical ?? 0),
        emotional: Number(data.latestBalanceWheel.emotional ?? 0),
        intellectual: Number(data.latestBalanceWheel.intellectual ?? 0),
        spiritual: Number(data.latestBalanceWheel.spiritual ?? 0),
        occupational: Number(data.latestBalanceWheel.occupational ?? 0),
        social: Number(data.latestBalanceWheel.social ?? 0),
        environmental: Number(data.latestBalanceWheel.environmental ?? 0),
        financial: Number(data.latestBalanceWheel.financial ?? 0),
      }
    : null;

  const sanitizedScreenTime = data.screenTimeLast7.map((s) => ({
    date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10),
    totalTime: Number(s.totalTime ?? 0),
    entertainment: Number(s.entertainment ?? 0),
    study: Number(s.study ?? 0),
  }));

  const sanitizedGameStats = data.gameStatsSummary
    ? {
        winRate: Number(data.gameStatsSummary.winRate ?? 0),
        kdRatio: Number(data.gameStatsSummary.kdRatio ?? 0),
        adr: Number(data.gameStatsSummary.adr ?? 0),
        totalMatches: Number(data.gameStatsSummary.totalMatches ?? 0),
      }
    : null;

  // brainDomainScores: keys are known enum values from the model
  const ALLOWED_DOMAINS = ['attention', 'reaction_inhibition', 'working_memory', 'flexibility', 'visuospatial'] as const;
  const sanitizedBrainScores: Record<string, number> = {};
  if (data.brainDomainScores && typeof data.brainDomainScores === 'object') {
    for (const domain of ALLOWED_DOMAINS) {
      const val = (data.brainDomainScores as Record<string, unknown>)[domain];
      if (val !== undefined) sanitizedBrainScores[domain] = Number(val);
    }
  }

  // stateSnapshots: only numeric fields
  const sanitizedSnapshots = data.stateSnapshots.slice(0, 5).map((s: any) => ({
    fatigue: Number(s.fatigue ?? 0),
    focus: Number(s.focus ?? 0),
    stress: Number(s.stress ?? 0),
    sleepHours: Number(s.sleepHours ?? 0),
    mood: Number(s.mood ?? 0),
    energy: Number(s.energy ?? 0),
  }));

  const user = JSON.stringify(
    {
      moodEntries: sanitizedMood,
      latestBalanceWheel: sanitizedBalanceWheel,
      screenTimeLast7: sanitizedScreenTime,
      gameStatsSummary: sanitizedGameStats,
      brainDomainScores: sanitizedBrainScores,
      stateSnapshots: sanitizedSnapshots,
    },
    null,
    2,
  );

  return { system, user };
};

// ─── parse AI response ───────────────────────────────────────────────────────

const ZONES: BodyZone[] = ['head', 'eyes', 'chest', 'arms', 'back', 'legs'];

const parseAiResponse = (
  parsed: Record<string, unknown>,
  data: AggregatedPlayerData,
  model: string,
): PlayerStateReport => {
  const fallback = buildFallbackAnalysis(data);

  const rawZones = parsed.zones as Record<string, Record<string, unknown>> | null;
  const zones: Record<BodyZone, ZoneData> = {} as Record<BodyZone, ZoneData>;

  for (const zone of ZONES) {
    const z = rawZones?.[zone];
    if (z && typeof z === 'object') {
      const score = clamp(Number(z.score ?? 50));
      const severity = (['ok', 'warning', 'critical'] as ZoneSeverity[]).includes(
        z.severity as ZoneSeverity,
      )
        ? (z.severity as ZoneSeverity)
        : toSeverity(score);
      const label = String(z.label ?? '').trim().slice(0, 50) || fallback.zones[zone].label;
      const description = String(z.description ?? '').trim().slice(0, 500) || fallback.zones[zone].description;
      const rawBreakdown = z.dataBreakdown;
      const dataBreakdown: string[] = Array.isArray(rawBreakdown)
        ? rawBreakdown
            .map((item) => String(item ?? '').trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 5)
        : fallback.zones[zone].dataBreakdown;
      zones[zone] = { score, label, description, severity, dataBreakdown };
    } else {
      zones[zone] = fallback.zones[zone];
    }
  }

  const rawRecs = parsed.recommendations;
  const recommendations = Array.isArray(rawRecs)
    ? rawRecs
        .map((r) => String(r ?? '').trim())
        .filter(Boolean)
        .slice(0, 3)
    : fallback.recommendations;

  return {
    report:
      String(parsed.report ?? '').trim().slice(0, 5000) || fallback.report,
    zones,
    recommendations,
    dataUsed: fallback.dataUsed,
    generatedAt: new Date().toISOString(),
    model,
  };
};

// ─── public API ──────────────────────────────────────────────────────────────

export const generatePlayerStateReport = async (
  userId: mongoose.Types.ObjectId | string,
): Promise<PlayerStateReport> => {
  const data = await aggregatePlayerData(userId);

  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[PlayerStateAI] OPENROUTER_API_KEY не задан, используется fallback анализ');
    return buildFallbackAnalysis(data);
  }

  const prompt = buildPrompt(data);

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: DEFAULT_MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_SITE_NAME ?? 'Esports Mood Tracker',
        },
        timeout: 45000,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    const parsed =
      typeof content === 'string' ? extractJsonObject(content) : null;

    if (!parsed) {
      console.error('[PlayerStateAI] Не удалось распарсить ответ AI, используется fallback');
      return buildFallbackAnalysis(data);
    }

    return parseAiResponse(parsed, data, response.data?.model ?? DEFAULT_MODEL);
  } catch (error) {
    console.error('[PlayerStateAI] Ошибка запроса к OpenRouter:', error);
    return buildFallbackAnalysis(data);
  }
};
