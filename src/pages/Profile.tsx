import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Camera, Upload } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import StaffPrivilegeUpgrade from "@/components/StaffPrivilegeUpgrade";



/**
 * Интерфейс состояния профиля
 */
interface ProfileState {
  isDeleting: boolean;
  isDialogOpen: boolean;
  isUploadingAvatar: boolean;
  lastAvatarUpdate: number;
}

/**
 * Компонент страницы профиля пользователя
 * Отображает данные профиля и предоставляет возможность удаления аккаунта
 */
const Profile: React.FC = () => {
  const { user, deleteAccount, updateAvatar, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Объединение связанных состояний в один объект
  const [state, setState] = useState<ProfileState>({
    isDeleting: false,
    isDialogOpen: false,
    isUploadingAvatar: false,
    lastAvatarUpdate: 0
  });



  /**
   * Обработчик для изменения состояния диалога
   */
  const handleDialogChange = (open: boolean): void => {
    setState(prevState => ({ ...prevState, isDialogOpen: open }));
  };

  /**
   * Обработчик удаления аккаунта пользователя
   */
  const handleDeleteAccount = async (): Promise<void> => {
    // Устанавливаем состояние удаления
    setState(prevState => ({ ...prevState, isDeleting: true }));
    
    try {
      await deleteAccount();
      // После успешного удаления перенаправляем на страницу входа
      navigate("/login");
    } catch (error) {
      console.error("Ошибка при удалении аккаунта:", error);
    } finally {
      // Сбрасываем состояния независимо от результата
      setState(prevState => ({ 
        ...prevState, 
        isDeleting: false, 
        isDialogOpen: false 
      }));
    }
  };

  /**
   * Открывает диалог выбора файла
   */
  const handleAvatarClick = (): void => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /**
   * Обработчик загрузки аватара
   */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Проверка размера файла (макс. 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер - 5MB');
      return;
    }

    setState(prevState => ({ ...prevState, isUploadingAvatar: true }));
    
    try {
      console.log('Отправляем запрос на загрузку аватара...');
      const result = await updateAvatar(file);
      
      if (result.success) {
        console.log('Аватар успешно загружен:', result.avatar);
        
        // Принудительно обновляем состояние компонента
        setState(prevState => ({ 
          ...prevState, 
          isUploadingAvatar: false,
          // Добавляем временную метку, чтобы принудительно обновить UI
          lastAvatarUpdate: Date.now() 
        }));
        
        // Добавляем небольшую задержку перед проверкой 
        setTimeout(() => {
          // Делаем GET-запрос для проверки статуса аватара
          fetch('/api/auth/avatar/check')
            .then(res => res.json())
            .then(data => {
              console.log('Проверка аватара:', data);
            })
            .catch(err => {
              console.error('Ошибка при проверке аватара:', err);
            });
        }, 500);
      } else {
        console.error('Ошибка при загрузке аватара:', result.error);
        setState(prevState => ({ ...prevState, isUploadingAvatar: false }));
      }
    } catch (error) {
      console.error("Ошибка при загрузке аватара:", error);
      setState(prevState => ({ ...prevState, isUploadingAvatar: false }));
    } finally {
      // Очищаем поле ввода для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };



  /**
   * Компонент для неавторизованных пользователей
   */
  const UnauthenticatedView = () => (
    <div className="flex items-center justify-center h-full performance-page">
      <Card className="w-full max-w-md performance-hero">
        <CardHeader>
          <CardTitle>Требуется авторизация</CardTitle>
          <CardDescription>
            Для доступа к профилю необходимо войти в систему
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => navigate("/login")}>
            Войти
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  // Если пользователь не авторизован, показываем соответствующий компонент
  if (!user) {
    return <UnauthenticatedView />;
  }

  const { isDeleting, isDialogOpen, isUploadingAvatar, lastAvatarUpdate } = state;

  return (
    <div className="container mx-auto py-6 performance-page">
      <span className="performance-eyebrow">Identity Center</span>
      <h1 className="text-3xl font-bold mb-2 performance-title">Профиль пользователя</h1>
      <p className="text-muted-foreground performance-subtitle mb-6">
        Управление персональными данными, правами и настройками аккаунта.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Карточка с информацией о профиле */}
        <Card className="performance-hero">
          <CardHeader>
            <CardTitle>Информация о профиле</CardTitle>
            <CardDescription>
              Ваши персональные данные
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Аватар пользователя */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <UserAvatar 
                  user={user} 
                  size="xl" 
                  className="cursor-pointer"
                  onClick={handleAvatarClick}
                  key={`profile-avatar-${lastAvatarUpdate}`}
                  forceUpdate={true}
                />
                <div 
                  className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  <Camera className="text-white" size={24} />
                </div>
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-white"></div>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs flex items-center gap-1"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
              >
                <Upload size={14} />
                Изменить аватар
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Имя</Label>
              <div className="p-2 bg-muted rounded">{user.name}</div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="p-2 bg-muted rounded">{user.email}</div>
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <div className="p-2 bg-muted rounded">
                {user.role === "player" ? "Игрок" : "Стафф"}
              </div>
            </div>


          </CardContent>
          <CardFooter>
            {/* Диалог подтверждения удаления аккаунта */}
            <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button variant="destructive">Удалить аккаунт</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Вы уверены?</DialogTitle>
                  <DialogDescription>
                    Эта операция безвозвратно удалит ваш аккаунт и все связанные данные.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => handleDialogChange(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Удаление..." : "Удалить"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
        
        {/* Карточка со статистикой */}
        <Card>
          <CardHeader>
            <CardTitle>Статистика</CardTitle>
            <CardDescription>
              Сводка вашей активности
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded">
              <p className="text-sm">Эта секция будет содержать вашу персональную статистику.</p>
            </div>
            {/* Дополнительная статистика может быть добавлена здесь */}
          </CardContent>
        </Card>

        {user.role === "staff" && (
          <Card>
            <CardHeader>
              <CardTitle>Права и доступ</CardTitle>
              <CardDescription>
                Управление привилегиями сотрудника
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffPrivilegeUpgrade
                onUpgradeSuccess={refreshUser}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
