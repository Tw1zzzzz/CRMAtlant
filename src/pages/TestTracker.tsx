import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Link as LinkIcon, Calendar as CalendarIcon, Image, ExternalLink, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TestEntry } from "@/types";
import { testRepository } from "@/lib/dataRepository";
import { createTestEntry, getMyTestEntries } from "@/lib/api";
import { formatDate, getCurrentWeekRange, getWeekLabel, getPrevWeek, getNextWeek } from "@/utils/dateUtils";
import { fileToDataUrl, validateImageFile } from "@/utils/fileUtils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { COLORS, COMPONENT_STYLES } from "@/styles/theme";
import axios from "axios";

const predefinedTests = [
  {
    name: "Межличностные отношения",
    link: "https://psytests.org/classic/leary.html",
    isWeeklyTest: false
  }
];

const TestTracker = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [name, setName] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isWeeklyTest, setIsWeeklyTest] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingTest, setEditingTest] = useState<TestEntry | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "questionnaire">("daily");
  const [isStaffView, setIsStaffView] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Опросник (новая логика тестов)
  const [qDate, setQDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [qMood, setQMood] = useState<string>("");
  const [qEnergy, setQEnergy] = useState<string>("");
  const [qSleep, setQSleep] = useState<string>("");
  const [qScreen, setQScreen] = useState<string>("");
  const [qSubmitting, setQSubmitting] = useState<boolean>(false);
  
  const isStaff = user?.role === "staff";
  const canEdit = user?.role === "player";

  const baseUrl = process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:5000";

  const submitQuestionnaire = async () => {
    try {
      setQSubmitting(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${baseUrl}/api/questionnaires/daily`,
        {
          date: qDate,
          mood: qMood ? Number(qMood) : undefined,
          energy: qEnergy ? Number(qEnergy) : undefined,
          sleepHours: qSleep ? Number(qSleep) : undefined,
          screenTimeHours: qScreen ? Number(qScreen) : undefined
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      toast({ title: "Сохранено", description: "Данные опросника сохранены" });
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Ошибка сохранения";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setQSubmitting(false);
    }
  };
  
  useEffect(() => {
    loadEntries();
  }, []);
  
  const loadEntries = async () => {
    try {
      setIsLoading(true);
      
      if (user) {
        // Загружаем данные с сервера
        try {
          const response = await getMyTestEntries();
          const serverEntries = response.data.map((entry: any) => ({
            ...entry,
            date: new Date(entry.date)
          }));
          setEntries(serverEntries);
          
          // Обновляем локальное хранилище с данными с сервера
          testRepository.updateFromServer(serverEntries);
          
          console.log('Test entries loaded from server');
        } catch (error) {
          console.error('Error loading test entries from server:', error);
          
          // Если не удалось загрузить с сервера, используем локальные данные
          const localEntries = testRepository.getAll();
          setEntries(localEntries);
          
          toast({
            title: "Ошибка загрузки",
            description: "Не удалось загрузить записи с сервера, используются локальные данные.",
            variant: "destructive"
          });
        }
      } else {
        // Если пользователь не авторизован, используем локальные данные
        const localEntries = testRepository.getAll();
        setEntries(localEntries);
      }
    } catch (error) {
      console.error('Error loading test entries:', error);
      
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить записи о тестах.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setName("");
    setLink("");
    setScreenshotUrl("");
    setIsWeeklyTest(false);
    setEditingTest(null);
  };
  
  const handlePrevWeek = () => {
    setCurrentWeek(getPrevWeek(currentWeek));
  };
  
  const handleNextWeek = () => {
    setCurrentWeek(getNextWeek(currentWeek));
  };
  
  const handleSubmit = async () => {
    if (!name || !link) {
      toast({
        title: "Отсутствуют обязательные поля",
        description: "Заполните название и ссылку на тест",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const newEntry: Omit<TestEntry, "id"> = {
        date: new Date(date),
          name,
          link,
        screenshotUrl: screenshotUrl || undefined,
        isWeeklyTest
      };
      
      // Используем репозиторий для сохранения данных
      const savedEntry = testRepository.create(newEntry);
      
      // Если пользователь авторизован, пытаемся сразу сохранить на сервере
      if (user) {
        try {
          const response = await createTestEntry(newEntry);
          console.log('Test entry saved to server:', response.data);
        } catch (error) {
          console.error('Error saving test entry to server (will be synced later):', error);
        }
      }
      
      // Обновляем список записей
      await loadEntries();
      resetForm();
      setIsAddingEntry(false);
      
      toast({
        title: "Запись добавлена",
        description: "Запись о тесте успешно сохранена.",
      });
    } catch (error) {
      console.error('Error saving test entry:', error);
      
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить запись о тесте.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEdit = (test: TestEntry) => {
    setEditingTest(test);
    setName(test.name);
    setLink(test.link);
    setDate(test.date.toISOString().split('T')[0]);
    setIsWeeklyTest(test.isWeeklyTest);
    setIsDialogOpen(true);
  };
  
  const handleDelete = async (id: string) => {
    try {
      setIsLoading(true);
      
      // Удаляем запись через репозиторий
      testRepository.delete(id);
      
      // Обновляем список записей
      await loadEntries();
      
      toast({
        title: "Запись удалена",
        description: "Запись о тесте успешно удалена."
      });
    } catch (error) {
      console.error('Error deleting test entry:', error);
    
    toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить запись о тесте.",
        variant: "destructive"
    });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getWeekTests = () => {
    const { start, end } = getCurrentWeekRange(currentWeek);
    
    return entries.filter((test) => {
      const testDate = new Date(test.date);
      return testDate >= start && testDate <= end;
    });
  };
  
  const getDailyTests = () => {
    return getWeekTests().filter((test) => !test.isWeeklyTest);
  };
  
  const getWeeklyTests = () => {
    return getWeekTests().filter((test) => test.isWeeklyTest);
  };

  return (
    <div className="container mx-auto py-4">
      <div className="flex flex-col space-y-6">
        <Card style={COMPONENT_STYLES.card}>
          <CardHeader>
            <CardTitle style={COMPONENT_STYLES.text.title}>Тесты</CardTitle>
            <CardDescription style={COMPONENT_STYLES.text.description}>
              Управление результатами тестирования и опросов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue="daily" 
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "daily" | "weekly" | "questionnaire")}
            >
              <TabsList className="mb-4" style={COMPONENT_STYLES.tabs.list}>
                <TabsTrigger 
                  value="daily"
                  style={{ 
                    color: activeTab === 'daily' ? COLORS.textColor : COLORS.textColorSecondary, 
                    backgroundColor: activeTab === 'daily' ? COLORS.primary : 'transparent'
                  }}
                >
                  Ежедневные тесты
                </TabsTrigger>
                <TabsTrigger 
                  value="weekly"
                  style={{ 
                    color: activeTab === 'weekly' ? COLORS.textColor : COLORS.textColorSecondary, 
                    backgroundColor: activeTab === 'weekly' ? COLORS.primary : 'transparent'
                  }}
                >
                  Еженедельные тесты
                </TabsTrigger>
                <TabsTrigger 
                  value="questionnaire"
                  style={{ 
                    color: activeTab === 'questionnaire' ? COLORS.textColor : COLORS.textColorSecondary, 
                    backgroundColor: activeTab === 'questionnaire' ? COLORS.primary : 'transparent'
                  }}
                >
                  Опросник
                </TabsTrigger>
              </TabsList>
              <TabsContent value="daily">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.textColor }}>Рекомендуемые тесты</h3>
                  <Card style={COMPONENT_STYLES.card}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ borderColor: COLORS.borderColor }}>
                          <TableHead style={{ color: COLORS.textColor }}>Название теста</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Ссылка</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {predefinedTests.filter(test => !test.isWeeklyTest).map((test, index) => (
                          <TableRow key={`daily-${index}`} style={{ borderColor: COLORS.borderColor }}>
                            <TableCell className="font-medium" style={{ color: COLORS.textColor }}>{test.name}</TableCell>
                            <TableCell>
                              <a
                                href={test.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center"
                                style={{ color: COLORS.primary }}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Открыть тест
                              </a>
                            </TableCell>
                            <TableCell>
                              {!isStaff && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                                  onClick={() => {
                                    setName(test.name);
                                    setLink(test.link);
                                    setIsWeeklyTest(test.isWeeklyTest);
                                    setDate(new Date().toISOString().split('T')[0]);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Добавить результат
                                </Button>
                              )}
                              {isStaff && (
                                <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Только для игроков</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                {getDailyTests().length === 0 ? (
                  <div className="text-center py-8 rounded-lg" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, border: `1px solid ${COLORS.borderColor}` }}>
                    <Image className="h-12 w-12 mx-auto mb-2" style={{ color: COLORS.textColorSecondary }} />
                    <p style={{ color: COLORS.textColorSecondary }}>Нет ежедневных тестов на эту неделю</p>
                    {!isStaff && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                        onClick={() => {
                          resetForm();
                          setIsWeeklyTest(false);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить ежедневный тест
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md" style={{ border: `1px solid ${COLORS.borderColor}` }}>
                    <div className="grid grid-cols-12 p-4 font-medium" style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor }}>
                      <div className="col-span-3">Дата</div>
                      <div className="col-span-4">Название теста</div>
                      <div className="col-span-3">Ссылка / Скриншот</div>
                      <div className="col-span-2">Действия</div>
                    </div>
                    
                    {getDailyTests()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((test) => (
                        <div
                          key={test.id}
                          className="grid grid-cols-12 p-4 items-center"
                          style={{ borderTop: `1px solid ${COLORS.borderColor}`, color: COLORS.textColor }}
                        >
                          <div className="col-span-3 text-sm">
                            {formatDate(test.date)}
                          </div>
                          <div className="col-span-4 font-medium">
                            {test.name}
                          </div>
                          <div className="col-span-3 flex space-x-2">
                            <a
                              href={test.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                              style={{ color: COLORS.primary }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            {test.screenshotUrl && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" style={{ color: COLORS.primary }}>
                                    <Image className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                                  <DialogHeader>
                                    <DialogTitle style={{ color: COLORS.textColor }}>Скриншот теста: {test.name}</DialogTitle>
                                  </DialogHeader>
                                  <img
                                    src={test.screenshotUrl}
                                    alt={test.name}
                                    className="w-full h-auto rounded-md"
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          <div className="col-span-2 flex space-x-2">
                            {!isStaff && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.primary }}
                                  onClick={() => handleEdit(test)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.danger }}
                                  onClick={() => handleDelete(test.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isStaff && (
                              <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Просмотр</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="weekly">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2" style={{ color: COLORS.textColor }}>Рекомендуемые еженедельные тесты</h3>
                  <Card style={COMPONENT_STYLES.card}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ borderColor: COLORS.borderColor }}>
                          <TableHead style={{ color: COLORS.textColor }}>Название теста</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Ссылка</TableHead>
                          <TableHead style={{ color: COLORS.textColor }}>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {predefinedTests.filter(test => test.isWeeklyTest).map((test, index) => (
                          <TableRow key={`weekly-${index}`} style={{ borderColor: COLORS.borderColor }}>
                            <TableCell className="font-medium" style={{ color: COLORS.textColor }}>{test.name}</TableCell>
                            <TableCell>
                              <a
                                href={test.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center"
                                style={{ color: COLORS.primary }}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Открыть тест
                              </a>
                            </TableCell>
                            <TableCell>
                              {!isStaff && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                                  onClick={() => {
                                    setName(test.name);
                                    setLink(test.link);
                                    setIsWeeklyTest(test.isWeeklyTest);
                                    setDate(new Date().toISOString().split('T')[0]);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Добавить результат
                                </Button>
                              )}
                              {isStaff && (
                                <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Только для игроков</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>

                {getWeeklyTests().length === 0 ? (
                  <div className="text-center py-8 rounded-lg" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor, border: `1px solid ${COLORS.borderColor}` }}>
                    <Image className="h-12 w-12 mx-auto mb-2" style={{ color: COLORS.textColorSecondary }} />
                    <p style={{ color: COLORS.textColorSecondary }}>Нет еженедельных тестов на эту неделю</p>
                    {!isStaff && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
                        onClick={() => {
                          resetForm();
                          setIsWeeklyTest(true);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить еженедельный тест
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md" style={{ border: `1px solid ${COLORS.borderColor}` }}>
                    <div className="grid grid-cols-12 p-4 font-medium" style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor }}>
                      <div className="col-span-3">Дата</div>
                      <div className="col-span-4">Название теста</div>
                      <div className="col-span-3">Ссылка / Скриншот</div>
                      <div className="col-span-2">Действия</div>
                    </div>
                    
                    {getWeeklyTests()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((test) => (
                        <div
                          key={test.id}
                          className="grid grid-cols-12 p-4 items-center"
                          style={{ borderTop: `1px solid ${COLORS.borderColor}`, color: COLORS.textColor }}
                        >
                          <div className="col-span-3 text-sm">
                            {formatDate(test.date)}
                          </div>
                          <div className="col-span-4 font-medium">
                            {test.name}
                          </div>
                          <div className="col-span-3 flex space-x-2">
                            <a
                              href={test.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                              style={{ color: COLORS.primary }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            {test.screenshotUrl && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="icon" style={{ color: COLORS.primary }}>
                                    <Image className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
                                  <DialogHeader>
                                    <DialogTitle style={{ color: COLORS.textColor }}>Скриншот теста: {test.name}</DialogTitle>
                                  </DialogHeader>
                                  <img
                                    src={test.screenshotUrl}
                                    alt={test.name}
                                    className="w-full h-auto rounded-md"
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          <div className="col-span-2 flex space-x-2">
                            {!isStaff && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.primary }}
                                  onClick={() => handleEdit(test)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: COLORS.danger }}
                                  onClick={() => handleDelete(test.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isStaff && (
                              <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Просмотр</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questionnaire">
                <Card style={COMPONENT_STYLES.card}>
                  <CardHeader>
                    <CardTitle style={COMPONENT_STYLES.text.title}>Ежедневный опросник</CardTitle>
                    <CardDescription style={COMPONENT_STYLES.text.description}>
                      Настроение, энергия, сон и экранное время (всё переводим в цифру)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label style={{ color: COLORS.textColor }}>Дата</Label>
                      <Input
                        type="date"
                        value={qDate}
                        onChange={(e) => setQDate(e.target.value)}
                        style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Настроение (1-10)</Label>
                        <Input
                          value={qMood}
                          onChange={(e) => setQMood(e.target.value)}
                          inputMode="numeric"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Энергия (1-10)</Label>
                        <Input
                          value={qEnergy}
                          onChange={(e) => setQEnergy(e.target.value)}
                          inputMode="numeric"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Сон (часы)</Label>
                        <Input
                          value={qSleep}
                          onChange={(e) => setQSleep(e.target.value)}
                          inputMode="decimal"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label style={{ color: COLORS.textColor }}>Экранное время (часы)</Label>
                        <Input
                          value={qScreen}
                          onChange={(e) => setQScreen(e.target.value)}
                          inputMode="decimal"
                          style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={submitQuestionnaire} disabled={qSubmitting}>
                      {qSubmitting ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.textColor }}>
              {editingTest ? "Редактировать тест" : "Добавить тест"}
            </DialogTitle>
            <DialogDescription style={{ color: COLORS.textColorSecondary }}>
              {editingTest ? "Измените информацию о пройденном тесте" : "Заполните информацию о пройденном тесте"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right" style={{ color: COLORS.textColor }}>
                Название
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="link" className="text-right" style={{ color: COLORS.textColor }}>
                Ссылка
              </Label>
              <Input
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right" style={{ color: COLORS.textColor }}>
                Дата
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="col-span-3"
                style={{ backgroundColor: COLORS.backgroundColor, color: COLORS.textColor, borderColor: COLORS.borderColor }}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="weekly-test"
                className="text-right"
                style={{ color: COLORS.textColor }}
              >
                Еженедельный тест
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Switch
                  id="weekly-test"
                  checked={isWeeklyTest}
                  onCheckedChange={setIsWeeklyTest}
                />
                <Label htmlFor="weekly-test" style={{ color: COLORS.textColorSecondary }}>
                  {isWeeklyTest ? "Еженедельный" : "Ежедневный"}
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              style={{ borderColor: COLORS.borderColor, color: COLORS.textColor }}
            >
              Отмена
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}
            >
              {editingTest ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestTracker;
