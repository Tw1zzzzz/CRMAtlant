import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "@/types";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { checkStaffPrivilege } from "@/lib/api";
import { COLORS } from "@/styles/theme";
import { Key, UserPlus, Users, Shield, UserMinus, Edit2, User as UserIcon, Mail, Lock, Info, X } from "lucide-react";
import ROUTES from '../lib/routes';

// API функции для работы с персоналом
const getAllStaff = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/staff', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при получении списка персонала');
  }
  
  return response.json();
};

const updateStaffPrivileges = async (staffId: string, grantPrivileges: boolean) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/staff/${staffId}/privileges`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ grantPrivileges })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при обновлении привилегий');
  }
  
  return response.json();
};

const deleteStaffMember = async (staffId: string) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/staff/${staffId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при удалении сотрудника');
  }
  
  return response.json();
};

const createStaffMember = async (staffData: { name: string; email: string; password: string }) => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/staff', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(staffData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Ошибка при создании сотрудника');
  }
  
  return response.json();
};

interface StaffMember {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: string;
  hasPrivileges: boolean;
  createdAt: string;
}

const StaffRoster = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPrivilege, setHasPrivilege] = useState<boolean | null>(null);
  const [checkingPrivilege, setCheckingPrivilege] = useState(true);
  
  // Состояние для диалога добавления сотрудника
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Загрузка персонала
  const loadStaffMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const staffData = await getAllStaff();
      console.log('Loaded staff data:', staffData);
      setStaffMembers(staffData);
    } catch (err: any) {
      console.error('Error fetching staff members:', err);
      setError('Ошибка при загрузке персонала: ' + err.message);
      toast.error('Не удалось загрузить список персонала');
    } finally {
      setIsLoading(false);
    }
  };

  // Обработка изменения привилегий
  const handleTogglePrivileges = async (staffId: string, staffName: string, currentPrivileges: boolean) => {
    const action = currentPrivileges ? 'отозвать' : 'предоставить';
    
    if (!window.confirm(`Вы действительно хотите ${action} привилегии у сотрудника ${staffName}?`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await updateStaffPrivileges(staffId, !currentPrivileges);
      
      // Обновляем локальный список
      setStaffMembers(prev => 
        prev.map(staff => 
          staff.id === staffId || staff._id === staffId
            ? { ...staff, hasPrivileges: response.hasPrivileges } 
            : staff
        )
      );
      
      toast.success(`Привилегии сотрудника ${staffName} успешно ${currentPrivileges ? 'отозваны' : 'предоставлены'}`);
    } catch (err: any) {
      console.error('Error updating privileges:', err);
      toast.error('Ошибка при обновлении привилегий: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Обработка удаления сотрудника
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!window.confirm(`Вы действительно хотите удалить сотрудника ${staffName}? Это действие нельзя отменить.`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      await deleteStaffMember(staffId);
      
      // Удаляем из локального списка
      setStaffMembers(prev => prev.filter(staff => staff.id !== staffId && staff._id !== staffId));
      
      toast.success(`Сотрудник ${staffName} успешно удален`);
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      toast.error('Ошибка при удалении сотрудника: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Обработка добавления нового сотрудника
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newStaffData.name.trim() || !newStaffData.email.trim() || !newStaffData.password.trim()) {
      toast.error('Заполните все поля');
      return;
    }
    
    if (newStaffData.password.length < 6) {
      toast.error('Пароль должен содержать не менее 6 символов');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const response = await createStaffMember(newStaffData);
      
      // Добавляем в локальный список
      const newStaff: StaffMember = {
        id: response.staff.id,
        _id: response.staff.id,
        name: response.staff.name,
        email: response.staff.email,
        role: response.staff.role,
        hasPrivileges: response.staff.hasPrivileges || false,
        createdAt: response.staff.createdAt || new Date().toISOString()
      };
      
      setStaffMembers(prev => [newStaff, ...prev]);
      
      // Сбрасываем форму и закрываем диалог
      setNewStaffData({ name: '', email: '', password: '' });
      setShowAddDialog(false);
      
      toast.success(`Сотрудник ${response.staff.name} успешно добавлен`);
    } catch (err: any) {
      console.error('Error adding staff:', err);
      toast.error('Ошибка при добавлении сотрудника: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Получение ID сотрудника (поддержка разных форматов)
  const getStaffId = (staff: StaffMember) => staff.id || staff._id;

  useEffect(() => {
    if (user?.role === "staff") {
      checkPrivilege();
    }
  }, [user]);

  useEffect(() => {
    if (hasPrivilege) {
      loadStaffMembers();
    }
  }, [hasPrivilege]);

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

  // Показываем сообщение о проверке привилегий
  if (checkingPrivilege) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textColor }}>Управление персоналом</h1>
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
        <h1 className="text-2xl font-bold mb-4" style={{ color: COLORS.textColor }}>Управление персоналом</h1>
        <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <CardHeader>
            <CardTitle style={{ color: COLORS.textColor }}>Доступ ограничен</CardTitle>
            <CardDescription style={{ color: COLORS.textColorSecondary }}>
              Для управления составом персонала требуется ключ привилегий
            </CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            <div className="flex flex-col items-center gap-4 py-6">
              <Key size={48} className="text-muted-foreground" />
              <p className="text-center" style={{ color: COLORS.textColor }}>
                Для получения доступа к управлению персоналом необходимо добавить ключ привилегий в вашем профиле.
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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.textColor }}>Управление персоналом</h1>
        <div className="flex space-x-2">
          <Link to={ROUTES.STAFF_MANAGEMENT}>
            <Button style={{ backgroundColor: COLORS.info, color: COLORS.textColor }}>
              <Users className="mr-2 h-4 w-4" />
              Расширенное управление
            </Button>
          </Link>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: COLORS.primary, color: COLORS.textColor }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Добавить сотрудника
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="max-w-md mx-auto"
              style={{ 
                backgroundColor: COLORS.cardBackground, 
                borderColor: COLORS.borderColor,
                color: COLORS.textColor
              }}
            >
              <DialogHeader className="text-center pb-4">
                <div 
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  <UserPlus className="h-6 w-6" style={{ color: COLORS.textColor }} />
                </div>
                <DialogTitle 
                  className="text-2xl font-bold"
                  style={{ color: COLORS.textColor }}
                >
                  Добавить сотрудника
                </DialogTitle>
                <DialogDescription 
                  className="mt-2"
                  style={{ color: COLORS.textColorSecondary }}
                >
                  Введите данные для создания нового сотрудника команды
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="space-y-4">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="name" 
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: COLORS.textColor }}
                    >
                      <UserIcon className="h-4 w-4" style={{ color: COLORS.primary }} />
                      Полное имя
                    </Label>
                    <div className="relative">
                      <Input
                        id="name"
                        value={newStaffData.name}
                        onChange={(e) => setNewStaffData(prev => ({ ...prev, name: e.target.value }))}
                        className="pl-10 h-11 rounded-lg transition-all duration-200"
                        style={{ 
                          backgroundColor: COLORS.inputBackground, 
                          borderColor: COLORS.inputBorder,
                          color: COLORS.textColor
                        }}
                        placeholder="Введите полное имя"
                        required
                      />
                      <UserIcon 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                        style={{ color: COLORS.textColorSecondary }}
                      />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="email" 
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: COLORS.textColor }}
                    >
                      <Mail className="h-4 w-4" style={{ color: COLORS.primary }} />
                      Электронная почта
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        value={newStaffData.email}
                        onChange={(e) => setNewStaffData(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 h-11 rounded-lg transition-all duration-200"
                        style={{ 
                          backgroundColor: COLORS.inputBackground, 
                          borderColor: COLORS.inputBorder,
                          color: COLORS.textColor
                        }}
                        placeholder="example@company.com"
                        required
                      />
                      <Mail 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                        style={{ color: COLORS.textColorSecondary }}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label 
                      htmlFor="password" 
                      className="text-sm font-medium flex items-center gap-2"
                      style={{ color: COLORS.textColor }}
                    >
                      <Lock className="h-4 w-4" style={{ color: COLORS.primary }} />
                      Временный пароль
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type="password"
                        value={newStaffData.password}
                        onChange={(e) => setNewStaffData(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 h-11 rounded-lg transition-all duration-200"
                        style={{ 
                          backgroundColor: COLORS.inputBackground, 
                          borderColor: COLORS.inputBorder,
                          color: COLORS.textColor
                        }}
                        placeholder="Минимум 6 символов"
                        required
                        minLength={6}
                      />
                      <Lock 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                        style={{ color: COLORS.textColorSecondary }}
                      />
                    </div>
                    <p 
                      className="text-xs flex items-center gap-1"
                      style={{ color: COLORS.textColorSecondary }}
                    >
                      <Info className="h-3 w-3" />
                      Пользователь сможет изменить пароль после первого входа
                    </p>
                  </div>
                </div>

                <div 
                  className="pt-4 border-t"
                  style={{ borderColor: COLORS.borderColor }}
                >
                  <DialogFooter className="flex gap-3 sm:gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddDialog(false)}
                      disabled={isSubmitting}
                      className="flex-1 h-11 rounded-lg transition-all duration-200"
                      style={{ 
                        borderColor: COLORS.borderColor, 
                        color: COLORS.textColorSecondary,
                        backgroundColor: 'transparent'
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Отмена
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 h-11 rounded-lg font-medium transition-all duration-200"
                      style={{ 
                        backgroundColor: COLORS.primary, 
                        color: COLORS.textColor,
                        boxShadow: `0 2px 6px 0 rgba(53, 144, 255, 0.2)`
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <div 
                            className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent mr-2"
                            style={{ borderColor: COLORS.textColor }}
                          ></div>
                          Создание...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Создать сотрудника
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: COLORS.textColor }}>Персонал команды</CardTitle>
          <CardDescription style={{ color: COLORS.textColorSecondary }}>
            Управление составом персонала и их привилегиями
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
                onClick={() => loadStaffMembers()}
                style={{ borderColor: COLORS.borderColor, color: COLORS.primary }}
              >
                Обновить
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.borderColor}` }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.textColor }}>
                      Имя
                    </th>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.textColor }}>
                      Email
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ color: COLORS.textColor }}>
                      Привилегии
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ color: COLORS.textColor }}>
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffMembers.map(staff => (
                    <tr 
                      key={getStaffId(staff)} 
                      style={{ borderBottom: `1px solid ${COLORS.borderColor}` }}
                      className="hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-4" style={{ color: COLORS.textColor }}>
                        <div className="font-medium">{staff.name}</div>
                      </td>
                      <td className="px-4 py-4" style={{ color: COLORS.textColor }}>
                        {staff.email}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {staff.hasPrivileges ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Shield className="w-3 h-3 mr-1" />
                            Есть
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Нет
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center space-x-2">
                          {/* Проверяем, что это не текущий пользователь */}
                          {user?.id !== getStaffId(staff) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePrivileges(getStaffId(staff), staff.name, staff.hasPrivileges)}
                                className={staff.hasPrivileges ? 
                                  "text-yellow-600 border-yellow-300 hover:bg-yellow-50" : 
                                  "text-blue-600 border-blue-300 hover:bg-blue-50"
                                }
                                disabled={isLoading}
                              >
                                {staff.hasPrivileges ? 'Отозвать' : 'Предоставить'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteStaff(getStaffId(staff), staff.name)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                                disabled={isLoading}
                              >
                                <UserMinus className="w-4 h-4" />
                                Удалить
                              </Button>
                            </>
                          )}
                          {user?.id === getStaffId(staff) && (
                            <span className="text-sm text-gray-500 italic px-2 py-1">
                              Текущий пользователь
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {staffMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center" style={{ color: COLORS.textColorSecondary }}>
                        <div className="flex flex-col items-center space-y-2">
                          <Users className="w-8 h-8 text-gray-400" />
                          <p>Нет сотрудников в команде</p>
                          <p className="text-sm">Добавьте первого сотрудника для начала работы</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-6 border-t pt-4" style={{ borderColor: COLORS.borderColor }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: COLORS.textColor }}>
              Информация о привилегиях
            </h3>
            <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
              Сотрудники с предоставленными привилегиями имеют доступ к управлению составом участников команды и персонала.
              Для получения привилегий необходимо ввести специальный ключ доступа в профиле пользователя.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffRoster; 