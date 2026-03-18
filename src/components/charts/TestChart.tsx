import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { COLORS } from "@/styles/theme";
import { getReadableTestTypeLabel } from "@/utils/testTypeMetadata";
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

interface TestChartProps {
  data: any[];
  height?: number;
  testTypes?: string[];
}

/**
 * Компонент для отображения графика результатов тестов
 */
const TestChart = ({ data, height = 400, testTypes = [] }: TestChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10">
        <p className="text-center text-gray-500">Нет данных для отображения</p>
      </div>
    );
  }

  // Если типы тестов не указаны явно, извлекаем их из данных
  const types = testTypes.length > 0 
    ? testTypes 
    : Object.keys(data[0]).filter((key) => key !== 'date' && key !== 'name');

  // Создаем цветовую палитру для различных типов тестов
  const getColor = (index: number) => {
    const colors = COLORS.chartColors;
    return colors[index % colors.length];
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
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
          domain={[0, 100]} 
          tick={{ fill: COLORS.textColor }} 
          tickMargin={10}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        
        {types.map((type, index) => (
          <Bar
            key={`bar-${type}`}
            dataKey={type}
            name={getReadableTestTypeLabel(type)}
            fill={getColor(index)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TestChart; 
