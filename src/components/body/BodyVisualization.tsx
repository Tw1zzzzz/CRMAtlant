import { useState } from 'react';
import type { BodyZone, ZoneData, ZoneSeverity } from '@/types/playerState.types';

interface BodyVisualizationProps {
  zones: Record<BodyZone, ZoneData>;
  onZoneClick?: (zone: BodyZone) => void;
  selectedZone?: BodyZone;
}

const SEVERITY_COLORS: Record<ZoneSeverity, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

interface ZoneConfig {
  label: string;
  // SVG shape props — either ellipse or rect
  shape: 'ellipse' | 'rect';
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const ZONE_CONFIGS: Record<BodyZone, ZoneConfig> = {
  head: {
    label: 'Голова',
    shape: 'ellipse',
    cx: 100,
    cy: 48,
    rx: 26,
    ry: 28,
  },
  eyes: {
    label: 'Глаза',
    shape: 'ellipse',
    cx: 100,
    cy: 42,
    rx: 14,
    ry: 8,
  },
  chest: {
    label: 'Грудь',
    shape: 'rect',
    x: 68,
    y: 100,
    width: 64,
    height: 60,
  },
  arms: {
    label: 'Руки',
    shape: 'rect',
    x: 38,
    y: 100,
    width: 22,
    height: 70,
  },
  back: {
    label: 'Спина',
    shape: 'rect',
    x: 76,
    y: 100,
    width: 14,
    height: 60,
  },
  legs: {
    label: 'Ноги',
    shape: 'rect',
    x: 72,
    y: 230,
    width: 56,
    height: 120,
  },
};

interface TooltipState {
  zone: BodyZone;
  x: number;
  y: number;
}

const BodyVisualization = ({
  zones,
  onZoneClick,
  selectedZone,
}: BodyVisualizationProps) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const handleMouseEnter = (
    zone: BodyZone,
    e: React.MouseEvent<SVGElement>,
  ) => {
    const svg = (e.currentTarget as SVGElement).closest('svg');
    const rect = svg?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip({ zone, x, y });
  };

  const handleMouseLeave = () => setTooltip(null);

  const handleClick = (zone: BodyZone) => {
    onZoneClick?.(zone);
  };

  const getZoneColor = (zone: BodyZone): string => {
    return SEVERITY_COLORS[zones[zone].severity];
  };

  const isCritical = (zone: BodyZone): boolean =>
    zones[zone].severity === 'critical';

  const isSelected = (zone: BodyZone): boolean => selectedZone === zone;

  const renderZoneShape = (zone: BodyZone, cfg: ZoneConfig) => {
    const fill = getZoneColor(zone);
    const opacity = isSelected(zone) ? 0.85 : 0.55;
    const stroke = isSelected(zone) ? fill : 'transparent';
    const strokeWidth = isSelected(zone) ? 2 : 0;
    const className = isCritical(zone) ? 'pulse-zone' : '';
    const zoneData = zones[zone];
    const ariaLabel = `${cfg.label}: ${zoneData.label}, ${zoneData.score} из 100`;
    const commonProps = {
      fill,
      fillOpacity: opacity,
      stroke,
      strokeWidth,
      className,
      style: { cursor: 'pointer' },
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': ariaLabel,
      onMouseEnter: (e: React.MouseEvent<SVGElement>) =>
        handleMouseEnter(zone, e),
      onMouseLeave: handleMouseLeave,
      onClick: () => handleClick(zone),
      onKeyDown: (e: React.KeyboardEvent<SVGElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(zone);
        }
      },
    };

    if (cfg.shape === 'ellipse') {
      return (
        <ellipse
          key={zone}
          cx={cfg.cx}
          cy={cfg.cy}
          rx={cfg.rx}
          ry={cfg.ry}
          {...commonProps}
        />
      );
    }

    return (
      <rect
        key={zone}
        x={cfg.x}
        y={cfg.y}
        width={cfg.width}
        height={cfg.height}
        rx={6}
        {...commonProps}
      />
    );
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <svg
        viewBox="0 0 200 400"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-h-[500px]"
        style={{ maxWidth: 260 }}
        role="img"
        aria-label="Модель тела игрока с зонами внимания"
      >

        {/* ── Base silhouette (side profile) ─────────────────────── */}

        {/* Head silhouette */}
        <ellipse cx="100" cy="48" rx="28" ry="30" fill="#374151" />

        {/* Neck */}
        <rect x="90" y="75" width="20" height="22" rx="4" fill="#374151" />

        {/* Torso */}
        <rect x="66" y="95" width="68" height="120" rx="10" fill="#374151" />

        {/* Left arm */}
        <rect x="36" y="98" width="24" height="78" rx="8" fill="#374151" />
        {/* Left forearm angle */}
        <rect x="32" y="160" width="28" height="24" rx="6" fill="#374151" />

        {/* Right arm (far side, slightly offset) */}
        <rect x="140" y="98" width="22" height="70" rx="8" fill="#2d3748" />

        {/* Left thigh */}
        <rect x="70" y="213" width="26" height="80" rx="8" fill="#374151" />
        {/* Left shin */}
        <rect x="72" y="288" width="22" height="68" rx="6" fill="#374151" />
        {/* Left foot */}
        <ellipse cx="82" cy="360" rx="18" ry="8" fill="#374151" />

        {/* Right leg (far side) */}
        <rect x="102" y="213" width="24" height="78" rx="8" fill="#2d3748" />
        <rect x="104" y="286" width="20" height="66" rx="6" fill="#2d3748" />
        <ellipse cx="116" cy="356" rx="16" ry="7" fill="#2d3748" />

        {/* ── Zone color overlays ─────────────────────────────────── */}
        {/* Render in Z-order: legs, chest, arms, back, head, eyes */}
        {renderZoneShape('legs', ZONE_CONFIGS.legs)}
        {renderZoneShape('chest', ZONE_CONFIGS.chest)}
        {renderZoneShape('arms', ZONE_CONFIGS.arms)}
        {renderZoneShape('back', ZONE_CONFIGS.back)}
        {renderZoneShape('head', ZONE_CONFIGS.head)}
        {renderZoneShape('eyes', ZONE_CONFIGS.eyes)}

        {/* ── Inline tooltip ──────────────────────────────────────── */}
        {tooltip && (() => {
          const zoneData = zones[tooltip.zone];
          const maxWidth = 130;
          const txRaw = tooltip.x + 8;
          const tx = txRaw + maxWidth > 200 ? tooltip.x - maxWidth - 8 : txRaw;
          const ty = Math.max(4, tooltip.y - 36);
          return (
            <g pointerEvents="none">
              <rect
                x={tx - 4}
                y={ty - 14}
                width={maxWidth}
                height={36}
                rx={5}
                fill="#1f2937"
                fillOpacity={0.95}
                stroke={SEVERITY_COLORS[zoneData.severity]}
                strokeWidth={1}
              />
              <text
                x={tx + 2}
                y={ty + 1}
                fontSize={9}
                fontWeight="bold"
                fill={SEVERITY_COLORS[zoneData.severity]}
              >
                {ZONE_CONFIGS[tooltip.zone].label}
              </text>
              <text x={tx + 2} y={ty + 13} fontSize={8} fill="#d1d5db">
                {zoneData.label} · {zoneData.score}/100
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 flex gap-3 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS.ok }} />
          Норма
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS.warning }} />
          Нагрузка
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS.critical }} />
          Критично
        </span>
      </div>
    </div>
  );
};

export default BodyVisualization;
