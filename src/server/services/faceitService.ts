import axios from 'axios';
import FaceitAccount from '../models/FaceitAccount';
import Match from '../models/Match';
import User from '../models/User';
import { Types } from 'mongoose';

// Конфигурация Faceit API
const FACEIT_API_KEY = process.env.FACEIT_API_KEY || '';
const FACEIT_API_URL = 'https://open.faceit.com/data/v4';
const FACEIT_AUTH_URL = 'https://api.faceit.com/auth/v1';

export interface FaceitProfileInfo {
  faceitId: string;
  nickname: string;
  elo: number | null;
  rawData: any;
}

export interface FaceitDailyStatsPoint {
  date: string;
  matches: number;
  elo: number | null;
  eloChange: number | null;
  kdRatio: number | null;
  adr: number | null;
  kast: number | null;
  kr: number | null;
  hsPercent: number | null;
  winRate: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

type FaceitStatsRecord = Record<string, unknown>;

const hasFaceitApiKey = (): boolean => {
  const normalized = FACEIT_API_KEY.trim();
  if (!normalized) {
    return false;
  }

  const placeholders = ['ваш_ключ_faceit_api', 'YOUR_FACEIT_API_KEY'];
  return !placeholders.includes(normalized);
};

const normalizeFaceitInput = (value: string): string => value.trim();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const extractIdentifierFromFaceitInput = (value: string): string | null => {
  const normalized = normalizeFaceitInput(value);
  if (!normalized) {
    return null;
  }

  // Если вход — UUID (faceitId), вернуть как есть
  if (UUID_RE.test(normalized)) {
    return normalized;
  }

  const tryParseUrl = (input: string): URL | null => {
    try {
      return new URL(input);
    } catch {
      try {
        return new URL(`https://${input}`);
      } catch {
        return null;
      }
    }
  };

  const parsedUrl = tryParseUrl(normalized);
  if (!parsedUrl) {
    return normalized.replace(/^@/, '').trim() || null;
  }

  if (!/faceit\.com$/i.test(parsedUrl.hostname) && !/\.faceit\.com$/i.test(parsedUrl.hostname)) {
    return null;
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const playersIndex = segments.findIndex((segment) => segment.toLowerCase() === 'players');
  if (playersIndex !== -1 && segments[playersIndex + 1]) {
    return decodeURIComponent(segments[playersIndex + 1]).trim() || null;
  }

  if (segments.length > 0) {
    return decodeURIComponent(segments[segments.length - 1]).trim() || null;
  }

  return null;
};

const parseFaceitProfile = (data: any): FaceitProfileInfo => {
  const faceitId = data?.player_id || data?.guid || data?.id;
  const nickname = data?.nickname || data?.game_player_name || '';
  const eloFromCs2 = data?.games?.cs2?.faceit_elo;
  const eloFromCsgo = data?.games?.csgo?.faceit_elo;
  const eloValue = Number.isFinite(eloFromCs2)
    ? eloFromCs2
    : (Number.isFinite(eloFromCsgo) ? eloFromCsgo : null);

  if (!faceitId || !nickname) {
    throw new Error('Не удалось получить корректный профиль Faceit');
  }

  return {
    faceitId: String(faceitId),
    nickname: String(nickname),
    elo: eloValue === null ? null : Number(eloValue),
    rawData: data
  };
};

const parseFaceitNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/%/g, '')
      .replace(/,/g, '.')
      .trim();

    if (!normalized || normalized === '-') {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeFaceitStatKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const pickFaceitStatNumber = (stats: FaceitStatsRecord, keys: string[]): number | null => {
  const normalizedEntries = Object.entries(stats).map(([key, value]) => ({
    normalizedKey: normalizeFaceitStatKey(key),
    value
  }));

  for (const key of keys) {
    const parsed = parseFaceitNumericValue(stats[key]);
    if (parsed !== null) {
      return parsed;
    }

    const normalizedKey = normalizeFaceitStatKey(key);
    const normalizedMatch = normalizedEntries.find((entry) => entry.normalizedKey === normalizedKey);
    if (normalizedMatch) {
      const normalizedParsed = parseFaceitNumericValue(normalizedMatch.value);
      if (normalizedParsed !== null) {
        return normalizedParsed;
      }
    }
  }

  return null;
};

const pickFaceitStatString = (stats: FaceitStatsRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const resolveFaceitStatsObject = (item: any): FaceitStatsRecord => {
  if (item?.stats && typeof item.stats === 'object') {
    return item.stats as FaceitStatsRecord;
  }

  if (item?.player_stats && typeof item.player_stats === 'object') {
    return item.player_stats as FaceitStatsRecord;
  }

  return {};
};

const resolveFaceitStatsDate = (item: any, stats: FaceitStatsRecord): Date | null => {
  const candidates = [
    item?.played,
    item?.finished_at,
    item?.started_at,
    item?.played_at,
    item?.date,
    stats['Match Finished At'],
    stats['Date'],
    stats['Played'],
    stats['Updated At']
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const value = candidate > 1_000_000_000_000 ? candidate : candidate * 1000;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      const numericCandidate = Number(candidate);
      if (Number.isFinite(numericCandidate)) {
        const value = numericCandidate > 1_000_000_000_000 ? numericCandidate : numericCandidate * 1000;
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }

      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
};

// API клиент для запросов к Faceit
const faceitApiClient = axios.create({
  baseURL: FACEIT_API_URL,
  headers: {
    'Authorization': `Bearer ${FACEIT_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Разрешает ссылку/ник Faceit в профиль игрока
 * @param faceitInput - Ссылка на профиль Faceit, ник или идентификатор
 * @returns Профиль игрока Faceit
 */
export const resolveFaceitProfile = async (faceitInput: string): Promise<FaceitProfileInfo> => {
  if (!hasFaceitApiKey()) {
    throw new Error('FACEIT_API_KEY не настроен на сервере');
  }

  const identifier = extractIdentifierFromFaceitInput(faceitInput);
  if (!identifier) {
    throw new Error('Некорректная ссылка или идентификатор Faceit');
  }

  const isUuid = UUID_RE.test(identifier);

  // Если UUID — сразу ищем по ID (пропускаем поиск по нику)
  if (!isUuid) {
    try {
      const byNickname = await faceitApiClient.get('/players', {
        params: { nickname: identifier }
      });
      return parseFaceitProfile(byNickname.data);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status && status !== 404) {
        throw new Error('Не удалось получить данные Faceit по нику');
      }
    }
  }

  try {
    const byId = await faceitApiClient.get(`/players/${encodeURIComponent(identifier)}`);
    return parseFaceitProfile(byId.data);
  } catch (error) {
    console.error('Ошибка при разрешении профиля Faceit:', error);
    throw new Error('Профиль Faceit не найден');
  }
};

/**
 * Инициализирует процесс OAuth авторизации
 * @param clientId - ID клиента Faceit
 * @param redirectUri - URI для перенаправления после авторизации
 * @returns URL для перенаправления пользователя
 */
export const initOAuth = (clientId: string, redirectUri: string): string => {
  if (!clientId || clientId === 'YOUR_FACEIT_CLIENT_ID') {
    throw new Error('Некорректный FACEIT_CLIENT_ID. Необходимо указать действительный идентификатор клиента FACEIT в переменных окружения.');
  }

  const scope = 'openid profile email';
  const state = Math.random().toString(36).substring(2, 15);
  
  const authUrl = `https://accounts.faceit.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  // Логируем URL для отладки
  console.log(`FACEIT AUTH URL: ${authUrl}`);
  
  return authUrl;
};

/**
 * Обменивает код авторизации на токены доступа
 * @param code - Код авторизации от Faceit
 * @param clientId - ID клиента Faceit
 * @param clientSecret - Секрет клиента Faceit
 * @param redirectUri - URI перенаправления
 * @returns Объект с токенами доступа
 */
export const exchangeCodeForTokens = async (
  code: string, 
  clientId: string, 
  clientSecret: string, 
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> => {
  try {
    const response = await axios.post(`${FACEIT_AUTH_URL}/token`, {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при обмене кода на токены:', error);
    throw new Error('Не удалось получить токены доступа Faceit');
  }
};

/**
 * Обновляет токен доступа с помощью refresh token
 * @param refreshToken - Refresh токен
 * @param clientId - ID клиента Faceit
 * @param clientSecret - Секрет клиента Faceit
 * @returns Новый объект с токенами доступа
 */
export const refreshAccessToken = async (
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> => {
  try {
    const response = await axios.post(`${FACEIT_AUTH_URL}/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при обновлении токена доступа:', error);
    throw new Error('Не удалось обновить токен доступа Faceit');
  }
};

/**
 * Получает информацию о пользователе Faceit
 * @param accessToken - Токен доступа
 * @returns Данные пользователя Faceit
 */
export const getUserInfo = async (accessToken: string): Promise<any> => {
  try {
    const response = await axios.get(`${FACEIT_AUTH_URL}/resources/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о пользователе Faceit:', error);
    throw new Error('Не удалось получить информацию о пользователе Faceit');
  }
};

/**
 * Получает историю матчей игрока
 * @param faceitId - ID игрока на Faceit
 * @param limit - Лимит матчей (по умолчанию 20)
 * @returns Список матчей
 */
export const getPlayerMatchHistory = async (faceitId: string, limit: number = 20, game: string = 'cs2'): Promise<any> => {
  try {
    if (!hasFaceitApiKey()) {
      throw new Error('FACEIT_API_KEY не настроен на сервере');
    }
    const response = await faceitApiClient.get(`/players/${faceitId}/history`, {
      params: { limit, game }
    });

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении истории матчей:', error);
    throw new Error('Не удалось получить историю матчей Faceit');
  }
};

/**
 * Получает детали матча
 * @param matchId - ID матча на Faceit
 * @returns Детали матча
 */
export const getMatchDetails = async (matchId: string): Promise<any> => {
  try {
    if (!hasFaceitApiKey()) {
      throw new Error('FACEIT_API_KEY не настроен на сервере');
    }
    const response = await faceitApiClient.get(`/matches/${matchId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении деталей матча:', error);
    throw new Error('Не удалось получить детали матча Faceit');
  }
};

/**
 * Получает статистику матча
 * @param matchId - ID матча на Faceit
 * @returns Статистика матча
 */
export const getMatchStats = async (matchId: string): Promise<any> => {
  try {
    if (!hasFaceitApiKey()) {
      throw new Error('FACEIT_API_KEY не настроен на сервере');
    }
    const response = await faceitApiClient.get(`/matches/${matchId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики матча:', error);
    throw new Error('Не удалось получить статистику матча Faceit');
  }
};

/**
 * Получает матч-статы игрока по игре и периоду
 * @param faceitId - ID игрока на Faceit
 * @param game - Игра (по умолчанию cs2)
 * @param fromDate - Начало периода
 * @param toDate - Конец периода
 * @returns Сырые элементы матч-статы Faceit
 */
export const getPlayerGameStats = async (
  faceitId: string,
  game: string = 'cs2',
  fromDate?: Date,
  toDate?: Date
): Promise<any[]> => {
  try {
    if (!hasFaceitApiKey()) {
      throw new Error('FACEIT_API_KEY не настроен на сервере');
    }

    const limit = 100;
    const maxItems = 500;
    const items: any[] = [];
    let offset = 0;

    while (offset < maxItems) {
      const response = await faceitApiClient.get(`/players/${faceitId}/games/${game}/stats`, {
        params: {
          limit,
          offset,
          from: fromDate ? fromDate.getTime() : undefined,
          to: toDate ? toDate.getTime() : undefined
        }
      });

      const chunk = Array.isArray(response.data?.items) ? response.data.items : [];
      items.push(...chunk);

      if (chunk.length < limit) {
        break;
      }

      offset += limit;
    }

    return items;
  } catch (error) {
    console.error('Ошибка при получении статистики игрока Faceit:', error);
    throw new Error('Не удалось получить статистику игрока Faceit');
  }
};

/**
 * Собирает дневные агрегаты Faceit по матч-статам игрока
 * @param faceitId - ID игрока на Faceit
 * @param fromDate - Начало периода
 * @param toDate - Конец периода
 * @param game - Игра (по умолчанию cs2)
 * @returns Дневные агрегаты по матчам
 */
export const getPlayerDailyStats = async (
  faceitId: string,
  fromDate?: Date,
  toDate?: Date,
  game: string = 'cs2'
): Promise<FaceitDailyStatsPoint[]> => {
  const items = await getPlayerGameStats(faceitId, game, fromDate, toDate);

  const dataByDate = new Map<string, {
    date: string;
    matches: number;
    latestTimestamp: number;
    latestElo: number | null;
    eloChangeSum: number;
    eloChangeCount: number;
    kills: number;
    deaths: number;
    assists: number;
    kdRatioSum: number;
    kdRatioCount: number;
    adrSum: number;
    adrCount: number;
    kastSum: number;
    kastCount: number;
    krSum: number;
    krCount: number;
    hsPercentSum: number;
    hsPercentCount: number;
    winRateSum: number;
    winRateCount: number;
  }>();

  items.forEach((item: any) => {
    const stats = resolveFaceitStatsObject(item);
    const matchDate = resolveFaceitStatsDate(item, stats);
    if (!matchDate) {
      return;
    }

    const dateKey = matchDate.toISOString().split('T')[0];
    if (!dataByDate.has(dateKey)) {
      dataByDate.set(dateKey, {
        date: dateKey,
        matches: 0,
        latestTimestamp: 0,
        latestElo: null,
        eloChangeSum: 0,
        eloChangeCount: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        kdRatioSum: 0,
        kdRatioCount: 0,
        adrSum: 0,
        adrCount: 0,
        kastSum: 0,
        kastCount: 0,
        krSum: 0,
        krCount: 0,
        hsPercentSum: 0,
        hsPercentCount: 0,
        winRateSum: 0,
        winRateCount: 0
      });
    }

    const bucket = dataByDate.get(dateKey)!;
    bucket.matches += 1;

    const kills = pickFaceitStatNumber(stats, ['Kills', 'Average Kills']);
    const deaths = pickFaceitStatNumber(stats, ['Deaths', 'Average Deaths']);
    const assists = pickFaceitStatNumber(stats, ['Assists', 'Average Assists']);
    const kdRatio = pickFaceitStatNumber(stats, [
      'K/D Ratio',
      'Average K/D Ratio',
      'Average K/D',
      'KDRatio',
      'AverageKDRatio'
    ]);
    const adr = pickFaceitStatNumber(stats, [
      'ADR',
      'Average ADR',
      'Average Damage per Round',
      'AverageDamagePerRound'
    ]);
    const kast = pickFaceitStatNumber(stats, [
      'KAST',
      'KAST %',
      'Average KAST',
      'Average KAST %'
    ]);
    const kr = pickFaceitStatNumber(stats, [
      'K/R Ratio',
      'K/R',
      'Kills per Round',
      'Average K/R Ratio',
      'Average K/R',
      'Average Kills per Round'
    ]);
    const hsPercent = pickFaceitStatNumber(stats, [
      'Headshots %',
      'HS%',
      'Headshot Percentage',
      'Average Headshots %',
      'Average HS%'
    ]);
    const winRate = pickFaceitStatNumber(stats, [
      'Win Rate %',
      'Win Rate',
      'Win Percentage',
      'Average Win Rate'
    ]);
    const elo = pickFaceitStatNumber(stats, [
      'ELO',
      'Elo',
      'Faceit ELO',
      'Faceit Elo'
    ]);
    const eloChange = pickFaceitStatNumber(stats, [
      'ELO Change',
      'Elo Change',
      'ELO change',
      'Elo change',
      'Faceit ELO Change',
      'Faceit Elo Change'
    ]);
    const result = pickFaceitStatString(stats, ['Result', 'Match Result']);
    const timestamp = matchDate.getTime();

    if (elo !== null && timestamp >= bucket.latestTimestamp) {
      bucket.latestTimestamp = timestamp;
      bucket.latestElo = elo;
    }
    if (eloChange !== null) {
      bucket.eloChangeSum += eloChange;
      bucket.eloChangeCount += 1;
    }

    if (kills !== null) {
      bucket.kills += kills;
    }
    if (deaths !== null) {
      bucket.deaths += deaths;
    }
    if (assists !== null) {
      bucket.assists += assists;
    }
    if (kdRatio !== null) {
      bucket.kdRatioSum += kdRatio;
      bucket.kdRatioCount += 1;
    }
    if (adr !== null) {
      bucket.adrSum += adr;
      bucket.adrCount += 1;
    }
    if (kast !== null) {
      bucket.kastSum += kast;
      bucket.kastCount += 1;
    }
    if (kr !== null) {
      bucket.krSum += kr;
      bucket.krCount += 1;
    }
    if (hsPercent !== null) {
      bucket.hsPercentSum += hsPercent;
      bucket.hsPercentCount += 1;
    }
    if (winRate !== null) {
      bucket.winRateSum += winRate;
      bucket.winRateCount += 1;
    } else if (result) {
      const normalized = result.toLowerCase();
      if (normalized.includes('win') || normalized === '1') {
        bucket.winRateSum += 100;
        bucket.winRateCount += 1;
      } else if (normalized.includes('loss') || normalized === '0') {
        bucket.winRateCount += 1;
      }
    }
  });

  return Array.from(dataByDate.values())
    .map((day) => ({
      date: day.date,
      matches: day.matches,
      elo: day.latestElo,
      eloChange: day.eloChangeCount ? Number(day.eloChangeSum.toFixed(0)) : null,
      kdRatio: day.kdRatioCount ? Number((day.kdRatioSum / day.kdRatioCount).toFixed(2)) : null,
      adr: day.adrCount ? Number((day.adrSum / day.adrCount).toFixed(1)) : null,
      kast: day.kastCount ? Number((day.kastSum / day.kastCount).toFixed(1)) : null,
      kr: day.krCount ? Number((day.krSum / day.krCount).toFixed(2)) : null,
      hsPercent: day.hsPercentCount ? Number((day.hsPercentSum / day.hsPercentCount).toFixed(1)) : null,
      winRate: day.winRateCount ? Number((day.winRateSum / day.winRateCount).toFixed(1)) : null,
      kills: Number(day.kills.toFixed(1)),
      deaths: Number(day.deaths.toFixed(1)),
      assists: Number(day.assists.toFixed(1))
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Сохраняет токены и информацию о пользователе Faceit в базу данных
 * @param userId - ID пользователя
 * @param faceitId - ID пользователя на Faceit
 * @param accessToken - Токен доступа
 * @param refreshToken - Refresh токен
 * @param expiresIn - Время жизни токена в секундах
 * @returns Созданный или обновленный документ FaceitAccount
 */
export const saveFaceitAccount = async (
  userId: string,
  faceitId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<any> => {
  try {
    // Вычисляем дату истечения токена
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expiresIn);
    
    // Проверяем, существует ли уже запись об аккаунте Faceit для данного пользователя
    let faceitAccount = await FaceitAccount.findOne({ userId });
    
    if (faceitAccount) {
      // Обновляем существующую запись
      faceitAccount.faceitId = faceitId;
      faceitAccount.accessToken = accessToken;
      faceitAccount.refreshToken = refreshToken;
      faceitAccount.tokenExpiresAt = tokenExpiresAt;
      await faceitAccount.save();
    } else {
      // Создаем новую запись
      faceitAccount = await FaceitAccount.create({
        userId,
        faceitId,
        accessToken,
        refreshToken,
        tokenExpiresAt
      });
      
      // Обновляем поле faceitAccountId в модели пользователя
      await User.findByIdAndUpdate(userId, { faceitAccountId: faceitAccount._id });
    }

    // Гарантируем синхронизацию связи в профиле пользователя
    await User.findByIdAndUpdate(userId, { faceitAccountId: faceitAccount._id });
    
    return faceitAccount;
  } catch (error) {
    console.error('Ошибка при сохранении аккаунта Faceit:', error);
    throw new Error('Не удалось сохранить аккаунт Faceit');
  }
};

/**
 * Импортирует новые матчи пользователя
 * @param faceitAccountId - ID аккаунта Faceit
 * @returns Количество импортированных матчей
 */
export const importMatches = async (faceitAccountId: string | Types.ObjectId): Promise<number> => {
  try {
    // Получаем аккаунт Faceit
    const faceitAccount = await FaceitAccount.findById(faceitAccountId);
    if (!faceitAccount) {
      throw new Error('Аккаунт Faceit не найден');
    }
    
    // Получаем историю матчей
    const matchHistory = await getPlayerMatchHistory(faceitAccount.faceitId, 50);
    const matches = matchHistory.items || [];
    
    let importedCount = 0;

    // Импортируем каждый матч (upsert — корректируем уже сохранённые записи при повторном импорте)
    for (const matchData of matches) {
      if (!matchData.match_id) continue;

      // Определяем результат матча.
      // FACEIT history API возвращает results как объект { winner: 'factionN', score: {...} },
      // а игроки находятся в teams.factionN.players[].player_id
      let result = 'draw';
      if (matchData.results?.winner && matchData.teams) {
        const winner: string = matchData.results.winner;
        let playerFaction: string | null = null;
        for (const [factionName, faction] of Object.entries(matchData.teams as Record<string, any>)) {
          const players: any[] = faction.players || [];
          if (players.some((p: any) => p.player_id === faceitAccount.faceitId)) {
            playerFaction = factionName;
            break;
          }
        }
        if (playerFaction) {
          result = playerFaction === winner ? 'win' : 'loss';
        }
      }

      // FACEIT history API использует started_at/finished_at (Unix секунды), поля played_at нет.
      // elo_before/elo_after отсутствуют в Open Data API истории — оставляем 0.
      const playedAtMs = (matchData.started_at || matchData.finished_at || 0) * 1000;
      const playedAt = playedAtMs > 0 ? new Date(playedAtMs) : new Date();

      const wasNew = !(await Match.exists({ matchId: matchData.match_id }));

      await Match.findOneAndUpdate(
        { matchId: matchData.match_id },
        {
          $set: {
            faceitAccountId: faceitAccount._id,
            matchId: matchData.match_id,
            gameType: matchData.game_id || 'unknown',
            map: matchData.map || 'unknown',
            result,
            eloBefore: matchData.elo_before || 0,
            eloAfter: matchData.elo_after || 0,
            playedAt,
            rawData: matchData
          }
        },
        { upsert: true }
      );

      if (wasNew) importedCount++;
    }
    
    return importedCount;
  } catch (error) {
    console.error('Ошибка при импорте матчей:', error);
    throw new Error('Не удалось импортировать матчи Faceit');
  }
};

export default {
  initOAuth,
  exchangeCodeForTokens,
  refreshAccessToken,
  resolveFaceitProfile,
  getUserInfo,
  getPlayerMatchHistory,
  getMatchDetails,
  getMatchStats,
  getPlayerGameStats,
  getPlayerDailyStats,
  saveFaceitAccount,
  importMatches
};
