import faceitService from './faceitService';
import analyticsService from './analyticsService';
import FaceitAccount from '../models/FaceitAccount';
import User from '../models/User';
import cronService from './cronService';

/**
 * Автоматическая синхронизация матчей для всех пользователей
 * @returns Количество импортированных матчей
 */
export const syncAllUserMatches = async (): Promise<{ users: number, matches: number }> => {
  try {
    // Получаем всех пользователей с подключенными аккаунтами Faceit
    const users = await User.find({ faceitAccountId: { $ne: null } });
    
    let totalMatches = 0;
    
    // Для каждого пользователя импортируем матчи
    for (const user of users) {
      if (user.faceitAccountId) {
        try {
          const imported = await faceitService.importMatches(user.faceitAccountId);
          totalMatches += imported;
          console.log(`Импортировано ${imported} матчей для пользователя ${user._id}`);
        } catch (error) {
          console.error(`Ошибка при импорте матчей для пользователя ${user._id}:`, error);
        }
      }
    }
    
    // Обновляем кэш аналитики после импорта
    if (totalMatches > 0) {
      await analyticsService.updateAnalyticsCache();
    }
    
    return { users: users.length, matches: totalMatches };
  } catch (error) {
    console.error('Ошибка при синхронизации матчей всех пользователей:', error);
    throw new Error('Не удалось синхронизировать матчи пользователей');
  }
};

/**
 * Обновляет токены для аккаунтов, у которых они почти истекли
 * @returns Количество обновленных аккаунтов
 */
export const refreshExpiredTokens = async (): Promise<number> => {
  try {
    // Находим аккаунты, токены которых истекают в течение 1 часа
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const accounts = await FaceitAccount.find({
      tokenExpiresAt: { $lt: oneHourFromNow },
      refreshToken: { $exists: true, $ne: '' }
    });
    
    let updatedCount = 0;
    
    // Обновляем токены для каждого аккаунта
    for (const account of accounts) {
      try {
        // Получаем данные клиента из переменных окружения
        const clientId = process.env.FACEIT_CLIENT_ID || '';
        const clientSecret = process.env.FACEIT_CLIENT_SECRET || '';
        
        if (!clientId || !clientSecret) {
          throw new Error('Не настроены FACEIT_CLIENT_ID или FACEIT_CLIENT_SECRET');
        }
        
        // Обновляем токен
        const tokensData = await faceitService.refreshAccessToken(
          account.refreshToken,
          clientId,
          clientSecret
        );
        
        // Вычисляем новую дату истечения токена
        const tokenExpiresAt = new Date();
        tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + tokensData.expires_in);
        
        // Обновляем данные в базе
        account.accessToken = tokensData.access_token;
        account.refreshToken = tokensData.refresh_token;
        account.tokenExpiresAt = tokenExpiresAt;
        await account.save();
        
        updatedCount++;
      } catch (error) {
        console.error(`Ошибка при обновлении токена для аккаунта ${account._id}:`, error);
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('Ошибка при обновлении истекших токенов:', error);
    throw new Error('Не удалось обновить истекшие токены');
  }
};

/**
 * Инициализирует регулярные задачи для синхронизации с Faceit
 */
export const initFaceitSync = (): void => {
  try {
    // Синхронизируем матчи каждые 6 часов
    cronService.addTask(
      'faceit-sync-matches',
      '0 */6 * * *',
      async () => {
        console.log('Запускаем синхронизацию матчей для всех пользователей...');
        try {
          const result = await syncAllUserMatches();
          console.log(`Синхронизация завершена: обработано ${result.users} пользователей, импортировано ${result.matches} матчей`);
        } catch (error) {
          console.error('Ошибка при запланированной синхронизации матчей:', error);
        }
      }
    );
    
    // Обновляем токены каждый час
    cronService.addTask(
      'faceit-refresh-tokens',
      '0 * * * *',
      async () => {
        console.log('Запускаем обновление истекающих токенов...');
        try {
          const updatedCount = await refreshExpiredTokens();
          console.log(`Обновление токенов завершено: обновлено ${updatedCount} аккаунтов`);
        } catch (error) {
          console.error('Ошибка при запланированном обновлении токенов:', error);
        }
      }
    );
    
    console.log('Задачи синхронизации с Faceit инициализированы');
  } catch (error) {
    console.error('Ошибка при инициализации задач синхронизации с Faceit:', error);
  }
};

export default {
  syncAllUserMatches,
  refreshExpiredTokens,
  initFaceitSync
}; 
