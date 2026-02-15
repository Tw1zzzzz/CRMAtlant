import React from 'react';
import {
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { COLORS } from '@/styles/theme';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  reportId: string;
  reportTitle: string;
  date: string;
  overallSentiment: number;
  emotions: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    confidence: number;
    surprise: number;
  };
  keyPhrases: string[];
  recommendations: string[];
}

interface SentimentChartProps {
  data: SentimentData[];
  showEmotions?: boolean;
  showTrends?: boolean;
  height?: number;
}

const SentimentChart: React.FC<SentimentChartProps> = ({ 
  data, 
  showEmotions = true, 
  showTrends = true, 
  height = 400 
}) => {
  // Подготовка данных для графика тональности по времени
  const sentimentTimeData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('ru-RU', { 
      month: 'short', 
      day: 'numeric' 
    }),
    sentiment: item.overallSentiment,
    reportTitle: item.reportTitle,
    fullDate: item.date
  })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

  // Подготовка данных для распределения эмоций
  const emotionDistributionData = showEmotions ? (() => {
    const emotionSums = data.reduce((acc, item) => {
      Object.entries(item.emotions).forEach(([emotion, value]) => {
        acc[emotion] = (acc[emotion] || 0) + value;
      });
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(emotionSums).map(([emotion, value]) => ({
      emotion: getEmotionName(emotion),
      value: Number((value / data.length).toFixed(2)),
      color: getEmotionColor(emotion)
    }));
  })() : [];

  // Подготовка данных для категоризации тональности
  const sentimentCategories = (() => {
    const categories = data.reduce((acc, item) => {
      if (item.overallSentiment > 0.6) acc.positive++;
      else if (item.overallSentiment < 0.4) acc.negative++;
      else acc.neutral++;
      return acc;
    }, { positive: 0, neutral: 0, negative: 0 });

    return [
      { name: 'Позитивные', value: categories.positive, color: '#22c55e' },
      { name: 'Нейтральные', value: categories.neutral, color: '#6b7280' },
      { name: 'Негативные', value: categories.negative, color: '#ef4444' }
    ];
  })();

  // Расчет тренда
  const sentimentTrend = showTrends ? (() => {
    if (sentimentTimeData.length < 2) return null;
    
    const recent = sentimentTimeData.slice(-3).reduce((sum, item) => sum + item.sentiment, 0) / 3;
    const previous = sentimentTimeData.slice(-6, -3).reduce((sum, item) => sum + item.sentiment, 0) / 3;
    
    if (isNaN(recent) || isNaN(previous)) return null;
    
    const change = recent - previous;
    return {
      direction: change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'stable',
      change: change,
      changePercent: ((change / previous) * 100).toFixed(1)
    };
  })() : null;

  // Кастомный Tooltip для графика тональности
  const SentimentTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-600">{data.reportTitle}</p>
          <p className="text-sm">
            <span className="font-medium">Тональность:</span>{' '}
            <span className={`font-medium ${getSentimentColorClass(data.sentiment)}`}>
              {(data.sentiment * 100).toFixed(1)}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Карточки с общей статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Общая тональность</p>
                <p className="text-2xl font-bold">
                  {(data.reduce((sum, item) => sum + item.overallSentiment, 0) / data.length * 100).toFixed(1)}%
                </p>
              </div>
              {sentimentTrend && (
                <div className={`p-2 rounded-full ${
                  sentimentTrend.direction === 'up' 
                    ? 'bg-green-100 text-green-600' 
                    : sentimentTrend.direction === 'down' 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {sentimentTrend.direction === 'up' && <TrendingUp className="h-4 w-4" />}
                  {sentimentTrend.direction === 'down' && <TrendingDown className="h-4 w-4" />}
                  {sentimentTrend.direction === 'stable' && <Minus className="h-4 w-4" />}
                </div>
              )}
            </div>
            {sentimentTrend && (
              <p className={`text-xs mt-1 ${
                sentimentTrend.direction === 'up' 
                  ? 'text-green-600' 
                  : sentimentTrend.direction === 'down' 
                  ? 'text-red-600' 
                  : 'text-gray-600'
              }`}>
                {sentimentTrend.changePercent}% относительно предыдущего периода
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Позитивные отчеты</p>
            <p className="text-2xl font-bold text-green-600">
              {sentimentCategories[0].value}
            </p>
            <p className="text-xs text-gray-500">
              {((sentimentCategories[0].value / data.length) * 100).toFixed(1)}% от общего числа
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Нейтральные отчеты</p>
            <p className="text-2xl font-bold text-gray-600">
              {sentimentCategories[1].value}
            </p>
            <p className="text-xs text-gray-500">
              {((sentimentCategories[1].value / data.length) * 100).toFixed(1)}% от общего числа
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Негативные отчеты</p>
            <p className="text-2xl font-bold text-red-600">
              {sentimentCategories[2].value}
            </p>
            <p className="text-xs text-gray-500">
              {((sentimentCategories[2].value / data.length) * 100).toFixed(1)}% от общего числа
            </p>
          </CardContent>
        </Card>
      </div>

      {/* График тональности по времени */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📈 Динамика тональности
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={sentimentTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, 1]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <Tooltip content={<SentimentTooltip />} />
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Распределение по категориям тональности */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 Распределение тональности
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentCategories}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                >
                  {sentimentCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Распределение эмоций (если включено) */}
        {showEmotions && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                😊 Эмоциональный профиль
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={emotionDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="emotion" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  />
                  <Tooltip 
                    formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Уровень']}
                  />
                  <Bar dataKey="value" fill="#8884d8">
                    {emotionDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Детальная таблица последних отчетов */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Последние анализы тональности
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Отчет</th>
                  <th className="text-left p-2">Дата</th>
                  <th className="text-left p-2">Тональность</th>
                  <th className="text-left p-2">Доминирующая эмоция</th>
                  <th className="text-left p-2">Ключевые фразы</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(-5).map((item, index) => {
                  const dominantEmotion = Object.entries(item.emotions)
                    .reduce((max, [emotion, value]) => value > max.value ? { emotion, value } : max, { emotion: '', value: 0 });
                  
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{item.reportTitle}</td>
                      <td className="p-2">
                        {new Date(item.date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.overallSentiment > 0.6 
                            ? 'bg-green-100 text-green-800' 
                            : item.overallSentiment < 0.4 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {(item.overallSentiment * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="text-sm">
                          {getEmotionName(dominantEmotion.emotion)} 
                          ({(dominantEmotion.value * 100).toFixed(0)}%)
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {item.keyPhrases.slice(0, 3).map((phrase, phraseIndex) => (
                            <span 
                              key={phraseIndex}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                            >
                              {phrase}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Вспомогательные функции
function getEmotionName(emotion: string): string {
  const emotionNames: Record<string, string> = {
    joy: 'Радость',
    sadness: 'Грусть',
    anger: 'Гнев',
    fear: 'Страх',
    confidence: 'Уверенность',
    surprise: 'Удивление'
  };
  return emotionNames[emotion] || emotion;
}

function getEmotionColor(emotion: string): string {
  const emotionColors: Record<string, string> = {
    joy: '#fbbf24',
    sadness: '#3b82f6',
    anger: '#ef4444',
    fear: '#8b5cf6',
    confidence: '#10b981',
    surprise: '#f59e0b'
  };
  return emotionColors[emotion] || '#6b7280';
}

function getSentimentColorClass(sentiment: number): string {
  if (sentiment > 0.6) return 'text-green-600';
  if (sentiment < 0.4) return 'text-red-600';
  return 'text-gray-600';
}

export default SentimentChart; 