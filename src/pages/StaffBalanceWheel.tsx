import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BalanceWheelChart } from "@/components/BalanceWheelChart";
import { StatCard } from "@/components/StatCard";
import { User, BalanceWheel as BalanceWheelType } from "@/types";
import { getPlayers, getPlayerBalanceWheels, getAllPlayersBalanceWheelStats } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";

const StaffBalanceWheel = () => {
  const { user } = useAuth();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [balanceWheels, setBalanceWheels] = useState<BalanceWheelType[]>([]);
  const [allPlayersWheelData, setAllPlayersWheelData] = useState<any[]>([]);
  const [balanceWheelData, setBalanceWheelData] = useState<any>({
    physical: 0,
    emotional: 0,
    intellectual: 0,
    spiritual: 0,
    occupational: 0,
    social: 0,
    environmental: 0,
    financial: 0,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [playersDataError, setPlayersDataError] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

  // Загрузка списка игроков
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoadingPlayers(true);
        setPlayersDataError(false); // Сбрасываем флаг ошибки в начале
        
        const response = await getPlayers();
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Убедимся, что у всех игроков есть id
          const validPlayers = response.data.filter(player => player && player._id);
          
          if (validPlayers.length > 0) {
            // Преобразуем _id в id, если id отсутствует
            const processedPlayers = validPlayers.map(player => ({
              ...player,
              id: player.id || player._id
            }));
            
            setPlayers(processedPlayers);
            setPlayersDataError(false); // Явно устанавливаем флаг в false при успешной загрузке
            
            // Выбираем первого игрока по умолчанию
            if (processedPlayers.length > 0) {
              setSelectedPlayerId(processedPlayers[0].id);
            }
          } else {
            setPlayers([]);
            setSelectedPlayerId("");
            setPlayersDataError(true);
            setApiError("Игроки команды не найдены");
          }
        } else {
          setPlayers([]);
          setSelectedPlayerId("");
          setPlayersDataError(true);
          setApiError("Не удалось загрузить список игроков");
        }
      } catch (error) {
        console.error("Ошибка при загрузке игроков:", error);
        setPlayers([]);
        setSelectedPlayerId("");
        setPlayersDataError(true);
        setApiError("Не удалось загрузить список игроков");
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, []);

  // Загрузка данных колес баланса всех игроков
  useEffect(() => {
    const fetchAllPlayersWheelData = async () => {
      try {
        console.log("[DEBUG] Загрузка данных колес баланса всех игроков...");
        setLoading(true);
        setApiError(null);
        
        const response = await getAllPlayersBalanceWheelStats();
        console.log("[DEBUG] Получены данные колес баланса всех игроков:", response);
        
        if (response.data && Array.isArray(response.data)) {
          if (response.data.length > 0) {
            // Обработка данных всех игроков
            const processedData = response.data.map(playerData => {
              // Проверка и извлечение userId из строки, если это JSON строка
              let userId = playerData.userId;
              if (typeof userId === 'string' && userId.includes('_id:')) {
                try {
                  // Пытаемся извлечь _id из строки JSON
                  const match = userId.match(/ObjectId\(["']([^"']+)["']\)/);
                  if (match && match[1]) {
                    userId = match[1];
                  }
                } catch (e) {
                  console.error("[DEBUG] Ошибка при обработке userId:", e);
                }
              }
              
              // Проверка наличия колес и их сортировка по дате (новые сначала)
              let processedWheels = [];
              if (playerData.wheels && Array.isArray(playerData.wheels) && playerData.wheels.length > 0) {
                processedWheels = [...playerData.wheels].sort((a, b) => {
                  if (a.date && b.date) {
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                  }
                  return 0;
                });
              }
              
              return {
                ...playerData,
                userId: userId, // Используем обработанный userId
                wheels: processedWheels,
                _id: userId // Дублируем userId как _id для совместимости
              };
            });
            
            console.log("[DEBUG] Обработанные данные колес баланса:", processedData);
            setAllPlayersWheelData(processedData);
            setLastRefreshTime(Date.now());
            setPlayersDataError(false); // Сбрасываем флаг ошибки, так как данные получены
            
          } else {
            console.log("[DEBUG] Нет данных о колесах баланса");
            // Не устанавливаем тестовые данные, а просто показываем сообщение об ошибке
            setApiError("Нет данных о колесах баланса");
            setPlayersDataError(true);
          }
        } else {
          console.log("[DEBUG] Получены некорректные данные о колесах баланса");
          setApiError("Получены некорректные данные о колесах баланса");
          setPlayersDataError(true);
        }
      } catch (error) {
        console.error("[DEBUG] Ошибка при загрузке данных колес баланса всех игроков:", error);
        setApiError(error instanceof Error ? error.message : 'Неизвестная ошибка');
        setPlayersDataError(true);
      } finally {
        setLoading(false);
      }
    };

    // Загружаем данные только если есть игроки
    if (players.length > 0) {
      fetchAllPlayersWheelData();
    } else {
      setAllPlayersWheelData([]);
      setBalanceWheels([]);
    }
  }, [players, refreshTrigger]);

  // Обработка выбора игрока и отображение его колеса баланса
  useEffect(() => {
    if (selectedPlayerId && allPlayersWheelData.length > 0) {
      setLoading(true);
      
      // Варианты поиска данных для выбранного игрока (проверяем разные возможные поля)
      const playerData = allPlayersWheelData.find(data => 
        (data.userId && (data.userId === selectedPlayerId || data.userId.toString() === selectedPlayerId)) || 
        (data._id && (data._id === selectedPlayerId || data._id.toString() === selectedPlayerId)) || 
        (data.id && (data.id === selectedPlayerId || data.id.toString() === selectedPlayerId))
      );
      
      if (playerData && playerData.wheels && playerData.wheels.length > 0) {
        const latestWheel = playerData.wheels[0]; // Первое колесо (самое новое)
        setBalanceWheelData({
          physical: latestWheel.physical || 0,
          emotional: latestWheel.emotional || 0,
          intellectual: latestWheel.intellectual || 0,
          spiritual: latestWheel.spiritual || 0,
          occupational: latestWheel.occupational || 0,
          social: latestWheel.social || 0,
          environmental: latestWheel.environmental || 0,
          financial: latestWheel.financial || 0,
        });
        
        // Сохраняем все колеса баланса игрока
        setBalanceWheels(playerData.wheels);
        setLoading(false);
      } else {
        // Если не нашли данные в общем запросе, загружаем напрямую
        forceFetchBalanceWheelForPlayer(selectedPlayerId);
      }
    } else if (selectedPlayerId) {
      forceFetchBalanceWheelForPlayer(selectedPlayerId);
    }
  }, [selectedPlayerId, allPlayersWheelData]);

  // Принудительная загрузка данных колеса баланса для выбранного игрока
  const forceFetchBalanceWheelForPlayer = async (playerId: string) => {
    try {
      setLoading(true);
      setApiError(null);
      
      // Всегда делаем прямой запрос к API
      const response = await getPlayerBalanceWheels(playerId);
      
      if (response && response.data) {
        let wheelData;
        
        if (Array.isArray(response.data)) {
          wheelData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          wheelData = response.data.data;
        }
        
        if (wheelData && wheelData.length > 0) {
          // Сортируем по дате (новые сначала)
          const sortedWheels = [...wheelData].sort((a, b) => {
            if (a.date && b.date) {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            return 0;
          });
          
          setBalanceWheels(sortedWheels);
          
          // Берем самое свежее колесо баланса
          const latestWheel = sortedWheels[0];
          const updatedWheelData = {
            physical: latestWheel.physical || 0,
            emotional: latestWheel.emotional || 0,
            intellectual: latestWheel.intellectual || 0,
            spiritual: latestWheel.spiritual || 0,
            occupational: latestWheel.occupational || 0,
            social: latestWheel.social || 0,
            environmental: latestWheel.environmental || 0,
            financial: latestWheel.financial || 0,
          };
          
          // Обновляем текущие данные колеса баланса
          setBalanceWheelData(updatedWheelData);
          
          // Обновляем данные в общем массиве всех игроков
          setAllPlayersWheelData(prevData => {
            // Создаем копию, чтобы не мутировать state напрямую
            const updatedData = [...prevData];
            
            // Ищем индекс игрока в массиве
            const playerIndex = updatedData.findIndex(player => 
              (player.userId && (player.userId === playerId || String(player.userId) === playerId)) || 
              (player._id && (player._id === playerId || String(player._id) === playerId)) || 
              (player.id && (player.id === playerId || String(player.id) === playerId))
            );
            
            if (playerIndex !== -1) {
              // Обновляем данные существующего игрока
              updatedData[playerIndex] = {
                ...updatedData[playerIndex],
                wheels: sortedWheels
              };
            } else {
              // Если игрока нет в списке, добавляем его
              const player = players.find(p => p.id === playerId);
              if (player) {
                updatedData.push({
                  userId: playerId,
                  _id: playerId,
                  name: player.name || 'Неизвестный игрок',
                  wheels: sortedWheels
                });
              }
            }
            
            return updatedData;
          });
          
          setPlayersDataError(false);
          return;
        }
      }
      
      // Если данные не найдены
      setApiError(`Не удалось получить данные колеса баланса для игрока ${playerId}`);
      setPlayersDataError(true);
      
    } catch (error) {
      console.error(`Ошибка при загрузке колеса баланса игрока ${playerId}:`, error);
      setApiError('Не удалось загрузить данные колеса баланса. Попробуйте позже.');
      setPlayersDataError(true);
    } finally {
      setLoading(false);
    }
  };

  // Функция для обновления данных конкретного игрока
  const refreshPlayerData = async (playerId: string) => {
    try {
      setLoading(true);
      
      const response = await getPlayerBalanceWheels(playerId);
      
      if (response && response.data) {
        let wheelData;
        
        if (Array.isArray(response.data)) {
          wheelData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          wheelData = response.data.data;
        } else {
          // Если данные в другом формате - попробуем преобразовать
          wheelData = [response.data];
        }
        
        if (wheelData && wheelData.length > 0) {
          // Сортируем по дате (новые сначала)
          const sortedWheels = [...wheelData].sort((a, b) => {
            if (a.date && b.date) {
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            return 0;
          });
          
          // Обновляем список колес баланса игрока
          setBalanceWheels(sortedWheels);
        
          // Обновляем текущие данные колеса баланса на основе последнего колеса
          const latestWheel = sortedWheels[0];
          const updatedWheelData = {
            physical: latestWheel.physical || 0,
            emotional: latestWheel.emotional || 0,
            intellectual: latestWheel.intellectual || 0,
            spiritual: latestWheel.spiritual || 0,
            occupational: latestWheel.occupational || 0,
            social: latestWheel.social || 0,
            environmental: latestWheel.environmental || 0,
            financial: latestWheel.financial || 0,
          };
          
          setBalanceWheelData(updatedWheelData);
        
          // Обновляем общие данные с новыми данными для этого игрока
          setAllPlayersWheelData(prevData => {
            // Создаем копию, чтобы не мутировать state напрямую
            const updatedData = [...prevData];
            
            // Ищем индекс игрока в массиве
            const playerIndex = updatedData.findIndex(player => 
              (player.userId && (player.userId === playerId || String(player.userId) === playerId)) || 
              (player._id && (player._id === playerId || String(player._id) === playerId)) || 
              (player.id && (player.id === playerId || String(player.id) === playerId))
            );
            
            if (playerIndex !== -1) {
              // Обновляем данные существующего игрока
              updatedData[playerIndex] = {
                ...updatedData[playerIndex],
                wheels: sortedWheels
              };
            } else {
              // Если игрока нет в списке, добавляем его
              const player = players.find(p => p.id === playerId);
              if (player) {
                updatedData.push({
                  userId: playerId,
                  _id: playerId,
                  name: player.name || 'Неизвестный игрок',
                  wheels: sortedWheels
                });
              }
            }
            
            return updatedData;
          });
        
          setPlayersDataError(false);
          toast.success("Данные игрока обновлены");
        } else {
          toast.error("Не удалось получить данные колеса баланса");
        }
      } else {
        toast.error("Получен пустой ответ от сервера");
      }
      
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("Ошибка при обновлении данных игрока:", error);
      toast.error("Не удалось обновить данные игрока");
      setPlayersDataError(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerSelect = (value: string | null) => {
    if (!value) return;
    
    setSelectedPlayerId(value);
    
    // Используем существующие данные из общего массива
    const playerData = allPlayersWheelData.find(data => 
      (data.userId && (data.userId === value || data.userId.toString() === value)) || 
      (data._id && (data._id === value || data._id.toString() === value)) || 
      (data.id && (data.id === value || data.id.toString() === value))
    );
    
    if (playerData && playerData.wheels && playerData.wheels.length > 0) {
      const latestWheel = playerData.wheels[0]; // Первое колесо (самое новое)
      setBalanceWheelData({
        physical: latestWheel.physical || 0,
        emotional: latestWheel.emotional || 0,
        intellectual: latestWheel.intellectual || 0,
        spiritual: latestWheel.spiritual || 0,
        occupational: latestWheel.occupational || 0,
        social: latestWheel.social || 0,
        environmental: latestWheel.environmental || 0,
        financial: latestWheel.financial || 0,
      });
      
      // Сохраняем все колеса баланса игрока
      setBalanceWheels(playerData.wheels);
    } else {
      // Если данные не найдены, загружаем их единожды
      forceFetchBalanceWheelForPlayer(value);
    }
  };

  // Получение имени игрока
  const getPlayerName = () => {
    const player = players.find((p) => p.id === selectedPlayerId);
    return player ? player.name : "Выберите игрока";
  };

  // Расчет среднего значения всех параметров
  const getAverageScore = () => {
    const values = [
      balanceWheelData.physical,
      balanceWheelData.emotional,
      balanceWheelData.intellectual,
      balanceWheelData.spiritual,
      balanceWheelData.occupational,
      balanceWheelData.social,
      balanceWheelData.environmental,
      balanceWheelData.financial,
    ];
    
    const sum = values.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
    return values.length > 0 ? (sum / values.length).toFixed(1) : "0";
  };

  // Подготовка данных для графика
  const prepareChartData = () => {
    return [
      {
        subject: "Физическое здоровье",
        value: balanceWheelData.physical,
      },
      {
        subject: "Эмоциональное здоровье",
        value: balanceWheelData.emotional,
      },
      {
        subject: "Интеллектуальное развитие",
        value: balanceWheelData.intellectual,
      },
      {
        subject: "Духовное развитие",
        value: balanceWheelData.spiritual,
      },
      {
        subject: "Профессиональное развитие",
        value: balanceWheelData.occupational,
      },
      {
        subject: "Социальные отношения",
        value: balanceWheelData.social,
      },
      {
        subject: "Окружающая среда",
        value: balanceWheelData.environmental,
      },
      {
        subject: "Финансовое благополучие",
        value: balanceWheelData.financial,
      },
    ];
  };

  // Получение даты последнего колеса
  const getWheelDate = () => {
    if (balanceWheels.length > 0 && balanceWheels[0].date) {
      const date = new Date(balanceWheels[0].date);
      return date.toLocaleDateString();
    }
    return "Нет данных";
  };

  // Функция для обновления всех данных 
  const refreshAllData = () => {
    // Обновляем все данные
    setRefreshTrigger(prev => prev + 1);
    
    // Показываем уведомление о начале обновления
    toast.info("Обновление данных...");
    
    // Если выбран игрок, дополнительно обновляем его данные напрямую
    if (selectedPlayerId) {
      // Запускаем обновление выбранного игрока
      setTimeout(() => {
        refreshPlayerData(selectedPlayerId);
      }, 500); // Небольшая задержка для уменьшения нагрузки
    }
  };

  // Если нет прав доступа
  if (user?.role !== "staff") {
    return (
      <div className="container mx-auto py-6">
        <h2 className="text-2xl font-bold mb-4">Доступ запрещен</h2>
        <p>Этот раздел доступен только для персонала</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>Колесо баланса</h2>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAllData}
              disabled={loading}
              style={{ borderColor: COLORS.borderColor, color: COLORS.textColor, backgroundColor: COLORS.cardBackground }}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="flex-1 min-w-[300px]">
            <label htmlFor="playerSelect" className="text-sm font-medium mb-2 block" style={{ color: COLORS.textColor }}>Выберите игрока:</label>
            <Select
              value={selectedPlayerId}
              onValueChange={handlePlayerSelect}
              disabled={loading || players.length === 0}
            >
              <SelectTrigger id="playerSelect" className="w-full" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, color: COLORS.textColor }}>
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {apiError && (
            <div className="flex-1 min-w-[300px] text-sm text-red-500">
              <p>{apiError}</p>
            </div>
          )}
        </div>
        
        {balanceWheels.length > 0 && (
          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardHeader>
              <CardTitle style={{ color: COLORS.textColor }}>Колесо баланса: {getPlayerName()}</CardTitle>
              <CardDescription style={{ color: COLORS.textColorSecondary }}>
                {getWheelDate()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-[900px] flex justify-center items-center">
                  {loading ? (
                    <p>Загрузка данных...</p>
                  ) : (
                    <BalanceWheelChart 
                      data={prepareChartData()} 
                      title={getPlayerName() ? `Колесо баланса: ${getPlayerName()}` : "Колесо баланса"}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px'
                      }}
                    />
                  )}
                </div>
                
                <div className="grid gap-4 grid-cols-2">
                  <StatCard 
                    title="Физическое здоровье" 
                    value={balanceWheelData.physical} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Эмоциональное состояние" 
                    value={balanceWheelData.emotional} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Интеллектуальное развитие" 
                    value={balanceWheelData.intellectual} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Духовное развитие" 
                    value={balanceWheelData.spiritual} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Профессиональная сфера" 
                    value={balanceWheelData.occupational} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Социальные отношения" 
                    value={balanceWheelData.social} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Окружающая среда" 
                    value={balanceWheelData.environmental} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                  <StatCard 
                    title="Финансовое благополучие" 
                    value={balanceWheelData.financial} 
                    maxValue={10}
                    style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StaffBalanceWheel; 
