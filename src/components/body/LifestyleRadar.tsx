import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { BodyZone, ZoneData } from '@/types/playerState.types';
import { COLORS } from '@/styles/theme';

interface LifestyleRadarProps {
  zones: Record<BodyZone, ZoneData>;
}

const AXES = [
  { key: 'head' as BodyZone, label: 'Когниции' },
  { key: 'eyes' as BodyZone, label: 'Концентрация' },
  { key: 'chest' as BodyZone, label: 'Психология' },
  { key: 'arms' as BodyZone, label: 'Игра' },
  { key: 'back' as BodyZone, label: 'Восстановление' },
  { key: 'legs' as BodyZone, label: 'Образ жизни' },
];

const SEVERITY_DOT_COLORS: Record<string, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: { zone: BodyZone; severity: string };
}

const CustomDot = ({ cx, cy, payload }: CustomDotProps) => {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = SEVERITY_DOT_COLORS[payload.severity] ?? COLORS.primary;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#111827" strokeWidth={1.5} />;
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; score: number; severity: string } }>;
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const color = SEVERITY_DOT_COLORS[item.severity] ?? COLORS.primary;
  return (
    <div
      style={{
        backgroundColor: COLORS.cardBackground,
        border: `1px solid ${COLORS.borderColor}`,
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        color: COLORS.textColor,
      }}
    >
      <p style={{ fontWeight: 600, color }}>{item.label}</p>
      <p style={{ color: COLORS.textColorSecondary }}>Балл: {item.score}/100</p>
    </div>
  );
};

const LifestyleRadar = ({ zones }: LifestyleRadarProps) => {
  const data = AXES.map(({ key, label }) => ({
    label,
    zone: key,
    score: zones[key].score,
    severity: zones[key].severity,
  }));

  return (
    <div className="flex flex-col items-center w-full">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Радар состояния
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke={COLORS.borderColor} />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: COLORS.textColorSecondary, fontSize: 11 }}
          />
          <Radar
            dataKey="score"
            stroke={COLORS.primary}
            fill={COLORS.primary}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={<CustomDot />}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LifestyleRadar;
