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

const hasFaceitApiKey = (): boolean => {
  const normalized = FACEIT_API_KEY.trim();
  if (!normalized) {
    return false;
  }

  const placeholders = ['ваш_ключ_faceit_api', 'YOUR_FACEIT_API_KEY'];
  return !placeholders.includes(normalized);
};

const normalizeFaceitInput = (value: string): string => value.trim();

const extractIdentifierFromFaceitInput = (value: string): string | null => {
  const normalized = normalizeFaceitInput(value);
  if (!normalized) {
    return null;
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
export const getPlayerMatchHistory = async (faceitId: string, limit: number = 20): Promise<any> => {
  try {
    if (!hasFaceitApiKey()) {
      throw new Error('FACEIT_API_KEY не настроен на сервере');
    }
    const response = await faceitApiClient.get(`/players/${faceitId}/history`, {
      params: { limit }
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
    
    // Импортируем каждый матч
    for (const matchData of matches) {
      // Проверяем, существует ли уже матч в базе
      const existingMatch = await Match.findOne({ matchId: matchData.match_id });
      
      if (!existingMatch) {
        // Определяем результат матча
        let result = 'draw';
        if (matchData.results && matchData.results.length > 0) {
          const playerResult = matchData.results.find((r: any) => r.player_id === faceitAccount.faceitId);
          if (playerResult) {
            result = playerResult.outcome === 'win' ? 'win' : 'loss';
          }
        }
        
        // Создаем новую запись о матче
        await Match.create({
          faceitAccountId: faceitAccount._id,
          matchId: matchData.match_id,
          gameType: matchData.game_type || 'unknown',
          map: matchData.map || 'unknown',
          result,
          eloBefore: matchData.elo_before || 0,
          eloAfter: matchData.elo_after || 0,
          playedAt: new Date(matchData.played_at * 1000 || Date.now()),
          rawData: matchData
        });
        
        importedCount++;
      }
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
  saveFaceitAccount,
  importMatches
}; 
