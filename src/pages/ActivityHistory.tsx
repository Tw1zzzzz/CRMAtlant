import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { COLORS, COMPONENT_STYLES } from '@/styles/theme';
import activityHistoryService, { ActivityHistoryItem, PaginationData } from '@/utils/activityHistoryService';
import { useAuth } from '@/hooks/useAuth';
import { ACTIVITY_TYPES, ENTITY_TYPES } from '@/lib/constants';
import { Clock, Filter, Calendar, User, Package, Activity, RefreshCw, Search, CalendarDays, Smile } from 'lucide-react';

/**
 * Компонент страницы истории активности
 */
const ActivityHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStaff = user?.role === 'staff';
  
  // Состояние для хранения активностей и пагинации
  const [activities, setActivities] = useState<ActivityHistoryItem[]>([]);
  const [monthlyActivities, setMonthlyActivities] = useState<ActivityHistoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 20,
    pages: 0
  });
  
  // Период для месячных данных
  const [monthlyPeriod, setMonthlyPeriod] = useState<{
    start: string;
    end: string;
  }>({
    start: '',
    end: ''
  });
  
  // Фильтры (для персонала)
  const [userFilter, setUserFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  
  // Состояние загрузки и ошибок
  const [loading, setLoading] = useState<boolean>(true);
  const [monthlyLoading, setMonthlyLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  
  // Активный таб
  const [activeTab, setActiveTab] = useState<string>('all');
  
  // Загрузка данных при монтировании и при изменении фильтров/пагинации
  useEffect(() => {
    console.log('Запуск эффекта загрузки, activeTab:', activeTab);
    if (activeTab === 'all') {
      fetchActivities();
    } else if (activeTab === 'monthly' && isStaff) {
      fetchMonthlyActivities();
    }
  }, [pagination.page, userFilter, actionFilter, entityTypeFilter, activeTab]);
  
  // Установка начального таба при загрузке компонента - запускается только один раз при монтировании
  useEffect(() => {
    console.log('Компонент активности загружен. Пользователь персонал:', isStaff);
    
    // Устанавливаем активный таб при первой загрузке
    if (isStaff) {
      // Не нужно вызывать fetchActivities здесь, это будет сделано в первом useEffect
      // так как там есть зависимость от activeTab
      setActiveTab('all');
    } else {
      // Для обычных пользователей вкладок нет, сразу загружаем их активность
      fetchActivities();
    }
    // Пустой массив зависимостей - эффект выполнится только один раз при монтировании
  }, []);

  /**
   * Загрузка данных об активности
   */
  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (isStaff) {
        // Загрузка для персонала с возможностью фильтрации
        const response = await activityHistoryService.getAllActivity(
          pagination.page,
          pagination.limit,
          userFilter === 'all' ? '' : userFilter,
          actionFilter === 'all' ? '' as any : actionFilter as any,
          entityTypeFilter === 'all' ? '' as any : entityTypeFilter as any
        );
        
        setActivities(response.activities);
        setPagination(response.pagination);
        setUsers(response.users);
      } else {
        // Загрузка для обычного пользователя
        const response = await activityHistoryService.getUserActivity(
          pagination.page,
          pagination.limit
        );
        
        setActivities(response.activities);
        setPagination(response.pagination);
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке истории активности:', error);
      setError(error.response?.data?.message || 'Не удалось загрузить историю активности');
      
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить историю активности. Пожалуйста, попробуйте позже.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Загрузка месячной активности (для персонала)
   */
  const fetchMonthlyActivities = async () => {
    if (!isStaff) return;
    
    try {
      setMonthlyLoading(true);
      setMonthlyError(null);
      
      console.log('[ActivityHistory] Запрос месячной активности...');
      const response = await activityHistoryService.getMonthlyActivity();
      
      // Проверка содержимого ответа для диагностики
      console.log('[ActivityHistory] Ответ API:', {
        received: !!response,
        hasActivities: !!response?.activities,
        activitiesCount: response?.activities?.length || 0,
        firstActivity: response?.activities?.[0] 
          ? { 
              id: response.activities[0]._id,
              action: response.activities[0].action,
              entityType: response.activities[0].entityType,
              userIdType: typeof response.activities[0].userId
            } 
          : 'нет записей'
      });
      
      // Проверяем структуру данных
      if (!response || !response.activities) {
        console.error('[ActivityHistory] Отсутствуют данные об активности в ответе', response);
        throw new Error('Данные об активности не получены');
      }
      
      console.log(`[ActivityHistory] Загружено ${response.activities.length} записей активности`);
      
      // Проверяем все поля записей и их типы
      let invalidRecords = 0;
      let moodTrackRecords = 0;
      
      const normalizedActivities = response.activities.map((activity, index) => {
        try {
          // Проверка на наличие mood_track записей
          if (activity.action === 'mood_track') {
            moodTrackRecords++;
            console.log('[ActivityHistory] Найдена запись mood_track:', {
              id: activity._id,
              userId: typeof activity.userId === 'object' ? 
                (activity.userId?._id || 'Объект без _id') : 
                activity.userId,
              details: activity.details,
              timestamp: activity.timestamp
            });
          }
          
          // Проверяем структуру userId
          if (!activity.userId) {
            console.warn(`[ActivityHistory] Запись ${index} без userId:`, activity);
            invalidRecords++;
            
            // Создаем заглушку для userId
            return {
              ...activity,
              userId: {
                _id: 'unknown',
                name: 'Пользователь без ID',
                email: 'нет данных',
                role: 'user'
              }
            };
          }
          
          // Если userId это строка или ObjectId, а не объект
          if (typeof activity.userId !== 'object' || !activity.userId.name) {
            console.warn(`[ActivityHistory] Запись ${index} с некорректным userId:`, 
              typeof activity.userId, activity.userId);
            
            invalidRecords++;
            
            // Нормализуем userId
            return {
              ...activity,
              userId: {
                _id: typeof activity.userId === 'string' ? activity.userId : 
                      typeof activity.userId === 'object' && activity.userId._id ? 
                      activity.userId._id.toString() : 'unknown',
                name: 'Неизвестный пользователь',
                email: 'нет данных',
                role: 'user'
              }
            };
          }
          
          return activity;
        } catch (err) {
          console.error(`[ActivityHistory] Ошибка при обработке записи ${index}:`, err);
          invalidRecords++;
          
          // В случае ошибки обработки, возвращаем оригинальную запись
          return activity;
        }
      });
      
      console.log(`[ActivityHistory] Статистика обработки: 
        Всего записей: ${response.activities.length}
        Некорректных: ${invalidRecords}
        Записей о настроении: ${moodTrackRecords}`);
      
      // Сохраняем нормализованные данные
      setMonthlyActivities(normalizedActivities);
      
      // Сохраняем информацию о периоде
      if (response.period) {
        setMonthlyPeriod(response.period);
      }
    } catch (error: any) {
      console.error('[ActivityHistory] Ошибка при загрузке месячной активности:', error);
      setMonthlyError(error.response?.data?.message || 'Не удалось загрузить месячную активность');
      
      // Гарантируем, что у нас есть пустой массив активностей вместо undefined
      setMonthlyActivities([]);
      
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить месячную активность. Пожалуйста, попробуйте позже.',
        variant: 'destructive'
      });
    } finally {
      setMonthlyLoading(false);
    }
  };

  /**
   * Обработчик изменения страницы пагинации
   */
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  /**
   * Обработчик сброса фильтров
   */
  const handleResetFilters = () => {
    setUserFilter('all');
    setActionFilter('all');
    setEntityTypeFilter('all');
  };

  /**
   * Обработчик изменения таба
   */
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  /**
   * Форматирование даты периода
   */
  const formatPeriodDate = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      // Проверяем валидность даты
      if (isNaN(date.getTime())) {
        console.error('Некорректная дата:', dateString);
        return 'Некорректная дата';
      }
      
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Ошибка при форматировании даты:', error);
      return 'Ошибка формата даты';
    }
  };

  /**
   * Рендеринг элемента активности
   */
  const renderActivityItem = (activity: ActivityHistoryItem) => {
    // Проверяем наличие всех необходимых полей
    if (!activity || !activity._id) {
      console.warn('[ActivityHistory] Пропущен элемент активности из-за отсутствия _id', activity);
      return null;
    }
    
    // Проверяем структуру userId
    if (!activity.userId || typeof activity.userId !== 'object') {
      console.warn('[ActivityHistory] Некорректная структура userId в активности:', activity);
      
      // Пытаемся восстановить элемент активности с заглушкой для userId
      const fallbackActivity = {
        ...activity,
        userId: {
          _id: typeof activity.userId === 'string' ? activity.userId : 'unknown',
          name: 'Неизвестный пользователь',
          email: 'нет данных',
          role: 'user'
        }
      };
      
      // Продолжаем с восстановленным элементом
      activity = fallbackActivity as ActivityHistoryItem;
    }
    
    const timestamp = activityHistoryService.formatTimestamp(activity.timestamp);
    const actionName = activityHistoryService.getActionName(activity.action);
    const entityTypeName = activityHistoryService.getEntityTypeName(activity.entityType);
    
    // Получаем цвет фона для разных типов активности
    const getBgColor = () => {
      if (activity.action === 'mood_track') return COLORS.success + '15';
      if (activity.action === 'test_complete') return COLORS.primary + '15'; 
      if (activity.action === 'balance_wheel') return COLORS.info + '15';
      return 'transparent';
    };
    
    // Выводим дополнительную информацию о контексте действия (в зависимости от типа)
    let contextInfo = '';
    try {
      if (activity.details) {
        if (activity.action === 'mood_track' && activity.details.mood && activity.details.energy) {
          const timeOfDayText = 
            activity.details.timeOfDay === 'morning' ? 'Утро' : 
            activity.details.timeOfDay === 'afternoon' ? 'День' : 
            activity.details.timeOfDay === 'evening' ? 'Вечер' : 
            activity.details.timeOfDay;
            
          contextInfo = `Время суток: ${timeOfDayText}`;
        } else if (activity.action === 'test_complete' && activity.details.testName) {
          contextInfo = `Тест: ${activity.details.testName}`;
        } else if (activity.action === 'balance_wheel' && activity.details) {
          const wheelValues = Object.entries(activity.details)
            .filter(([key]) => !['date', 'userId', '_id'].includes(key))
            .map(([key, value]) => `${key}: ${value}`);
          if (wheelValues.length > 0) {
            contextInfo = `Значения: ${wheelValues.join(', ')}`;
          }
        }
      }
    } catch (error) {
      console.error('[ActivityHistory] Ошибка при обработке details активности:', error);
    }
    
    return (
      <div 
        key={activity._id} 
        className="p-3 border-b last:border-b-0 hover:bg-opacity-10 hover:bg-primary" 
        style={{ 
          borderColor: COLORS.borderColor,
          backgroundColor: getBgColor()
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-medium" style={{ color: COLORS.textColor }}>
              {actionName}: {entityTypeName}
            </p>
            <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
              {activity.userId?.name || 'Неизвестный пользователь'} – {timestamp}
            </p>
            {contextInfo && (
              <p className="text-sm mt-1 italic" style={{ color: COLORS.textColorSecondary }}>
                {contextInfo}
              </p>
            )}
          </div>
          
          {activity.action === 'mood_track' && activity.details && (
            <div className="flex flex-col items-end">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-xs mr-1">Настроение:</span>
                <Smile className="h-4 w-4" style={{ color: COLORS.success }} />
                <span className="font-medium">{activity.details?.mood || '?'}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm mt-1">
                <span className="text-xs mr-1">Энергия:</span>
                <Activity className="h-4 w-4 ml-2" style={{ color: COLORS.primary }} />
                <span className="font-medium">{activity.details?.energy || '?'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Отображение загрузки
  if ((loading && activities.length === 0 && activeTab === 'all') || 
      (monthlyLoading && monthlyActivities.length === 0 && activeTab === 'monthly')) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>История активности</h2>
        </div>
        <Card style={COMPONENT_STYLES.card}>
          <CardHeader>
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="py-3 border-b" style={{ borderColor: COLORS.borderColor }}>
                  <Skeleton className="h-4 w-4/5 mb-2" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Обработка ошибки
  if ((error && activities.length === 0 && activeTab === 'all') || 
      (monthlyError && monthlyActivities.length === 0 && activeTab === 'monthly')) {
    const currentError = activeTab === 'all' ? error : monthlyError;
    const retryFunction = activeTab === 'all' ? fetchActivities : fetchMonthlyActivities;
    
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>История активности</h2>
        </div>
        <Card style={COMPONENT_STYLES.card}>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-center" style={{ color: COLORS.danger }}>{currentError}</p>
            <Button 
              onClick={retryFunction} 
              variant="outline" 
              className="mt-4" 
              style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Попробовать снова
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>История активности</h2>
      </div>
      
      <Card style={COMPONENT_STYLES.card}>
        {isStaff && (
          <Tabs 
            defaultValue="all" 
            value={activeTab}
            onValueChange={handleTabChange}
            className="px-4 pt-4"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                <Clock className="mr-2 h-4 w-4" />
                Все записи
              </TabsTrigger>
              <TabsTrigger value="monthly">
                <CalendarDays className="mr-2 h-4 w-4" />
                За месяц
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all">
              <CardDescription style={{ color: COLORS.textColorSecondary, marginBottom: '12px' }}>
                История активности игроков с возможностью фильтрации
              </CardDescription>
              
              {/* Фильтры (только для персонала) */}
              <CardContent className="pb-0 pt-0 px-0">
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[150px]">
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger>
                        <User className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Все пользователи" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все пользователи</SelectItem>
                        {users && users.length > 0 && users.map(user => (
                          user._id ? (
                            <SelectItem key={user._id} value={user._id}>
                              {user.name || 'Пользователь'}
                            </SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1 min-w-[150px]">
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger>
                        <Activity className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Все действия" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все действия</SelectItem>
                        {Object.entries(ACTIVITY_TYPES).map(([key, value]) => (
                          value ? (
                            <SelectItem key={key} value={value}>
                              {activityHistoryService.getActionName(value as any)}
                            </SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1 min-w-[150px]">
                    <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                      <SelectTrigger>
                        <Package className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Все типы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все типы</SelectItem>
                        {Object.entries(ENTITY_TYPES).map(([key, value]) => (
                          value ? (
                            <SelectItem key={key} value={value}>
                              {activityHistoryService.getEntityTypeName(value as any)}
                            </SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleResetFilters} 
                    style={{ borderColor: COLORS.borderColor, color: COLORS.textColorSecondary }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Сбросить
                  </Button>
                </div>
              </CardContent>
              
              <CardContent className="pt-4 px-0">
                {loading && activities.length > 0 ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="py-3 border-b" style={{ borderColor: COLORS.borderColor }}>
                        <Skeleton className="h-4 w-4/5 mb-2" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                    ))}
                  </div>
                ) : activities && activities.length > 0 ? (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-1">
                      {activities.map((activity, index) => {
                        const renderedItem = renderActivityItem(activity);
                        return renderedItem || <div key={`empty-${index}`}></div>;
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-8 text-center" style={{ color: COLORS.textColorSecondary }}>
                    <Search className="mx-auto h-8 w-8 opacity-50 mb-2" />
                    <p>История активности не найдена</p>
                    {error && (
                      <p className="mt-2 text-sm" style={{ color: COLORS.danger }}>
                        {error}
                      </p>
                    )}
                    {(userFilter !== 'all' || actionFilter !== 'all' || entityTypeFilter !== 'all') && (
                      <Button 
                        variant="link" 
                        onClick={handleResetFilters} 
                        className="mt-2" 
                        style={{ color: COLORS.primary }}
                      >
                        Сбросить фильтры
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
              
              {pagination.pages > 1 && (
                <CardFooter className="flex justify-center">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.pages}
                    onPageChange={handlePageChange}
                  />
                </CardFooter>
              )}
            </TabsContent>
            
            <TabsContent value="monthly">
              <CardDescription style={{ color: COLORS.textColorSecondary, marginBottom: '12px' }}>
                Активность игроков за текущий месяц
              </CardDescription>
              
              <CardContent className="px-0">
                <div className="mb-4 flex justify-between items-center">
                  {monthlyPeriod.start && monthlyPeriod.end ? (
                    <div className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                      <CalendarDays className="inline-block mr-2 h-4 w-4" />
                      Период: с {formatPeriodDate(monthlyPeriod.start)} по {formatPeriodDate(monthlyPeriod.end)}
                    </div>
                  ) : (
                    <div></div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMonthlyActivities}
                    style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Обновить
                  </Button>
                </div>
                
                {monthlyLoading ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <div key={i} className="py-3 border-b" style={{ borderColor: COLORS.borderColor }}>
                        <Skeleton className="h-4 w-4/5 mb-2" />
                        <Skeleton className="h-3 w-3/5" />
                      </div>
                    ))}
                  </div>
                ) : monthlyActivities && monthlyActivities.length > 0 ? (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-1">
                      {monthlyActivities.map((activity, index) => {
                        const renderedItem = renderActivityItem(activity);
                        return renderedItem || <div key={`empty-${index}`}></div>;
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="py-8 text-center" style={{ color: COLORS.textColorSecondary }}>
                    <Search className="mx-auto h-8 w-8 opacity-50 mb-2" />
                    <p>Активность игроков за выбранный период не найдена</p>
                    {monthlyError && (
                      <p className="mt-2 text-sm" style={{ color: COLORS.danger }}>
                        {monthlyError}
                      </p>
                    )}
                    <Button 
                      variant="link" 
                      onClick={fetchMonthlyActivities} 
                      className="mt-2" 
                      style={{ color: COLORS.primary }}
                    >
                      Попробовать загрузить снова
                    </Button>
                  </div>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        )}
        
        {!isStaff && (
          <>
            <CardHeader className="pb-3">
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                Просмотр всех ваших действий в системе
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-4">
              {loading && activities.length > 0 ? (
                <div className="space-y-2">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="py-3 border-b" style={{ borderColor: COLORS.borderColor }}>
                      <Skeleton className="h-4 w-4/5 mb-2" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  ))}
                </div>
              ) : activities && activities.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-1">
                    {activities.map((activity, index) => {
                      const renderedItem = renderActivityItem(activity);
                      return renderedItem || <div key={`empty-${index}`}></div>;
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="py-8 text-center" style={{ color: COLORS.textColorSecondary }}>
                  <Search className="mx-auto h-8 w-8 opacity-50 mb-2" />
                  <p>История активности не найдена</p>
                  {error && (
                    <p className="mt-2 text-sm" style={{ color: COLORS.danger }}>
                      {error}
                    </p>
                  )}
                  <Button 
                    variant="link" 
                    onClick={fetchActivities} 
                    className="mt-2" 
                    style={{ color: COLORS.primary }}
                  >
                    Попробовать загрузить снова
                  </Button>
                </div>
              )}
            </CardContent>
            
            {pagination.pages > 1 && (
              <CardFooter className="flex justify-center">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  onPageChange={handlePageChange}
                />
              </CardFooter>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default ActivityHistory; 