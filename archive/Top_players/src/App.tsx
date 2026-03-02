import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Star, Award, Plus, Minus } from 'lucide-react';
import axios from 'axios';

interface Player {
  rank: number;
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  gamePoints: number;
  nonGamePoints: number;
  discipline: number;
}

interface Stats {
  totalPlayers: number;
  activePlayers: number;
  averageRating: number;
  monthlyTournaments: number;
}

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPlayers: 0,
    activePlayers: 0,
    averageRating: 0,
    monthlyTournaments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [pointsForm, setPointsForm] = useState({
    points: 0,
    pointType: 'gamePoints',
    operation: 'add'
  });

  // Используем значение по умолчанию, если переменная окружения не задана
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  
  // Проверка авторизации и роли пользователя
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(response => {
        setIsStaff(response.data.role === 'staff');
      })
      .catch(err => {
        console.error('Ошибка при проверке авторизации:', err);
      });
    }
  }, [API_URL]);

  // Загрузка данных игроков
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/api/player-rating/top?period=${period}`)
      .then(response => {
        setPlayers(response.data.players);
        setStats(response.data.stats);
        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка при загрузке данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
        setLoading(false);
      });
  }, [period, API_URL]);

  // Обработчик изменения периода
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  // Обработчик изменения полей формы начисления очков
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPointsForm(prev => ({ ...prev, [name]: name === 'points' ? parseInt(value) : value }));
  };

  // Обработчик отправки формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Требуется авторизация');
      return;
    }
    
    try {
      const response = await axios.put(
        `${API_URL}/api/player-rating/${selectedPlayer.id}`,
        pointsForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Рейтинг обновлен:', response.data);
      
      // Обновляем список игроков
      axios.get(`${API_URL}/api/player-rating/top?period=${period}`)
        .then(response => {
          setPlayers(response.data.players);
          setSelectedPlayer(null);
        });
    } catch (err) {
      console.error('Ошибка при обновлении рейтинга:', err);
      setError('Не удалось обновить рейтинг. Пожалуйста, попробуйте позже.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div className="text-xl text-gray-600">Загрузка данных...</div>
    </div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div className="text-xl text-red-600">{error}</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1f2e]">Рейтинг игроков академии</h1>
            <p className="text-gray-500">Статистика и достижения игроков академии</p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => handlePeriodChange('week')}
              className={`px-4 py-2 bg-white text-[#1a1f2e] rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 ${period === 'week' ? 'bg-blue-100 border-blue-300' : ''}`}
            >
              За неделю
            </button>
            <button 
              onClick={() => handlePeriodChange('month')}
              className={`px-4 py-2 bg-white text-[#1a1f2e] rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 ${period === 'month' ? 'bg-blue-100 border-blue-300' : ''}`}
            >
              За месяц
            </button>
            <button 
              onClick={() => handlePeriodChange('all')}
              className={`px-4 py-2 bg-white text-[#1a1f2e] rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 ${period === 'all' ? 'bg-blue-100 border-blue-300' : ''}`}
            >
              За все время
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500">Всего игроков</p>
                <h2 className="text-3xl font-bold text-[#1a1f2e] mt-2">{stats.totalPlayers}</h2>
                <p className="text-sm text-gray-500 mt-1">Активных пользователей</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500">Активных игроков</p>
                <h2 className="text-3xl font-bold text-[#1a1f2e] mt-2">{stats.activePlayers}</h2>
                <p className="text-sm text-gray-500 mt-1">В этом месяце</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500">Средний рейтинг</p>
                <h2 className="text-3xl font-bold text-[#1a1f2e] mt-2">{stats.averageRating}</h2>
                <p className="text-sm text-gray-500 mt-1">По всем игрокам</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500">Турниров за месяц</p>
                <h2 className="text-3xl font-bold text-[#1a1f2e] mt-2">{stats.monthlyTournaments}</h2>
                <p className="text-sm text-gray-500 mt-1">Проведено турниров</p>
              </div>
            </div>
          </div>
        </div>

        {/* Форма для начисления очков персоналом */}
        {isStaff && selectedPlayer && (
          <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
            <h2 className="text-xl font-bold mb-4">Изменение рейтинга игрока: {selectedPlayer.name}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Количество очков</label>
                <input
                  type="number"
                  name="points"
                  value={pointsForm.points}
                  onChange={handleFormChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип очков</label>
                <select
                  name="pointType"
                  value={pointsForm.pointType}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="gamePoints">Игровые очки</option>
                  <option value="nonGamePoints">Вне игровые очки</option>
                  <option value="discipline">Дисциплина</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Операция</label>
                <select
                  name="operation"
                  value={pointsForm.operation}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="add">Добавить</option>
                  <option value="subtract">Вычесть</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mr-2"
                >
                  Сохранить
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rankings Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Ранг</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Игрок</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Рейтинг</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Очки игровые</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Вне игровые</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Дисциплина</th>
                {isStaff && <th className="px-6 py-4 text-left text-gray-500 font-medium">Действия</th>}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 flex items-center">
                    {player.rank === 1 && <Trophy className="w-5 h-5 text-yellow-400 mr-2" />}
                    {player.rank === 2 && <Medal className="w-5 h-5 text-gray-400 mr-2" />}
                    {player.rank === 3 && <Award className="w-5 h-5 text-orange-400 mr-2" />}
                    {player.rank > 3 && <span className="w-5 mr-2 text-gray-500">{player.rank}</span>}
                  </td>
                  <td className="px-6 py-4 text-[#1a1f2e] font-medium">
                    <div className="flex items-center">
                      {player.avatar && (
                        <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full mr-2" />
                      )}
                      {player.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#1a1f2e]">{player.rating}</td>
                  <td className="px-6 py-4 text-[#1a1f2e]">{player.gamePoints}</td>
                  <td className="px-6 py-4 text-[#1a1f2e]">{player.nonGamePoints}</td>
                  <td className="px-6 py-4 text-[#1a1f2e]">{player.discipline}</td>
                  {isStaff && (
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedPlayer(player)}
                        className="text-blue-600 hover:text-blue-800 focus:outline-none"
                      >
                        Изменить очки
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;