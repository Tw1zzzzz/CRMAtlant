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
  // SVG shape props — ellipse, rect or freeform path
  shape: 'ellipse' | 'rect' | 'path';
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  d?: string;
}

const ZONE_CONFIGS: Record<BodyZone, ZoneConfig> = {
  head: {
    label: 'Голова',
    shape: 'ellipse',
    cx: 100,
    cy: 53,
    rx: 24,
    ry: 27,
  },
  eyes: {
    label: 'Глаза',
    shape: 'path',
    d: 'M84 48 C88 43 94 40 100 40 C106 40 112 43 116 48 C112 54 106 57 100 57 C94 57 88 54 84 48 Z',
  },
  chest: {
    label: 'Грудь',
    shape: 'path',
    d: 'M74 108 C77 98 88 92 100 92 C112 92 123 98 126 108 C129 129 129 150 126 171 C123 188 118 202 111 214 L89 214 C82 202 77 188 74 171 C71 150 71 129 74 108 Z',
  },
  arms: {
    label: 'Руки',
    shape: 'path',
    d: 'M68 108 C57 116 49 132 48 154 C47 179 52 205 58 227 C60 236 62 243 66 249 C69 253 73 251 73 245 C72 232 72 217 73 201 C74 176 78 150 84 124 C83 113 77 107 68 108 Z M132 108 C123 107 117 113 116 124 C122 150 126 176 127 201 C128 217 128 232 127 245 C127 251 131 253 134 249 C138 243 140 236 142 227 C148 205 153 179 152 154 C151 132 143 116 132 108 Z',
  },
  back: {
    label: 'Спина',
    shape: 'path',
    d: 'M92 108 C94 127 95 148 95 171 C95 192 94 211 92 228 L108 228 C106 211 105 192 105 171 C105 148 106 127 108 108 C105 105 103 104 100 104 C97 104 95 105 92 108 Z',
  },
  legs: {
    label: 'Ноги',
    shape: 'path',
    d: 'M87 246 C82 264 79 286 79 311 C79 334 83 355 88 372 C91 378 96 378 99 371 C101 349 103 328 103 307 C103 285 101 264 98 247 Z M113 246 C118 264 121 286 121 311 C121 334 117 355 112 372 C109 378 104 378 101 371 C99 349 97 328 97 307 C97 285 99 264 102 247 Z',
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
    const opacity = isSelected(zone) ? 0.82 : 0.5;
    const stroke = isSelected(zone) ? fill : '#dbeafe';
    const strokeWidth = isSelected(zone) ? 2.2 : 0.7;
    const className = isCritical(zone) ? 'pulse-zone' : '';
    const zoneData = zones[zone];
    const ariaLabel = `${cfg.label}: ${zoneData.label}, ${zoneData.score} из 100`;
    const commonProps = {
      fill,
      fillOpacity: opacity,
      stroke,
      strokeWidth,
      strokeOpacity: isSelected(zone) ? 0.9 : 0.18,
      strokeLinejoin: 'round' as const,
      strokeLinecap: 'round' as const,
      className,
      filter: isSelected(zone) ? 'url(#zoneGlow)' : undefined,
      style: {
        cursor: 'pointer',
        transition: 'fill-opacity 160ms ease, stroke-opacity 160ms ease, stroke-width 160ms ease',
      },
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

    if (cfg.shape === 'path') {
      return (
        <path
          key={zone}
          d={cfg.d}
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
        <defs>
          <radialGradient id="bodyAura" cx="50%" cy="36%" r="58%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="headFill" x1="72" y1="28" x2="128" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#18212f" />
          </linearGradient>
          <linearGradient id="torsoFill" x1="66" y1="88" x2="138" y2="268" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="45%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="limbFill" x1="45" y1="108" x2="152" y2="378" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2f3b4e" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="panelFill" x1="76" y1="116" x2="124" y2="232" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.58" />
          </linearGradient>
          <linearGradient id="accentStroke" x1="76" y1="104" x2="124" y2="232" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.08" />
          </linearGradient>
          <filter id="zoneGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="100" cy="188" rx="82" ry="154" fill="url(#bodyAura)" />
        <ellipse cx="100" cy="382" rx="44" ry="10" fill="#020617" fillOpacity="0.44" />

        {/* ── Refined athletic silhouette ────────────────────────────── */}
        <ellipse cx="100" cy="53" rx="26" ry="30" fill="url(#headFill)" stroke="#475569" strokeWidth="1.2" />

        <path
          d="M91 79 C92 87 92 93 91 99 L109 99 C108 93 108 87 109 79 Z"
          fill="url(#torsoFill)"
          stroke="#3c4b61"
          strokeWidth="1"
        />

        <path
          d="M72 106 C76 94 88 88 100 88 C112 88 124 94 128 106 C131 127 131 148 128 170 C125 192 119 210 111 228 L89 228 C81 210 75 192 72 170 C69 148 69 127 72 106 Z"
          fill="url(#torsoFill)"
          stroke="#455468"
          strokeWidth="1.4"
        />

        <path
          d="M80 122 C86 114 93 110 100 110 C107 110 114 114 120 122 C119 149 117 170 113 185 C109 194 105 199 100 199 C95 199 91 194 87 185 C83 170 81 149 80 122 Z"
          fill="url(#panelFill)"
          stroke="url(#accentStroke)"
          strokeWidth="1"
        />

        <path
          d="M86 228 C90 236 95 240 100 240 C105 240 110 236 114 228 L120 247 C115 258 108 265 100 267 C92 265 85 258 80 247 Z"
          fill="url(#panelFill)"
          stroke="#37475d"
          strokeWidth="1.2"
        />

        <path
          d="M68 108 C57 116 49 132 48 154 C47 179 52 205 58 227 C60 236 62 243 66 249 C69 253 73 251 73 245 C72 232 72 217 73 201 C74 176 78 150 84 124 C83 113 77 107 68 108 Z"
          fill="url(#limbFill)"
          stroke="#435267"
          strokeWidth="1.2"
        />
        <path
          d="M132 108 C123 107 117 113 116 124 C122 150 126 176 127 201 C128 217 128 232 127 245 C127 251 131 253 134 249 C138 243 140 236 142 227 C148 205 153 179 152 154 C151 132 143 116 132 108 Z"
          fill="url(#limbFill)"
          stroke="#39475c"
          strokeWidth="1.2"
        />

        <path
          d="M87 246 C82 264 79 286 79 311 C79 334 83 355 88 372 C91 378 96 378 99 371 C101 349 103 328 103 307 C103 285 101 264 98 247 Z"
          fill="url(#limbFill)"
          stroke="#435267"
          strokeWidth="1.2"
        />
        <path
          d="M113 246 C118 264 121 286 121 311 C121 334 117 355 112 372 C109 378 104 378 101 371 C99 349 97 328 97 307 C97 285 99 264 102 247 Z"
          fill="url(#limbFill)"
          stroke="#39475c"
          strokeWidth="1.2"
        />

        <ellipse cx="88" cy="377" rx="18" ry="6.5" fill="#18212f" />
        <ellipse cx="112" cy="377" rx="18" ry="6.5" fill="#18212f" />

        <path
          d="M77 118 C84 112 92 109 100 109 C108 109 116 112 123 118"
          fill="none"
          stroke="url(#accentStroke)"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M100 110 C101 141 101 172 100 228"
          fill="none"
          stroke="url(#accentStroke)"
          strokeWidth="1"
          strokeLinecap="round"
        />


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
