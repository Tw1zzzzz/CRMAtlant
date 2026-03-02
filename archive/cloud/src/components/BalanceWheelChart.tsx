import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BalanceWheel } from '../types';

interface Props {
  data: BalanceWheel;
}

export const BalanceWheelChart: React.FC<Props> = ({ data }) => {
  const chartData = [
    { subject: 'Физическое здоровье', value: data.physicalHealth },
    { subject: 'Эмоциональное состояние', value: data.emotionalState },
    { subject: 'Интеллектуальное развитие', value: data.intellectualDevelopment },
    { subject: 'Духовное развитие', value: data.spiritualDevelopment },
    { subject: 'Профессиональный рост', value: data.professionalGrowth },
    { subject: 'Социальные отношения', value: data.socialRelations },
    { subject: 'Окружающая среда', value: data.environment },
    { subject: 'Финансовое благополучие', value: data.financialWellbeing },
  ];

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#4a5568', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e0' }}
          />
          <Radar
            name="Баланс"
            dataKey="value"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.4}
            dot
            strokeWidth={2}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}