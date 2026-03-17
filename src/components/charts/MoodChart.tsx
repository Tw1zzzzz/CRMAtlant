import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { StatsData } from "@/types";
import { COLORS } from "@/styles/theme";
import CustomTooltip from "./CustomTooltip";

// Кастомный стиль для диаграмм
const chartStyle = {
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: '12px',
  fill: COLORS.textColor,
  borderRadius: '12px', 
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
};

interface MoodChartProps {
  data: StatsData[];
  height?: number;
}

/**
 * Компонент для отображения графика настроения и энергии
 */
const MoodChart = ({ data, height = 400 }: MoodChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10">
        <p className="text-center text-gray-500">Нет данных для отображения</p>
      </div>
    );
  }

  const hasSleepData = data.some((entry) => typeof entry.sleepHours === 'number');
  const yAxisUpperBound = hasSleepData ? 12 : 10;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
        style={chartStyle}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderColor} />
        <XAxis 
          dataKey="date"
          tick={{ fill: COLORS.textColor }} 
          tickMargin={10}
        />
        <YAxis 
          domain={[0, yAxisUpperBound]} 
          tick={{ fill: COLORS.textColor }} 
          tickMargin={10}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Line
          type="monotone"
          dataKey="mood"
          name="Настроение"
          stroke={COLORS.chartColors[0]}
          strokeWidth={2}
          activeDot={{ r: 8 }}
          dot={{ strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="energy"
          name="Энергия"
          stroke={COLORS.chartColors[1]}
          strokeWidth={2}
          activeDot={{ r: 8 }}
          dot={{ strokeWidth: 2 }}
        />
        {hasSleepData && (
          <Line
            type="monotone"
            dataKey="sleepHours"
            name="Сон (ч)"
            stroke={COLORS.chartColors[2] || "#f59e0b"}
            strokeWidth={2}
            strokeDasharray="6 4"
            activeDot={{ r: 7 }}
            dot={{ strokeWidth: 2 }}
            connectNulls={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MoodChart; 
