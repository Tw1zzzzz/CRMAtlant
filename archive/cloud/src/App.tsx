import React, { useState } from 'react';
import { StatCard } from './components/StatCard';
import { BalanceWheelChart } from './components/BalanceWheelChart';
import { Player, BalanceWheel } from './types';

// Mock data - replace with actual API calls
const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'Игрок 1',
    averageMood: 4.5,
    averageEnergy: 4.2,
    completedTests: 12,
    activityPercentage: 86,
  },
  // Add more players...
];

const mockBalanceWheel: BalanceWheel = {
  id: '1',
  playerId: '1',
  playerName: 'Игрок 1',
  date: '2023-04-01',
  physicalHealth: 8,
  emotionalState: 7,
  intellectualDevelopment: 9,
  spiritualDevelopment: 6,
  professionalGrowth: 8,
  socialRelations: 7,
  environment: 6,
  financialWellbeing: 7,
};

function App() {
  const [selectedPlayer, setSelectedPlayer] = useState<Player>(mockPlayers[0]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">1WIN Трекер Академия</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Всего игроков"
            value={mockPlayers.length}
            description="Активные игроки"
          />
          <StatCard
            title="Среднее настроение"
            value={selectedPlayer.averageMood.toFixed(1)}
            description="Из 10"
          />
          <StatCard
            title="Средняя энергия"
            value={selectedPlayer.averageEnergy.toFixed(1)}
            description="Из 10"
          />
          <StatCard
            title="Завершенные тесты"
            value={selectedPlayer.completedTests}
            description="Всего тестов выполнено"
          />
        </div>

        {/* Balance Wheel Chart */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Анализ колеса баланса</h2>
          <BalanceWheelChart data={mockBalanceWheel} />
        </div>

        {/* Player Selection */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Детали игрока</h2>
          <select
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            value={selectedPlayer.id}
            onChange={(e) => {
              const player = mockPlayers.find(p => p.id === e.target.value);
              if (player) setSelectedPlayer(player);
            }}
          >
            {mockPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
      </main>
    </div>
  );
}

export default App;