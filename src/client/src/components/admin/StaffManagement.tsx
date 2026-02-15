import React, { useState, useEffect } from 'react';

// Интерфейс для сотрудника
interface Staff {
  id: string;
  _id?: string;
  name: string;
  email: string;
  hasPrivileges: boolean;
  createdAt: string;
}

// Интерфейс для формы добавления нового сотрудника
interface NewStaffFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

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

const StaffManagement: React.FC = () => {
  // Состояние для списка сотрудников
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Текущий авторизованный пользователь (для проверки возможности удаления)
  const [currentUser, setCurrentUser] = useState<{id: string} | null>(null);
  
  // Состояние для формы добавления нового сотрудника
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newStaffData, setNewStaffData] = useState<NewStaffFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Получение ID сотрудника (поддержка разных форматов)
  const getStaffId = (staff: Staff) => staff.id || staff._id || '';

  // Загрузка текущего пользователя
  useEffect(() => {
    // Получаем информацию о текущем пользователе из localStorage
    const userStr = localStorage.getItem('user');
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (e) {
        console.error('Ошибка при парсинге данных пользователя:', e);
      }
    }
  }, []);

  // Загрузка списка сотрудников
  const loadStaffList = async () => {
    setLoading(true);
    setError(null);
    try {
      const staffData = await getAllStaff();
      console.log('Loaded staff data:', staffData);
      setStaffList(staffData);
    } catch (err: any) {
      console.error('Error loading staff:', err);
      
      if (err.message?.includes('привилегий')) {
        setError('Для просмотра и управления сотрудниками требуется ключ привилегий');
      } else {
        setError(`Ошибка при загрузке списка сотрудников: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffList();
  }, []);

  // Обработка изменения ввода в форме
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewStaffData(prev => ({ ...prev, [name]: value }));
    
    // Очищаем ошибку поля при изменении
    if (formErrors[name]) {
      setFormErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  // Валидация формы
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newStaffData.name.trim()) {
      errors.name = 'Имя обязательно для заполнения';
    }
    
    if (!newStaffData.email.trim()) {
      errors.email = 'Email обязателен для заполнения';
    } else if (!/\S+@\S+\.\S+/.test(newStaffData.email)) {
      errors.email = 'Введите корректный email';
    }
    
    if (!newStaffData.password) {
      errors.password = 'Пароль обязателен для заполнения';
    } else if (newStaffData.password.length < 6) {
      errors.password = 'Пароль должен содержать не менее 6 символов';
    }
    
    if (newStaffData.password !== newStaffData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Добавление нового сотрудника
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const { confirmPassword, ...staffData } = newStaffData;
      const response = await createStaffMember(staffData);
      
      // Добавляем в локальный список
      const newStaff: Staff = {
        id: response.staff.id,
        _id: response.staff.id,
        name: response.staff.name,
        email: response.staff.email,
        hasPrivileges: response.staff.hasPrivileges || false,
        createdAt: response.staff.createdAt || new Date().toISOString()
      };
      
      setStaffList(prev => [newStaff, ...prev]);
      
      // Сбрасываем форму
      setNewStaffData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      
      setShowAddForm(false);
      setSuccessMessage(`Сотрудник ${response.staff.name} успешно добавлен`);
    } catch (err: any) {
      console.error('Error adding staff:', err);
      setError(`Ошибка при добавлении сотрудника: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Удаление сотрудника
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!window.confirm(`Вы действительно хотите удалить сотрудника ${staffName}? Это действие нельзя отменить.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await deleteStaffMember(staffId);
      
      // Обновляем локальный список
      setStaffList(prev => prev.filter(staff => getStaffId(staff) !== staffId));
      
      setSuccessMessage(`Сотрудник ${staffName} успешно удален`);
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      setError(`Ошибка при удалении сотрудника: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Обновление привилегий сотрудника
  const handleTogglePrivileges = async (staffId: string, staffName: string, currentStatus: boolean) => {
    const action = currentStatus ? 'отозвать' : 'предоставить';
    
    if (!window.confirm(`Вы действительно хотите ${action} привилегии у сотрудника ${staffName}?`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await updateStaffPrivileges(staffId, !currentStatus);
      
      // Обновляем локальный список
      setStaffList(prev => 
        prev.map(staff => 
          getStaffId(staff) === staffId
            ? { ...staff, hasPrivileges: response.hasPrivileges } 
            : staff
        )
      );
      
      setSuccessMessage(`Привилегии сотрудника ${staffName} успешно ${currentStatus ? 'отозваны' : 'предоставлены'}`);
    } catch (err: any) {
      console.error('Error updating staff privileges:', err);
      setError(`Ошибка при обновлении привилегий: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-white">Управление сотрудниками</h2>
      
      {/* Сообщения об ошибках и успешных операциях */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 shadow-sm">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">Ошибка</h3>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 shadow-sm">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">Успешно</h3>
              <div className="mt-1 text-sm">{successMessage}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Кнопка добавления нового сотрудника */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg mb-6 transition-colors duration-200 shadow-sm"
        >
          Добавить сотрудника
        </button>
      )}
      
      {/* Форма добавления нового сотрудника */}
      {showAddForm && (
        <div className="bg-gray-50 p-6 rounded-lg mb-6 shadow-sm border">
          <h3 className="text-xl font-semibold mb-4 text-gray-900">Добавление нового сотрудника</h3>
          
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Имя:</label>
              <input
                type="text"
                name="name"
                value={newStaffData.name}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${
                  formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="Введите имя сотрудника"
              />
              {formErrors.name && (
                <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email:</label>
              <input
                type="email"
                name="email"
                value={newStaffData.email}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${
                  formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="email@example.com"
              />
              {formErrors.email && (
                <p className="text-red-600 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль:</label>
              <input
                type="password"
                name="password"
                value={newStaffData.password}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${
                  formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="Минимум 6 символов"
              />
              {formErrors.password && (
                <p className="text-red-600 text-xs mt-1">{formErrors.password}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля:</label>
              <input
                type="password"
                name="confirmPassword"
                value={newStaffData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${
                  formErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="Повторите пароль"
              />
              {formErrors.confirmPassword && (
                <p className="text-red-600 text-xs mt-1">{formErrors.confirmPassword}</p>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 shadow-sm"
                disabled={loading}
              >
                {loading ? 'Добавление...' : 'Добавить сотрудника'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-200 shadow-sm"
                disabled={loading}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Список сотрудников */}
      {loading && !showAddForm ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Загрузка списка сотрудников...</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden border">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Имя
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата регистрации
                  </th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Привилегии
                  </th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
              </tr>
            </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {staffList.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-lg font-medium">Список сотрудников пуст</p>
                        <p className="text-sm">Добавьте первого сотрудника для начала работы</p>
                      </div>
                  </td>
                </tr>
              ) : (
                staffList.map(staff => (
                    <tr key={getStaffId(staff)} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{staff.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-900">
                      {formatDate(staff.createdAt)}
                        </div>
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          staff.hasPrivileges 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                          {staff.hasPrivileges ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Есть
                            </>
                          ) : (
                            'Нет'
                          )}
                      </span>
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center space-x-2">
                        {/* Отключаем возможность удалить себя или изменить свои привилегии */}
                          {currentUser?.id !== getStaffId(staff) && (
                          <>
                            <button
                              onClick={() => handleTogglePrivileges(
                                  getStaffId(staff), 
                                staff.name,
                                staff.hasPrivileges
                              )}
                                className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                                staff.hasPrivileges
                                    ? 'border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:ring-yellow-500'
                                    : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500'
                              }`}
                              disabled={loading}
                            >
                              {staff.hasPrivileges ? 'Отозвать' : 'Предоставить'}
                            </button>
                            
                            <button
                                onClick={() => handleDeleteStaff(getStaffId(staff), staff.name)}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                              disabled={loading}
                            >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              Удалить
                            </button>
                          </>
                        )}
                        
                          {currentUser?.id === getStaffId(staff) && (
                            <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-md">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            Текущий пользователь
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
      
      {/* Информационный блок */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Информация о привилегиях</h3>
        <p className="text-sm text-blue-700">
          Сотрудники с предоставленными привилегиями имеют доступ к управлению составом участников команды и персонала.
          Для получения привилегий необходимо ввести специальный ключ доступа в профиле пользователя.
        </p>
      </div>
    </div>
  );
};

export default StaffManagement; 