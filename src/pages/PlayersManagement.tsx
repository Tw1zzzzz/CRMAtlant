import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User } from "@/types";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getPlayers, deletePlayerComplete as apiDeletePlayer, checkStaffPrivilege } from "@/lib/api";
import { COLORS } from "@/styles/theme";
import { Key } from "lucide-react";

// Проверка валидности ID
const isValidId = (id: any): boolean => {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  if (id === 'undefined' || id === 'null') return false;
  if (id.trim() === '') return false;
  return true;
};

// Нормализация данных игрока для исправления проблем с ID
const normalizePlayer = (player: any): User => {
  if (!player) return null;
  
  // Проверка и нормализация ID
  let playerId = player._id || player.id;
  if (playerId && typeof playerId !== "string") {
    playerId = playerId.toString ? playerId.toString() : String(playerId);
  }
  if (!isValidId(playerId)) {
    console.warn('Player with invalid id:', player);
    
    // Если ID нет, но есть email, используем email как временный ID
    if (player.email) {
      playerId = `temp_${player.email.replace(/[^a-zA-Z0-9]/g, '')}`;
    }
  }
  
  return {
    ...player,
    id: playerId,
    name: player.name || player.username || 'Неизвестно',
    email: player.email || 'Нет email',
    role: player.role || 'player',
  };
};

const PlayersManagement = () => {
  const { user } = useAuth();
  const isTeamStaff = user?.role === "staff" && user?.playerType === "team";
  const [players, setPlayers] = useState<User[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [hasPrivilege, setHasPrivilege] = useState<boolean | null>(null);
  const [checkingPrivilege, setCheckingPrivilege] = useState(true);
  const navigate = useNavigate();

  // Проверка наличия ключа привилегий
  const checkPrivilege = async () => {
    try {
      setCheckingPrivilege(true);
      const response = await checkStaffPrivilege();
      setHasPrivilege(response.data.hasPrivilege);
    } catch (error) {
      console.error('Ошибка при проверке привилегий:', error);
      setHasPrivilege(false);
    } finally {
      setCheckingPrivilege(false);
    }
  };

  useEffect(() => {
    if (user?.role === "staff") {
      checkPrivilege();
    }
  }, [user]);

  // Загрузка списка игроков
  const loadPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getPlayers();
      console.log('Received players data:', response);
      
      // Нормализуем данные игроков
      const normalizedPlayers = Array.isArray(response.data) 
        ? response.data.map(normalizePlayer).filter(p => p !== null)
        : [];
        
      console.log('Normalized players:', normalizedPlayers);
      setPlayers(normalizedPlayers);
      
      // Проверка на наличие игроков без ID
      const invalidPlayers = normalizedPlayers.filter(p => !isValidId(p.id));
      if (invalidPlayers.length > 0) {
        console.warn(`Found ${invalidPlayers.length} players with invalid IDs:`, invalidPlayers);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Ошибка при загрузке игроков');
      toast.error('Не удалось загрузить список игроков');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasPrivilege) {
      loadPlayers();
    }
  }, [hasPrivilege]);

  const handleDeletePlayer = async () => {
    if (!selectedPlayer) {
      toast.error("Не удалось удалить игрока: игрок не выбран");
      setIsDialogOpen(false);
      return;
    }
    
    // Проверка ID перед операцией
    if (!isValidId(selectedPlayer.id)) {
      toast.error("Не удалось удалить игрока: идентификатор игрока отсутствует или некорректен");
      console.error("Попытка удаления игрока с некорректным ID:", selectedPlayer);
      setIsDialogOpen(false);
      return;
    }
    
    // Проверка подтверждения
    if (confirmText !== selectedPlayer.name) {
      toast.error("Имя игрока введено неверно. Удаление отменено.");
      setIsDialogOpen(false);
      return;
    }
    
    setIsDeleting(true);
    setDeleteProgress(10);
    
    try {
      // Сохраняем ID и имя перед операцией
      const playerId = String(selectedPlayer.id);
      const playerName = selectedPlayer.name;
      
      console.log(`Начинаю каскадное удаление игрока ${playerName} (${playerId})`);
      
      // Сначала закрываем диалог, чтобы избежать проблем с состоянием
      setIsDialogOpen(false);
      
      // Дополнительная проверка ID
      if (!isValidId(playerId)) {
        throw new Error(`Неверный идентификатор игрока: ${playerId}`);
      }
      
      // Индикация прогресса
      toast.info("Удаление данных игрока...");
      setDeleteProgress(30);
      
      // Выполняем запрос на каскадное удаление всех данных игрока
      await apiDeletePlayer(playerId);
      
      setDeleteProgress(90);
      
      console.log(`Игрок и все связанные данные успешно удалены: ${playerName} (${playerId})`);
      
      // Обновляем список игроков
      await loadPlayers();
      
      setDeleteProgress(100);
      toast.success(`Игрок ${playerName} и все его данные успешно удалены`);
    } catch (error) {
      console.error('Ошибка при удалении игрока:', error);
      toast.error(`Ошибка при удалении игрока: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsDeleting(false);
      setSelectedPlayer(null);
      setConfirmText("");
      setDeleteProgress(0);
    }
  };

  // Redirect if not staff
  if (user?.role !== "staff") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96" style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <CardHeader>
            <CardTitle style={{ color: COLORS.textColor }}>Доступ запрещен</CardTitle>
            <CardDescription style={{ color: COLORS.textColorSecondary }}>
              Эта страница доступна только для персонала команды
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full"
              onClick={() => navigate("/")}
              style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}
            >
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Показываем сообщение о необходимости ключа привилегий
  if (checkingPrivilege) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textColor }}>Управление игроками</h1>
        <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p style={{ color: COLORS.textColor }}>Проверка прав доступа...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Если нет ключа привилегий
  if (!hasPrivilege) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textColor }}>Управление игроками</h1>
        <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <CardHeader>
            <CardTitle style={{ color: COLORS.textColor }}>Доступ ограничен</CardTitle>
            <CardDescription style={{ color: COLORS.textColorSecondary }}>
              {isTeamStaff
                ? "Для этого профиля уже должен быть открыт доступ к управлению своей командой"
                : "Для управления составом участников требуется ключ привилегий"}
            </CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            <div className="flex flex-col items-center gap-4 py-6">
              <Key size={48} className="text-muted-foreground" />
              <p className="text-center" style={{ color: COLORS.textColor }}>
                {isTeamStaff
                  ? "Если экран открылся без доступа, значит профиль еще не привязан к команде."
                  : "Для получения доступа к управлению игроками необходимо добавить ключ привилегий в вашем профиле."}
              </p>
              <Button 
                onClick={() => navigate("/profile")}
                style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}
              >
                Перейти в профиль
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4">
      <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textColor }}>Управление игроками</h1>
      
      <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: COLORS.textColor }}>Список игроков</CardTitle>
          <CardDescription style={{ color: COLORS.textColorSecondary }}>
            Управление профилями игроков
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4" style={{ color: COLORS.textColorSecondary }}>
              <p>Загрузка...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4" style={{ color: COLORS.danger }}>
              <p>{error}</p>
              <Button 
                className="mt-2" 
                variant="outline" 
                onClick={() => loadPlayers()}
                style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
              >
                Обновить
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.borderColor}` }}>
                    <th className="px-3 py-2 text-left" style={{ color: COLORS.textColor }}>ID</th>
                    <th className="px-3 py-2 text-left" style={{ color: COLORS.textColor }}>Имя</th>
                    <th className="px-3 py-2 text-left" style={{ color: COLORS.textColor }}>Email</th>
                    <th className="px-3 py-2 text-center" style={{ color: COLORS.textColor }}>Статистика</th>
                    <th className="px-3 py-2 text-center" style={{ color: COLORS.textColor }}>Карточка</th>
                    <th className="px-3 py-2 text-right" style={{ color: COLORS.textColor }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(player => (
                    <tr key={player.id || player.email} style={{ borderBottom: `1px solid ${COLORS.borderColor}` }}>
                      <td className="px-3 py-3" style={{ color: COLORS.textColorSecondary, fontSize: '0.85rem' }}>
                        {isValidId(player.id) ? player.id.substring(0, 8) + '...' : 'Некорректный ID'}
                      </td>
                      <td className="px-3 py-3 font-medium" style={{ color: COLORS.textColor }}>{player.name}</td>
                      <td className="px-3 py-3" style={{ color: COLORS.textColor }}>{player.email}</td>
                      <td className="px-3 py-3 text-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            if (isValidId(player.id)) {
                              navigate(`/stats?playerId=${player.id}`);
                            } else {
                              toast.error("Невозможно просмотреть статистику: некорректный ID игрока");
                            }
                          }}
                          style={{ 
                            borderColor: "#3c83f6",
                            backgroundColor: "transparent", 
                            color: "#3c83f6"
                          }}
                        >
                          Статистика
                        </Button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            if (isValidId(player.id)) {
                              navigate(`/player-card/${player.id}`);
                            } else {
                              toast.error("Невозможно открыть карточку: некорректный ID игрока");
                            }
                          }}
                          style={{ 
                            borderColor: "#6b21a8",
                            backgroundColor: "transparent", 
                            color: "#8b5cf6"
                          }}
                          disabled={!isValidId(player.id)}
                        >
                          Карточка
                        </Button>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (isValidId(player.id)) {
                              setSelectedPlayer(player);
                              setIsDialogOpen(true);
                              setConfirmText("");
                            } else {
                              toast.error("Невозможно удалить: некорректный ID игрока");
                              console.error("Попытка удаления игрока с некорректным ID:", player);
                            }
                          }}
                          style={{ backgroundColor: COLORS.danger, color: COLORS.textColor }}
                          disabled={!isValidId(player.id)}
                        >
                          Удалить
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {players.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center" style={{ color: COLORS.textColorSecondary }}>
                        Нет доступных игроков
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        if (!isDeleting) {
          setIsDialogOpen(open);
          if (!open) {
            setConfirmText("");
          }
        }
      }}>
        <DialogContent 
          style={{ 
            backgroundColor: COLORS.dialogBackground, 
            borderColor: COLORS.borderColor,
            color: COLORS.textColor
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: COLORS.textColor }}>Подтвердите удаление</DialogTitle>
            <DialogDescription style={{ color: COLORS.textColorSecondary }}>
              Вы уверены, что хотите удалить игрока {selectedPlayer?.name}? 
              <br />
              <span className="font-semibold mt-2 block" style={{ color: COLORS.danger }}>
                Это действие необратимо и приведет к удалению ВСЕХ данных игрока из всех разделов, включая рейтинги и статистику.
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4">
            <label className="block text-sm mb-2" style={{ color: COLORS.textColor }}>
              Для подтверждения введите имя игрока <strong style={{ color: COLORS.primary }}>{selectedPlayer?.name}</strong>:
            </label>
            <input 
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full p-2 rounded border"
              style={{ 
                backgroundColor: COLORS.inputBackground, 
                borderColor: COLORS.inputBorder,
                color: COLORS.textColor
              }}
              placeholder="Введите имя игрока"
            />
          </div>
          
          {isValidId(selectedPlayer?.id) && (
            <div className="mb-4 p-2 rounded" style={{ backgroundColor: COLORS.backgroundColor, fontSize: '0.8rem' }}>
              <p style={{ color: COLORS.textColorSecondary }}>ID игрока: <span style={{ color: COLORS.primary }}>{selectedPlayer?.id}</span></p>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDialogOpen(false);
                setConfirmText("");
              }}
              disabled={isDeleting}
              style={{ 
                backgroundColor: COLORS.buttonSecondary,
                borderColor: COLORS.borderColor, 
                color: COLORS.textColor 
              }}
            >
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeletePlayer}
              disabled={isDeleting || confirmText !== selectedPlayer?.name}
              style={{ 
                backgroundColor: COLORS.danger, 
                color: COLORS.textColor,
                opacity: (confirmText !== selectedPlayer?.name && !isDeleting) ? 0.5 : 1
              }}
            >
              {isDeleting ? `Удаление... ${deleteProgress}%` : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayersManagement;
