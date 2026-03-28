/**
 * Типы для функции "Состояние игрока"
 */

export type BodyZone = 'head' | 'eyes' | 'chest' | 'arms' | 'back' | 'legs';
export type ZoneSeverity = 'ok' | 'warning' | 'critical';

export interface ZoneData {
  /** Балл от 0 до 100 */
  score: number;
  /** Краткий русский ярлык, напр. "В норме", "Повышенная нагрузка" */
  label: string;
  /** Более развёрнутое объяснение */
  description: string;
  severity: ZoneSeverity;
  /** Список источников данных, питающих эту зону, напр. ["Внимание: 78", "Реакция: 65"] */
  dataBreakdown: string[];
}

export interface PlayerStateReport {
  /** Текстовый отчёт на русском языке, 3–5 абзацев */
  report: string;
  zones: Record<BodyZone, ZoneData>;
  /** 2–3 практических рекомендации */
  recommendations: string[];
  /** Список источников данных, использованных при анализе */
  dataUsed: string[];
  generatedAt: string;
  model: string;
  fallbackUsed?: boolean;
}
