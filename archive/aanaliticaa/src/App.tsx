import React, { useState } from 'react';
import { Trophy, Crosshair, Target, Swords, LineChart as ChartLineUp, Medal, Upload, User, Users, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PlayerStats {
  id: number;
  name: string;
  kills: number;
  deaths: number;
  kdRatio: number;
  headshotPercentage: number;
  accuracy: number;
  winRate: number;
  hltvRating: number;
  winRateHistory: { date: string; value: number }[];
}

interface TeamStats {
  totalWins: number;
  winRate: number;
  longestWinStreak: number;
  recentResults: string;
  kdRatio: number;
  headshotPercentage: number;
  hltvRanking: number;
  hltvPoints: number;
  practiceStats: {
    totalWins: number;
    winRate: number;
    kdRatio: number;
    headshotPercentage: number;
  };
  winRateHistory: { date: string; official: number; practice: number }[];
}

function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmaps'>('overview');
  const [selectedMapType, setSelectedMapType] = useState<'practice' | 'official'>('official');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statsView, setStatsView] = useState<'team' | 'personal'>('team');
  const [showPractice, setShowPractice] = useState<boolean>(false);

  const teamStats: TeamStats = {
    totalWins: 9293,
    winRate: 53,
    longestWinStreak: 18,
    recentResults: 'WLWWW',
    kdRatio: 1.13,
    headshotPercentage: 53,
    hltvRanking: 15,
    hltvPoints: 254,
    practiceStats: {
      totalWins: 4567,
      winRate: 61,
      kdRatio: 1.25,
      headshotPercentage: 58
    },
    winRateHistory: [
      { date: '2024-01', official: 51, practice: 59 },
      { date: '2024-02', official: 53, practice: 61 },
      { date: '2024-03', official: 52, practice: 63 },
      { date: '2024-04', official: 53, practice: 61 }
    ]
  };

  const players: PlayerStats[] = [
    {
      id: 1,
      name: 'Player 1',
      kills: 2456,
      deaths: 2100,
      kdRatio: 1.17,
      headshotPercentage: 58,
      accuracy: 45,
      winRate: 56,
      hltvRating: 1.15,
      winRateHistory: [
        { date: '2024-01', value: 54 },
        { date: '2024-02', value: 55 },
        { date: '2024-03', value: 56 },
        { date: '2024-04', value: 56 }
      ]
    },
    {
      id: 2,
      name: 'Player 2',
      kills: 2890,
      deaths: 2300,
      kdRatio: 1.26,
      headshotPercentage: 62,
      accuracy: 48,
      winRate: 59,
      hltvRating: 1.23,
      winRateHistory: [
        { date: '2024-01', value: 57 },
        { date: '2024-02', value: 58 },
        { date: '2024-03', value: 58 },
        { date: '2024-04', value: 59 }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">1WIN Tracker Academy</h1>
            <div className="flex items-center space-x-4">
              <button
                className={`px-4 py-2 rounded-lg ${
                  activeTab === 'overview' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setActiveTab('overview')}
              >
                Обзор
              </button>
              <button
                className={`px-4 py-2 rounded-lg ${
                  activeTab === 'heatmaps' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setActiveTab('heatmaps')}
              >
                Командная тепловая карта
              </button>
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'overview' ? (
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Stats Type Selector */}
          <div className="flex justify-end mb-6">
            <div className="bg-white rounded-lg shadow-sm p-1">
              <button
                className={`px-4 py-2 rounded-lg ${
                  statsView === 'team' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setStatsView('team')}
              >
                <Users className="h-5 w-5 inline-block mr-2" />
                Командная
              </button>
              <button
                className={`px-4 py-2 rounded-lg ${
                  statsView === 'personal' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setStatsView('personal')}
              >
                <User className="h-5 w-5 inline-block mr-2" />
                Личная
              </button>
            </div>
          </div>

          {statsView === 'team' ? (
            <>
              {/* Stats Type Toggle */}
              <div className="flex justify-end mb-6">
                <button
                  className={`px-4 py-2 rounded-lg ${
                    !showPractice ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => setShowPractice(false)}
                >
                  Официальные игры
                </button>
                <button
                  className={`px-4 py-2 rounded-lg ml-2 ${
                    showPractice ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => setShowPractice(true)}
                >
                  Праки
                </button>
              </div>

              {/* HLTV Ranking */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">HLTV Рейтинг</h2>
                  <Medal className="h-8 w-8 text-gray-600" />
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-4xl font-bold text-gray-800">#{teamStats.hltvRanking}</p>
                    <p className="text-sm text-gray-500">Текущая позиция</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-gray-800">{teamStats.hltvPoints}</p>
                    <p className="text-sm text-gray-500">Очки рейтинга</p>
                  </div>
                </div>
              </div>

              {/* Win Rate Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                <h2 className="text-xl font-bold mb-6">Динамика винрейта</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={teamStats.winRateHistory}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="official" stroke="#2563eb" name="Официальные" />
                      <Line type="monotone" dataKey="practice" stroke="#16a34a" name="Праки" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Team Performance Stats */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Основная статистика</h2>
                  <ChartLineUp className="h-8 w-8 text-gray-600" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <Trophy className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">
                      {showPractice ? teamStats.practiceStats.totalWins : teamStats.totalWins}
                    </p>
                    <p className="text-sm text-gray-500">Всего побед</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <Target className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">
                      {showPractice ? teamStats.practiceStats.winRate : teamStats.winRate}%
                    </p>
                    <p className="text-sm text-gray-500">Процент побед</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <Swords className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">{teamStats.longestWinStreak}</p>
                    <p className="text-sm text-gray-500">Победная серия</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <ChartLineUp className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">{teamStats.recentResults}</p>
                    <p className="text-sm text-gray-500">Последние матчи</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <Crosshair className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">
                      {showPractice ? teamStats.practiceStats.kdRatio : teamStats.kdRatio}
                    </p>
                    <p className="text-sm text-gray-500">K/D</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <Target className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-800">
                      {showPractice ? teamStats.practiceStats.headshotPercentage : teamStats.headshotPercentage}%
                    </p>
                    <p className="text-sm text-gray-500">Headshots</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Личная статистика игроков</h2>
                <User className="h-8 w-8 text-gray-600" />
              </div>
              <div className="space-y-6">
                {players.map(player => (
                  <div key={player.id} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{player.name}</h3>
                        <div className="text-sm text-gray-500 mt-1">
                          HLTV Rating: {player.hltvRating}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Винрейт: {player.winRate}%
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-800">{player.kills}</p>
                        <p className="text-sm text-gray-500">Убийства</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-800">{player.deaths}</p>
                        <p className="text-sm text-gray-500">Смерти</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-800">{player.kdRatio}</p>
                        <p className="text-sm text-gray-500">K/D</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-800">{player.headshotPercentage}%</p>
                        <p className="text-sm text-gray-500">Headshots</p>
                      </div>
                    </div>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={player.winRateHistory}>
                          <XAxis dataKey="date" />
                          <YAxis domain={[40, 70]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#2563eb" name="Винрейт" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-col space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Командная тепловая карта</h2>
                <div className="flex items-center space-x-4">
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      selectedMapType === 'practice' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => setSelectedMapType('practice')}
                  >
                    Праки
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg ${
                      selectedMapType === 'official' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => setSelectedMapType('official')}
                  >
                    Официальные
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Calendar className="h-5 w-5 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Перетащите файл сюда или нажмите для загрузки</p>
                <p className="text-sm text-gray-400">Поддерживаются форматы JPG, PNG</p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;