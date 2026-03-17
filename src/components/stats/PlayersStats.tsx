import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MoodChart from "@/components/charts/MoodChart";
import TestChart from "@/components/charts/TestChart";
import TestDistributionChart from "@/components/charts/TestDistributionChart";
import { prepareTestDistribution } from "@/utils/statsUtils";
import { COLORS } from "@/styles/theme";

interface PlayersStatsProps {
  playersMoodStats: any[];
  playersSleepStats: any[];
  playersTestStats: any[];
  averagePlayerStats: {
    avgMood: number;
    avgEnergy: number;
    avgSleep: number;
    completedTests: number;
    totalPlayers: number;
  };
  players: any[];
  selectedPlayerId: string;
  onPlayerChange: (playerId: string) => void;
  playerStatsData: any;
  loadingPlayerStats: boolean;
  loadingPlayersData: boolean;
  loadingError: string | null;
}

/**
 * Компонент для отображения статистики по игрокам (режим тренера)
 */
const PlayersStats = ({
  playersMoodStats,
  playersSleepStats,
  playersTestStats,
  averagePlayerStats,
  players,
  selectedPlayerId,
  onPlayerChange,
  playerStatsData,
  loadingPlayerStats,
  loadingPlayersData,
  loadingError
}: PlayersStatsProps) => {
  const [statsView, setStatsView] = useState<"mood" | "tests">("mood");
  const combinedMoodStats = playersMoodStats.map((player) => {
    const sleepStats = playersSleepStats.find((entry) => entry.userId === player.userId);
    return {
      ...player,
      sleepHours: typeof sleepStats?.avgSleep === "number" ? sleepStats.avgSleep : undefined
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1 bg-[#1C1F3B] border-[#293056] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Общая статистика игроков</CardTitle>
            <CardDescription className="text-gray-400">Средние показатели настроения и энергии игроков</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-[#14162D] p-4 rounded-lg">
                <p className="text-sm text-gray-400">Среднее настроение</p>
                <p className="text-2xl font-bold text-white">{averagePlayerStats.avgMood.toFixed(1)}</p>
              </div>
              <div className="bg-[#14162D] p-4 rounded-lg">
                <p className="text-sm text-gray-400">Средняя энергия</p>
                <p className="text-2xl font-bold text-white">{averagePlayerStats.avgEnergy.toFixed(1)}</p>
              </div>
              <div className="bg-[#14162D] p-4 rounded-lg">
                <p className="text-sm text-gray-400">Средний сон</p>
                <p className="text-2xl font-bold text-white">{averagePlayerStats.avgSleep.toFixed(1)}ч</p>
              </div>
              <div className="bg-[#14162D] p-4 rounded-lg">
                <p className="text-sm text-gray-400">Выполнено тестов</p>
                <p className="text-2xl font-bold text-white">{averagePlayerStats.completedTests}</p>
              </div>
              <div className="bg-[#14162D] p-4 rounded-lg">
                <p className="text-sm text-gray-400">Всего игроков</p>
                <p className="text-2xl font-bold text-white">{averagePlayerStats.totalPlayers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Select value={statsView} onValueChange={(value: "mood" | "tests") => setStatsView(value)}>
          <SelectTrigger className="w-[180px] bg-[#1C1F3B] border-[#293056] text-white">
            <SelectValue placeholder="Выберите тип статистики" />
          </SelectTrigger>
          <SelectContent className="bg-[#1C1F3B] border-[#293056] text-white">
            <SelectItem value="mood">Настроение</SelectItem>
            <SelectItem value="tests">Тесты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadingPlayersData ? (
        <div className="flex justify-center items-center py-20">
          <p className="text-white">Загрузка данных...</p>
        </div>
      ) : loadingError ? (
        <div className="flex justify-center items-center py-20">
          <p className="text-red-500">{loadingError}</p>
        </div>
      ) : statsView === "mood" ? (
        <Card className="bg-[#1C1F3B] border-[#293056] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Статистика настроения игроков</CardTitle>
            <CardDescription className="text-gray-400">Средние показатели настроения, энергии и сна по всем игрокам</CardDescription>
          </CardHeader>
          <CardContent>
            <MoodChart data={combinedMoodStats} height={400} />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#1C1F3B] border-[#293056] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Статистика тестов игроков</CardTitle>
            <CardDescription className="text-gray-400">Результаты тестов игроков по типам</CardDescription>
          </CardHeader>
          <CardContent>
            <TestChart data={playersTestStats} height={400} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1 bg-[#1C1F3B] border-[#293056] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Статистика игрока</CardTitle>
            <CardDescription className="text-gray-400">Подробная статистика по выбранному игроку</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={selectedPlayerId} onValueChange={onPlayerChange}>
                <SelectTrigger className="bg-[#1C1F3B] border-[#293056] text-white">
                  <SelectValue placeholder="Выберите игрока" />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1F3B] border-[#293056] text-white">
                  {players.map((player) => (
                    <SelectItem key={player._id} value={player._id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingPlayerStats ? (
              <div className="flex justify-center items-center py-20">
                <p className="text-white">Загрузка данных игрока...</p>
              </div>
            ) : !playerStatsData ? (
              <div className="flex justify-center items-center py-20">
                <p className="text-white">Выберите игрока для просмотра статистики</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-white">Настроение и энергия</h3>
                  <MoodChart data={playerStatsData.moodStats || []} height={300} />
                </div>
                {playerStatsData.testStats && playerStatsData.testStats.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">Результаты тестов</h3>
                    <TestChart data={playerStatsData.testStats || []} height={300} />
                  </div>
                )}
                {playerStatsData.testEntries && playerStatsData.testEntries.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">Распределение типов тестов</h3>
                    <TestDistributionChart 
                      data={prepareTestDistribution(playerStatsData.testEntries || [])} 
                      height={300} 
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlayersStats; 
