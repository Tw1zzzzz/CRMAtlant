import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { COLORS } from '@/styles/theme';

interface CorrelationDataPoint {
  x: number;
  y: number;
  correlation: number;
  significance: 'high' | 'medium' | 'low' | 'none';
  reportTitle: string;
  reportType: string;
  date: string;
}

interface CorrelationChartProps {
  data: CorrelationDataPoint[];
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showHeatmap?: boolean;
  className?: string;
}

const CorrelationChart: React.FC<CorrelationChartProps> = ({
  data,
  title = "Корреляционный анализ",
  xAxisLabel = "Настроение до отчета",
  yAxisLabel = "Настроение после отчета",
  showHeatmap = false,
  className = ""
}) => {
  // Цветовая схема для уровней значимости
  const getSignificanceColor = (significance: string): string => {
    switch (significance) {
      case 'high': return '#22c55e'; // green-500
      case 'medium': return '#eab308'; // yellow-500
      case 'low': return '#f97316'; // orange-500
      default: return '#6b7280'; // gray-500
    }
  };

  // Размер точки в зависимости от значимости
  const getPointSize = (significance: string): number => {
    switch (significance) {
      case 'high': return 80;
      case 'medium': return 60;
      case 'low': return 40;
      default: return 25;
    }
  };

  // Кастомный тултип
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          className="bg-white p-3 border rounded-lg shadow-lg max-w-xs"
          style={{ borderColor: COLORS.borderColor }}
        >
          <h4 className="font-semibold text-sm mb-2 text-gray-900">
            {data.reportTitle}
          </h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Тип:</span>
              <span className="font-medium">{data.reportType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Дата:</span>
              <span className="font-medium">{new Date(data.date).toLocaleDateString('ru-RU')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{xAxisLabel}:</span>
              <span className="font-medium">{data.x.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{yAxisLabel}:</span>
              <span className="font-medium">{data.y.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Корреляция:</span>
              <span className="font-medium">{data.correlation.toFixed(3)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Значимость:</span>
              <Badge 
                className="text-xs"
                style={{ 
                  backgroundColor: getSignificanceColor(data.significance) + '20',
                  color: getSignificanceColor(data.significance),
                  border: `1px solid ${getSignificanceColor(data.significance)}`
                }}
              >
                {data.significance === 'high' ? 'Высокая' :
                 data.significance === 'medium' ? 'Средняя' :
                 data.significance === 'low' ? 'Низкая' : 'Отсутствует'}
              </Badge>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Данные для гистограммы корреляций
  const correlationHistogram = React.useMemo(() => {
    const bins = [
      { range: '[-1, -0.7)', count: 0, label: 'Сильная отрицательная' },
      { range: '[-0.7, -0.3)', count: 0, label: 'Умеренная отрицательная' },
      { range: '[-0.3, 0.3)', count: 0, label: 'Слабая/отсутствует' },
      { range: '[0.3, 0.7)', count: 0, label: 'Умеренная положительная' },
      { range: '[0.7, 1]', count: 0, label: 'Сильная положительная' }
    ];

    data.forEach(point => {
      const corr = point.correlation;
      if (corr >= -1 && corr < -0.7) bins[0].count++;
      else if (corr >= -0.7 && corr < -0.3) bins[1].count++;
      else if (corr >= -0.3 && corr < 0.3) bins[2].count++;
      else if (corr >= 0.3 && corr < 0.7) bins[3].count++;
      else if (corr >= 0.7 && corr <= 1) bins[4].count++;
    });

    return bins;
  }, [data]);

  const getHistogramColor = (index: number): string => {
    const colors = ['#ef4444', '#f97316', '#6b7280', '#22c55e', '#16a34a'];
    return colors[index] || '#6b7280';
  };

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500 py-8">
            <div className="text-lg mb-2">📊</div>
            <p>Нет данных для построения графика корреляций</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Основной scatter plot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.primary }}
            />
            {title}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Интерактивный график корреляций. Размер точки отражает значимость корреляции.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart
              data={data}
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
              <XAxis
                type="number"
                dataKey="x"
                name={xAxisLabel}
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={{ fontSize: 12, fill: COLORS.textColorSecondary }}
                label={{ 
                  value: xAxisLabel, 
                  position: 'insideBottom', 
                  offset: -40,
                  style: { textAnchor: 'middle', fill: COLORS.textColor }
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yAxisLabel}
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={{ fontSize: 12, fill: COLORS.textColorSecondary }}
                label={{ 
                  value: yAxisLabel, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: COLORS.textColor }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter dataKey="y" fill={COLORS.primary}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getSignificanceColor(entry.significance)}
                    r={getPointSize(entry.significance) / 10}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Гистограмма распределения корреляций */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.primary }}
            />
            Распределение корреляций
          </CardTitle>
          <p className="text-sm text-gray-600">
            Количество отчетов по типам корреляционных связей
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={correlationHistogram}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
              <XAxis 
                dataKey="range"
                tick={{ fontSize: 11, fill: COLORS.textColorSecondary }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12, fill: COLORS.textColorSecondary }}
                label={{ 
                  value: 'Количество отчетов', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: COLORS.textColor }
                }}
              />
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  `${value} отчетов`,
                  props.payload.label
                ]}
                labelFormatter={(label: string, payload: any) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.label;
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: `1px solid ${COLORS.borderColor}`,
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {correlationHistogram.map((entry, index) => (
                  <Cell key={`histogram-cell-${index}`} fill={getHistogramColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Легенда значимости */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Легенда значимости корреляций</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { level: 'high', label: 'Высокая', description: '|r| ≥ 0.7' },
              { level: 'medium', label: 'Средняя', description: '0.5 ≤ |r| < 0.7' },
              { level: 'low', label: 'Низкая', description: '0.3 ≤ |r| < 0.5' },
              { level: 'none', label: 'Отсутствует', description: '|r| < 0.3' }
            ].map((item) => (
              <div 
                key={item.level}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ borderColor: COLORS.borderColor }}
              >
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getSignificanceColor(item.level) }}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: COLORS.textColor }}>
                    {item.label}
                  </div>
                  <div className="text-xs" style={{ color: COLORS.textColorSecondary }}>
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CorrelationChart; 