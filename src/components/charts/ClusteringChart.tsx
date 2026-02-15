import React, { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Target, TrendingUp, Award, AlertTriangle } from 'lucide-react';

interface PlayerData {
  playerId: string;
  playerName: string;
  avgActivity: number;
  avgResponsiveness: number;
  clusterId: number;
  clusterName: string;
  recommendations: string[];
  stats: {
    reportsCompleted: number;
    averageRating: number;
    lastActive: string;
  };
}

interface ClusterInfo {
  id: number;
  name: string;
  color: string;
  description: string;
  playerCount: number;
  characteristics: string[];
  centroid: {
    activity: number;
    responsiveness: number;
  };
  strategies: string[];
  withinClusterVariance: number;
}

interface ClusteringChartProps {
  playerData: PlayerData[];
  clusters: ClusterInfo[];
  title?: string;
  showStrategies?: boolean;
  height?: number;
}

const ClusteringChart: React.FC<ClusteringChartProps> = ({
  playerData,
  clusters,
  title = 'Кластерный анализ игроков',
  showStrategies = true,
  height = 400
}) => {
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'scatter' | 'distribution' | 'details'>('scatter');

  // Подготовка данных для scatter plot
  const scatterData = playerData.map(player => ({
    x: player.avgActivity,
    y: player.avgResponsiveness,
    clusterId: player.clusterId,
    playerName: player.playerName,
    clusterName: player.clusterName,
    ...player
  }));

  // Подготовка данных для распределения кластеров
  const clusterDistribution = clusters.map(cluster => ({
    name: cluster.name,
    value: cluster.playerCount,
    color: cluster.color,
    percentage: ((cluster.playerCount / playerData.length) * 100).toFixed(1)
  }));

  // Подготовка данных для сравнения характеристик кластеров
  const clusterComparison = clusters.map(cluster => ({
    name: cluster.name,
    activity: cluster.centroid.activity,
    responsiveness: cluster.centroid.responsiveness,
    variance: cluster.withinClusterVariance,
    color: cluster.color
  }));

  // Фильтрация данных по выбранному кластеру
  const filteredData = selectedCluster !== null 
    ? scatterData.filter(point => point.clusterId === selectedCluster)
    : scatterData;

  // Получение информации о выбранном кластере
  const selectedClusterInfo = selectedCluster !== null 
    ? clusters.find(c => c.id === selectedCluster)
    : null;

  // Кастомный Tooltip для scatter plot
  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const player = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-sm">
          <p className="font-medium text-gray-900">{player.playerName}</p>
          <p className="text-sm text-gray-600 mb-2">{player.clusterName}</p>
          <div className="space-y-1 text-sm">
            <p><strong>Активность:</strong> {(player.avgActivity * 100).toFixed(1)}%</p>
            <p><strong>Отзывчивость:</strong> {(player.avgResponsiveness * 100).toFixed(1)}%</p>
            <p><strong>Отчетов выполнено:</strong> {player.stats.reportsCompleted}</p>
            <p><strong>Средняя оценка:</strong> {player.stats.averageRating.toFixed(1)}</p>
          </div>
          {player.recommendations.length > 0 && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-medium text-gray-700">Рекомендации:</p>
              <p className="text-xs text-gray-600">{player.recommendations[0]}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Получение статистики по кластерам
  const clusterStats = React.useMemo(() => {
    return {
      totalPlayers: playerData.length,
      clustersCount: clusters.length,
      avgActivity: playerData.reduce((sum, p) => sum + p.avgActivity, 0) / playerData.length,
      avgResponsiveness: playerData.reduce((sum, p) => sum + p.avgResponsiveness, 0) / playerData.length,
      bestCluster: clusters.reduce((best, cluster) => 
        cluster.centroid.activity + cluster.centroid.responsiveness > 
        best.centroid.activity + best.centroid.responsiveness ? cluster : best
      ),
      worstCluster: clusters.reduce((worst, cluster) => 
        cluster.centroid.activity + cluster.centroid.responsiveness < 
        worst.centroid.activity + worst.centroid.responsiveness ? cluster : worst
      )
    };
  }, [playerData, clusters]);

  return (
    <div className="space-y-6">
      {/* Статистические карточки */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Всего игроков</p>
                <p className="text-2xl font-bold">{clusterStats.totalPlayers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Кластеров</p>
                <p className="text-2xl font-bold">{clusterStats.clustersCount}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Средняя активность</p>
                <p className="text-2xl font-bold">{(clusterStats.avgActivity * 100).toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Лучший кластер</p>
                <p className="text-sm font-bold" style={{ color: clusterStats.bestCluster.color }}>
                  {clusterStats.bestCluster.name}
                </p>
                <p className="text-xs text-gray-500">
                  {clusterStats.bestCluster.playerCount} игроков
                </p>
              </div>
              <Award className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Переключатели режима просмотра */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewMode === 'scatter' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('scatter')}
        >
          Scatter Plot
        </Button>
        <Button
          variant={viewMode === 'distribution' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('distribution')}
        >
          Распределение
        </Button>
        <Button
          variant={viewMode === 'details' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('details')}
        >
          Детали кластеров
        </Button>
      </div>

      {/* Кнопки фильтрации по кластерам */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCluster === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCluster(null)}
        >
          Все кластеры
        </Button>
        {clusters.map(cluster => (
          <Button
            key={cluster.id}
            variant={selectedCluster === cluster.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCluster(cluster.id)}
            style={{
              backgroundColor: selectedCluster === cluster.id ? cluster.color : undefined,
              borderColor: cluster.color
            }}
          >
            {cluster.name} ({cluster.playerCount})
          </Button>
        ))}
      </div>

      {/* Основная визуализация */}
      {viewMode === 'scatter' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 {title}
              {selectedClusterInfo && (
                <Badge style={{ backgroundColor: selectedClusterInfo.color, color: 'white' }}>
                  {selectedClusterInfo.name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={height}>
              <ScatterChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Активность"
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Отзывчивость"
                  domain={[0, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<ScatterTooltip />} />
                
                {/* Точки игроков */}
                {selectedCluster === null ? (
                  // Показываем все кластеры разными цветами
                  clusters.map(cluster => (
                    <Scatter
                      key={cluster.id}
                      name={cluster.name}
                      data={scatterData.filter(p => p.clusterId === cluster.id)}
                      fill={cluster.color}
                    />
                  ))
                ) : (
                  // Показываем только выбранный кластер
                  <Scatter
                    name={selectedClusterInfo?.name}
                    data={filteredData}
                    fill={selectedClusterInfo?.color}
                  />
                )}
                
                {/* Центроиды кластеров */}
                {(selectedCluster === null ? clusters : [selectedClusterInfo]).filter(Boolean).map(cluster => (
                  <Scatter
                    key={`centroid-${cluster!.id}`}
                    data={[{
                      x: cluster!.centroid.activity,
                      y: cluster!.centroid.responsiveness,
                      playerName: `Центроид: ${cluster!.name}`,
                      clusterName: 'Центр кластера'
                    }]}
                    fill={cluster!.color}
                    shape="diamond"
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {viewMode === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Круговая диаграмма распределения */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Распределение по кластерам</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={clusterDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {clusterDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Сравнение характеристик кластеров */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Сравнение центроидов</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clusterComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [
                      `${(Number(value) * 100).toFixed(1)}%`, 
                      name === 'activity' ? 'Активность' : 'Отзывчивость'
                    ]}
                  />
                  <Bar dataKey="activity" name="Активность" fill="#3b82f6" />
                  <Bar dataKey="responsiveness" name="Отзывчивость" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clusters.map(cluster => (
            <Card key={cluster.id} className="border-l-4" style={{ borderLeftColor: cluster.color }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: cluster.color }}
                  />
                  {cluster.name}
                  <Badge variant="secondary">{cluster.playerCount} игроков</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">{cluster.description}</p>
                
                <div>
                  <h4 className="font-medium text-sm mb-2">Характеристики:</h4>
                  <div className="flex flex-wrap gap-1">
                    {cluster.characteristics.map((char, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {char}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Центроид:</h4>
                  <div className="text-sm space-y-1">
                    <p>Активность: {(cluster.centroid.activity * 100).toFixed(1)}%</p>
                    <p>Отзывчивость: {(cluster.centroid.responsiveness * 100).toFixed(1)}%</p>
                    <p>Дисперсия: {cluster.withinClusterVariance.toFixed(3)}</p>
                  </div>
                </div>

                {showStrategies && cluster.strategies.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Стратегии работы:
                    </h4>
                    <ul className="text-xs space-y-1">
                      {cluster.strategies.map((strategy, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span className="text-gray-400 mt-1">•</span>
                          <span>{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Игроки кластера */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Игроки:</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {playerData
                      .filter(player => player.clusterId === cluster.id)
                      .map(player => (
                        <div key={player.playerId} className="text-xs p-2 bg-gray-50 rounded">
                          <p className="font-medium">{player.playerName}</p>
                          <p className="text-gray-600">
                            A: {(player.avgActivity * 100).toFixed(0)}%, 
                            R: {(player.avgResponsiveness * 100).toFixed(0)}%
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Информация о выбранном кластере */}
      {selectedClusterInfo && viewMode === 'scatter' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: selectedClusterInfo.color }}
              />
              Информация о кластере: {selectedClusterInfo.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Описание и характеристики</h4>
                <p className="text-sm text-gray-600 mb-3">{selectedClusterInfo.description}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedClusterInfo.characteristics.map((char, index) => (
                    <Badge key={index} variant="outline">
                      {char}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {showStrategies && selectedClusterInfo.strategies.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Рекомендуемые стратегии</h4>
                  <ul className="text-sm space-y-1">
                    {selectedClusterInfo.strategies.map((strategy, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{strategy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClusteringChart; 