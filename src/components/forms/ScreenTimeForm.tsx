import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const ScreenTimeForm: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [date, setDate] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [entertainment, setEntertainment] = useState('');
  const [communication, setCommunication] = useState('');
  const [browser, setBrowser] = useState('');
  const [study, setStudy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/players');
      if (response.data) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      toast.error('Ошибка при загрузке списка игроков');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId || !date) {
      toast.error('Заполните обязательные поля');
      return;
    }

    const inputTotalTime = parseFloat(totalTime) || 0;
    const categoryTotal = (parseFloat(entertainment) || 0) + 
                         (parseFloat(communication) || 0) + 
                         (parseFloat(browser) || 0) + 
                         (parseFloat(study) || 0);

    if (inputTotalTime > 24) {
      toast.error('Общее время не может превышать 24 часа');
      return;
    }

    if (categoryTotal > inputTotalTime) {
      toast.error('Сумма категорий не может превышать общее время');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/screen-time', {
        userId: selectedUserId,
        date,
        totalTime: inputTotalTime,
        entertainment: parseFloat(entertainment) || 0,
        communication: parseFloat(communication) || 0,
        browser: parseFloat(browser) || 0,
        study: parseFloat(study) || 0
      });

      if (response.data.success) {
        toast.success('Данные экранного времени успешно сохранены');
        setSelectedUserId('');
        setTotalTime('');
        setEntertainment('');
        setCommunication('');
        setBrowser('');
        setStudy('');
      }
    } catch (error: any) {
      console.error('Ошибка сохранения данных:', error);
      toast.error(error.response?.data?.message || 'Ошибка при сохранении данных');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryTotal = (): number => {
    return (parseFloat(entertainment) || 0) + 
           (parseFloat(communication) || 0) + 
           (parseFloat(browser) || 0) + 
           (parseFloat(study) || 0);
  };

  const getTotalTime = (): number => {
    return parseFloat(totalTime) || 0;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle>Ввод экранного времени</CardTitle>
        </div>
        <CardDescription>
          Введите данные экранного времени для игрока за выбранную дату
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="player">Игрок *</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Дата *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalTime">Общее время</Label>
              <Input
                id="totalTime"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={totalTime}
                onChange={(e) => setTotalTime(e.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entertainment">Развлечения</Label>
              <Input
                id="entertainment"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={entertainment}
                onChange={(e) => setEntertainment(e.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communication">Общение</Label>
              <Input
                id="communication"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={communication}
                onChange={(e) => setCommunication(e.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="browser">Браузер</Label>
              <Input
                id="browser"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                placeholder="0.0"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="study">Учеба</Label>
              <Input
                id="study"
                type="number"
                min="0"
                max="24"
                step="0.1"
                value={study}
                onChange={(e) => setStudy(e.target.value)}
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Общее время:</span>
              <span className={`text-lg font-bold ${
                getTotalTime() > 24 ? 'text-red-600' : 'text-green-600'
              }`}>
                {getTotalTime().toFixed(1)} ч
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Сумма категорий:</span>
              <span className={`text-lg font-bold ${
                getCategoryTotal() > getTotalTime() ? 'text-red-600' : 'text-blue-600'
              }`}>
                {getCategoryTotal().toFixed(1)} ч
              </span>
            </div>
            {getCategoryTotal() > getTotalTime() && (
              <div className="text-red-600 text-sm">
                ⚠️ Сумма категорий превышает общее время
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={loading || getTotalTime() > 24 || getCategoryTotal() > getTotalTime()}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ScreenTimeForm; 