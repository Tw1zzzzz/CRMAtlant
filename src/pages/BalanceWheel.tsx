import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { BalanceWheel as BalanceWheelType } from "@/types";
import { ResponsiveRadar } from '@nivo/radar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveBalanceWheel, getMyBalanceWheels, getPlayerBalanceWheels, getPlayers } from "@/lib/api";
import { User } from "@/types";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import { format, subDays, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ru } from "date-fns/locale";
import { BalanceWheelChart } from "@/components/BalanceWheelChart";

// Пользовательские стили для компонентов
const customStyles = {
  cardBackground: "#1a1d2d",
  cardBorder: "#3f4468",
  primaryColor: "#4d82ff", 
  textColor: "#ffffff",
  textSecondary: "#8e94bb",
  inputBackground: "#2d3148"
};

// Стили для CSS клаcсов
const CLASS_STYLES = {
  card: "bg-[#1a1d2d] border-[#3f4468] shadow-md",
  title: "text-white",
  description: "text-[#8e94bb]",
  input: "bg-[#2d3148] border-[#3f4468] text-white",
  button: "bg-[#4d82ff] hover:bg-[#3a6eec] text-white",
  activeTab: "bg-[#4d82ff] text-white",
  inactiveTab: "bg-transparent text-[#8e94bb] hover:text-white",
  historyCard: "bg-[#1a1d2d] border border-[#3f4468] rounded-lg overflow-hidden shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all",
  slider: "custom-slider" // Класс для кастомных слайдеров
};

// Categories for the balance wheel
const categories = [
  { id: "physical", name: "Физическое здоровье", description: "Здоровье, энергия, активность" },
  { id: "emotional", name: "Эмоциональное состояние", description: "Управление эмоциями, стрессоустойчивость" },
  { id: "intellectual", name: "Интеллектуальное развитие", description: "Обучение, творчество, развитие навыков" },
  { id: "spiritual", name: "Духовное развитие", description: "Ценности, цели, смысл" },
  { id: "occupational", name: "Профессиональная сфера", description: "Карьера, достижения, реализация" },
  { id: "social", name: "Социальные отношения", description: "Семья, друзья, команда" },
  { id: "environmental", name: "Окружающая среда", description: "Жизненное пространство, комфорт" },
  { id: "financial", name: "Финансовое благополучие", description: "Доходы, сбережения, инвестиции" }
];

const BalanceWheel = () => {
  const { user } = useAuth();
  const isStaffView = user?.role === 'staff';
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [viewMode, setViewMode] = useState<"current" | "history">("current");
  const [isLoading, setIsLoading] = useState(false);
  const [savingWheel, setSavingWheel] = useState(false);
  const [players, setPlayers] = useState<User[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  
  // Initial values for each category
  const initialValues = {
    physical: 5,
    emotional: 5,
    intellectual: 5,
    spiritual: 5,
    occupational: 5,
    social: 5,
    environmental: 5,
    financial: 5
  };
  
  const [values, setValues] = useState(initialValues);
  const [wheels, setWheels] = useState<(BalanceWheelType & { _id?: string })[]>([]);
  
  // Загрузка списка игроков для сотрудников
  useEffect(() => {
    if (isStaffView) {
      const fetchPlayers = async () => {
        try {
          setLoadingPlayers(true);
          const response = await getPlayers();
          console.log("[DEBUG] Полученный список игроков:", response.data);
          
          if (response.data && Array.isArray(response.data)) {
            setPlayers(response.data);
            if (response.data.length > 0) {
              setSelectedPlayer(response.data[0].id);
            }
          } else {
            console.error("[ERROR] Неверный формат данных игроков:", response.data);
            toast.error('Ошибка при загрузке игроков: неверный формат данных');
          }
        } catch (error) {
          console.error('[ERROR] Ошибка при загрузке игроков:', error);
          toast.error('Ошибка при загрузке игроков');
        } finally {
          setLoadingPlayers(false);
        }
      };
      
      fetchPlayers();
    }
  }, [isStaffView]);
  
  // Загрузка истории колес баланса
  useEffect(() => {
    const fetchBalanceWheels = async () => {
      try {
        setIsLoading(true);
        
        let response;
        if (isStaffView && selectedPlayer) {
          console.log(`[DEBUG] Загрузка колеса баланса для игрока с ID: ${selectedPlayer}`);
          response = await getPlayerBalanceWheels(selectedPlayer);
        } else {
          console.log(`[DEBUG] Загрузка моего колеса баланса`);
          response = await getMyBalanceWheels();
        }
        
        console.log(`[DEBUG] Полный ответ API:`, response);
        if (response && response.status === 200) {
          console.log(`[DEBUG] Успешный ответ API - статус ${response.status}`);
        } else {
          console.log(`[DEBUG] Неожиданный статус ответа API: ${response?.status}`);
        }
        
        // Добавляем больше логирования для понимания структуры данных
        if (response && response.data) {
          console.log(`[DEBUG] Тип response.data: ${typeof response.data}`);
          if (typeof response.data === 'object') {
            console.log(`[DEBUG] Ключи response.data:`, Object.keys(response.data));
            
            if (Array.isArray(response.data)) {
              console.log(`[DEBUG] response.data - это массив длиной ${response.data.length}`);
              if (response.data.length > 0) {
                console.log(`[DEBUG] Первый элемент массива:`, response.data[0]);
              }
            } else if (response.data.data) {
              console.log(`[DEBUG] response.data.data:`, response.data.data);
            } else {
              console.log(`[DEBUG] response.data не является массивом и не содержит поле data`);
            }
          }
        } else {
          console.log(`[DEBUG] response.data отсутствует или пусто`);
        }
        
        // Правильно извлекаем данные из ответа API
        let balanceWheels = [];
        
        if (response && response.data) {
          // Проверяем различные форматы ответа
          if (Array.isArray(response.data)) {
            balanceWheels = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            balanceWheels = response.data.data;
          } else if (typeof response.data === 'object' && !Array.isArray(response.data)) {
            // Возможно, это одиночная запись
            balanceWheels = [response.data];
          }
        }
        
        console.log(`[DEBUG] Извлеченные данные колес баланса:`, balanceWheels);
        console.log(`[DEBUG] Получены данные колес баланса: ${balanceWheels.length} записей`);
        
        if (balanceWheels && balanceWheels.length > 0) {
          // Проверяем, содержат ли данные все необходимые поля
          const validWheels = balanceWheels.filter((wheel: any) => 
            wheel && 
            (wheel.physical !== undefined || 
             wheel.emotional !== undefined || 
             wheel.intellectual !== undefined)
          );
          
          console.log(`[DEBUG] Число найденных валидных колес: ${validWheels.length}`);
          
          if (validWheels.length > 0) {
            // Выводим первое колесо для отладки
            console.log(`[DEBUG] Первое валидное колесо:`, validWheels[0]);
            
            const formattedWheels = validWheels.map((wheel: any) => ({
              id: wheel.id || wheel._id || `wheel-${Date.now()}-${Math.random()}`,
              userId: wheel.userId || user?.id || 'unknown',
              date: new Date(wheel.date || new Date()),
              physical: typeof wheel.physical === 'number' ? wheel.physical : 5,
              emotional: typeof wheel.emotional === 'number' ? wheel.emotional : 5,
              intellectual: typeof wheel.intellectual === 'number' ? wheel.intellectual : 5,
              spiritual: typeof wheel.spiritual === 'number' ? wheel.spiritual : 5,
              occupational: typeof wheel.occupational === 'number' ? wheel.occupational : 5,
              social: typeof wheel.social === 'number' ? wheel.social : 5,
              environmental: typeof wheel.environmental === 'number' ? wheel.environmental : 5,
              financial: typeof wheel.financial === 'number' ? wheel.financial : 5
            }));
            
            console.log(`[DEBUG] Отформатированные данные:`, formattedWheels);
            setWheels(formattedWheels);
            console.log(`[DEBUG] Данные успешно обработаны и установлены`);
            return;
          }
        }
        
        console.log(`[DEBUG] Нет валидных данных колеса баланса`);
        setWheels([]);
      } catch (error) {
        console.error('[ERROR] Ошибка при загрузке колес баланса:', error);
        toast.error('Ошибка при загрузке истории колес баланса');
        setWheels([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      if (!isStaffView || (isStaffView && selectedPlayer)) {
        fetchBalanceWheels();
      }
    }
  }, [user, isStaffView, selectedPlayer, refreshCount]);
  
  const handleSliderChange = (category: keyof typeof initialValues, value: number[]) => {
    setValues(prev => ({
      ...prev,
      [category]: value[0]
    }));
  };
  
  const handleSave = async () => {
    if (!user) {
      toast.error("Необходимо войти в систему");
      return;
    }
    
    try {
      setSavingWheel(true);
      
      const response = await saveBalanceWheel({
        date: new Date(date),
        physical: values.physical,
        emotional: values.emotional,
        intellectual: values.intellectual,
        spiritual: values.spiritual,
        occupational: values.occupational,
        social: values.social,
        environmental: values.environmental,
        financial: values.financial
      });
      
      // Добавляем новое колесо в список
      setWheels(prev => [
        {
          ...response.data,
          date: new Date(response.data.date)
        },
        ...prev
      ]);
      
      toast.success("Колесо баланса сохранено");
      
      // Reset form
      setValues(initialValues);
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error saving balance wheel:', error);
      toast.error("Ошибка при сохранении колеса баланса");
    } finally {
      setSavingWheel(false);
    }
  };
  
  // Format data for the radar chart
  const getChartData = (wheel: BalanceWheelType) => {
    return {
        physical: wheel.physical,
        emotional: wheel.emotional,
        intellectual: wheel.intellectual,
        spiritual: wheel.spiritual,
        occupational: wheel.occupational,
        social: wheel.social,
        environmental: wheel.environmental,
        financial: wheel.financial
    };
  };
  
  // Get the latest wheel data
  const getLatestWheel = () => {
    if (wheels.length === 0) return null;
    return wheels[0]; // Колеса уже отсортированы по дате
  };

  // Get wheel history
  const getWheelHistory = () => {
    return wheels;
  };
  
  const latestWheel = getLatestWheel();
  const wheelHistory = getWheelHistory();
  const isStaff = user?.role === "staff";
  const canEdit = user?.role === "player";

  // Принудительное обновление данных
  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
  };

  // Loading states
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Необходимо войти в систему для доступа к этой странице</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Глобальные стили для слайдеров */}
      <style>
        {`
          .custom-slider [role="slider"] {
            background-color: #ffffff !important;
            border: 2px solid #4d82ff !important;
          }
          .custom-slider [data-orientation="horizontal"] {
            background-color: #3f4468 !important;
          }
          .custom-slider [data-orientation="horizontal"] > span {
            background-color: #4d82ff !important;
          }
        `}
      </style>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: COLORS.textColor }}>Колесо баланса</h2>
        </div>
        
        {isStaffView && (
          <div className="mb-4">
            <Label htmlFor="player-select" className="block text-sm font-medium mb-2" style={{ color: customStyles.textColor }}>
              Выберите игрока:
            </Label>
            <Select 
              value={selectedPlayer} 
              onValueChange={(value) => setSelectedPlayer(value)}
              disabled={loadingPlayers}
            >
              <SelectTrigger className="w-full" style={{ backgroundColor: customStyles.inputBackground, borderColor: customStyles.cardBorder, color: customStyles.textColor }}>
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: customStyles.cardBackground, borderColor: customStyles.cardBorder }}>
                {players.map((player) => (
                  <SelectItem key={player.id} value={player.id || ''} style={{ color: customStyles.textColor }}>
                    {player.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <Card className={`mb-4 ${CLASS_STYLES.card}`}>
          <CardHeader>
            <CardTitle className={CLASS_STYLES.title}>
              {isStaffView ? 
                `Колесо баланса игрока` :
                "Заполните ваше колесо баланса"
              }
            </CardTitle>
            <CardDescription className={CLASS_STYLES.description}>
              {isStaffView ? 
                "Визуализация колеса баланса игрока" : 
                "Ваше текущее колесо баланса"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={viewMode} onValueChange={(value) => setViewMode(value as "current" | "history")}>
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#1a1d2d] border-[#3f4468]">
                <TabsTrigger 
                  value="current" 
                  className={viewMode === "current" ? CLASS_STYLES.activeTab : CLASS_STYLES.inactiveTab}
                >
                  Текущее состояние
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className={viewMode === "history" ? CLASS_STYLES.activeTab : CLASS_STYLES.inactiveTab}
                >
                  История
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="current">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column - Balance Wheel Form */}
                  <Card className={`${!canEdit ? "opacity-50 pointer-events-none" : ""} ${CLASS_STYLES.card}`}>
                    <CardHeader>
                      <CardTitle className={CLASS_STYLES.title}>Заполните ваше колесо баланса</CardTitle>
                      <CardDescription className={CLASS_STYLES.description}>
                        Оцените каждую область вашей жизни на данный момент
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="date" className={CLASS_STYLES.title}>Дата</Label>
                        <Input
                          id="date"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          disabled={!canEdit || savingWheel}
                          className={CLASS_STYLES.input}
                        />
                      </div>
                      
                      {categories.map((category) => (
                        <div key={category.id} className="space-y-2">
                          <div className="flex justify-between">
                            <Label htmlFor={category.id} className={CLASS_STYLES.title}>{category.name}</Label>
                            <span className={`text-sm font-medium ${CLASS_STYLES.title}`}>
                              {values[category.id as keyof typeof values]}/10
                            </span>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className={`text-sm hover:underline ${CLASS_STYLES.description}`}>
                                Что это значит?
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="right" className="bg-[#2d3148] border-[#3f4468] text-white">
                              <p className="text-sm">{category.description}</p>
                            </PopoverContent>
                          </Popover>
                          <Slider
                            id={category.id}
                            min={1}
                            max={10}
                            step={1}
                            value={[values[category.id as keyof typeof values]]}
                            onValueChange={(value) => handleSliderChange(category.id as keyof typeof values, value)}
                            disabled={!canEdit || savingWheel}
                            className={CLASS_STYLES.slider}
                          />
                        </div>
                      ))}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        onClick={handleSave} 
                        className={`w-full ${CLASS_STYLES.button}`} 
                        disabled={!canEdit || savingWheel}
                      >
                        {savingWheel ? "Сохранение..." : "Сохранить"}
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  {/* Right column - Current Wheel Visualization */}
                  <Card className={CLASS_STYLES.card}>
                    <CardHeader>
                      <CardTitle className={CLASS_STYLES.title}>
                        {isStaff ? (
                          selectedPlayer ? 
                            `Колесо баланса игрока` : 
                            "Выберите игрока"
                        ) : (
                          "Ваше текущее колесо баланса"
                        )}
                      </CardTitle>
                      <CardDescription className={CLASS_STYLES.description}>
                        {latestWheel ? (
                          `Последнее обновление: ${latestWheel.date.toLocaleDateString()}`
                        ) : (
                          isLoading ? "Загрузка..." : "Нет данных"
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-[900px] p-0">
                      {isLoading ? (
                        <p className={CLASS_STYLES.title}>Загрузка данных...</p>
                      ) : latestWheel ? (
                        <BalanceWheelChart 
                          data={getChartData(latestWheel)}
                          title={isStaff ? `Колесо баланса игрока` : "Ваше текущее колесо баланса"}
                        />
                      ) : (
                        <div className="text-center">
                          <p className={CLASS_STYLES.title}>Нет данных для отображения</p>
                          {canEdit && (
                            <p className={`text-sm mt-2 ${CLASS_STYLES.description}`}>
                              Заполните форму слева, чтобы создать ваше первое колесо баланса
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="history">
                <Card className={CLASS_STYLES.card}>
                  <CardHeader>
                    <CardTitle className={CLASS_STYLES.title}>
                      {isStaff ? (
                        selectedPlayer ? 
                          `История колес баланса игрока` : 
                          "Выберите игрока"
                      ) : (
                        "Ваша история колес баланса"
                      )}
                    </CardTitle>
                    <CardDescription className={CLASS_STYLES.description}>
                      {isLoading ? (
                        "Загрузка истории..."
                      ) : wheelHistory.length > 0 ? (
                        `Всего записей: ${wheelHistory.length}`
                      ) : (
                        "Нет истории"
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <p className={CLASS_STYLES.title}>Загрузка истории...</p>
                      </div>
                    ) : wheelHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <p className={CLASS_STYLES.title}>Нет истории колес баланса</p>
                        {canEdit && (
                          <p className={`text-sm mt-2 ${CLASS_STYLES.description}`}>
                            Заполните форму на вкладке "Текущее состояние", чтобы создать ваше первое колесо баланса
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className={`grid gap-6 ${wheelHistory.length === 1 ? 'md:grid-cols-1' : wheelHistory.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                        {wheelHistory.map((wheel) => (
                          <div 
                            key={wheel.id || `wheel-${wheel._id || Math.random()}`} 
                            className={CLASS_STYLES.historyCard}
                            style={{ boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)' }}
                          >
                            <div className="p-4 border-b border-[#3f4468] bg-[#1d2135]">
                              <h3 className="text-base font-medium text-white">
                                {(() => {
                                  try {
                                    const dateObj = wheel.date instanceof Date ? wheel.date : new Date(wheel.date);
                                    return dateObj.toLocaleDateString('ru-RU', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  } catch (e) {
                                    return 'Дата неизвестна';
                                  }
                                })()}
                              </h3>
                            </div>
                            <div className="h-[300px] p-4 flex items-center justify-center">
                              <BalanceWheelChart
                                data={getChartData(wheel)}
                                compact={true}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BalanceWheel;
