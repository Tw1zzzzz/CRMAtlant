import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BodyZone, ZoneData, ZoneSeverity } from '@/types/playerState.types';

interface ZoneDetailCardProps {
  zone: BodyZone;
  data: ZoneData;
  isSelected?: boolean;
  onClick?: () => void;
}

const ZONE_LABELS: Record<BodyZone, string> = {
  head: 'Когнитивный потенциал',
  eyes: 'Фокус и концентрация',
  chest: 'Психологическое ядро',
  arms: 'Игровой перформанс',
  back: 'Восстановление',
  legs: 'Жизненный фундамент',
};

const SEVERITY_BADGE_VARIANT: Record<ZoneSeverity, 'default' | 'secondary' | 'destructive'> = {
  ok: 'default',
  warning: 'secondary',
  critical: 'destructive',
};

const SEVERITY_PROGRESS_COLOR: Record<ZoneSeverity, string> = {
  ok: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const ZoneDetailCard = ({ zone, data, isSelected, onClick }: ZoneDetailCardProps) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-primary shadow-lg',
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">
            {ZONE_LABELS[zone]}
          </CardTitle>
          <Badge variant={SEVERITY_BADGE_VARIANT[data.severity]} className="shrink-0 text-xs">
            {data.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-4 px-4 space-y-2">
        {/* Score bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Балл</span>
            <span className="font-medium tabular-nums">{data.score} / 100</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn('h-full rounded-full transition-all duration-500', SEVERITY_PROGRESS_COLOR[data.severity])}
              style={{ width: `${data.score}%` }}
            />
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {data.description}
        </p>

        {/* Data breakdown */}
        {data.dataBreakdown && data.dataBreakdown.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">Источники данных</p>
            <div className="flex flex-wrap gap-1">
              {data.dataBreakdown.map((item, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal px-1.5 py-0">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ZoneDetailCard;
