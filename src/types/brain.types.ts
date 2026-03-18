export type BrainTestKey =
  | 'visual_search'
  | 'go_no_go'
  | 'n_back_2'
  | 'stroop_switch'
  | 'spatial_span';

export type BrainConfidence = 'low' | 'medium' | 'high';
export type BrainHistoryStatus = 'invalid' | 'calibrating' | 'valid';

export interface BrainCatalogEntry {
  testKey: BrainTestKey;
  domain: string;
  title: string;
  shortDescription: string;
  instruction: string;
  durationSec: number;
  config: Record<string, number | string>;
}

export interface BrainCatalogResponse {
  title: string;
  batteryDurationSec: number;
  order: BrainTestKey[];
  tests: BrainCatalogEntry[];
}

export interface BrainAttemptStartResponse {
  attemptId: string;
  batterySessionId: string | null;
  testKey: BrainTestKey;
  domain: string;
  seed: string;
  config: Record<string, number | string>;
  instruction: string;
  title: string;
}

export interface BrainAttemptResult {
  id: string;
  testKey: BrainTestKey;
  domain: string;
  validityStatus: 'valid' | 'invalid';
  invalidReasons: string[];
  rawCompositeScore: number;
  formScore: number | null;
  durationMs: number | null;
  derivedMetrics: Record<string, number | string | null>;
}

export interface BrainTestSummaryItem {
  testKey: BrainTestKey;
  domain: string;
  title: string;
  latestRawScore: number | null;
  latestFormScore: number | null;
  latestCompletedAt: string | null;
  latestValidityStatus: 'valid' | 'invalid' | null;
  historyStatus: BrainHistoryStatus;
  attempts30d: number;
  validAttempts30d: number;
}

export interface BrainTrendPoint {
  date: string;
  brainPerformanceIndex: number | null;
  rawAverageScore: number | null;
}

export interface BrainPerformanceSummary {
  brainPerformanceIndex: number | null;
  confidence: BrainConfidence;
  calibrationStatus: 'calibrating' | 'ready';
  validBatteryCount: number;
  matureBaseline: boolean;
  domains: {
    attention: number | null;
    reactionInhibition: number | null;
    workingMemory: number | null;
    flexibility: number | null;
    visuospatial: number | null;
  };
  tests: BrainTestSummaryItem[];
  trend7d: BrainTrendPoint[];
  trend30d: BrainTrendPoint[];
  readinessOverlay: {
    fatigue: number | null;
    focus: number | null;
    stress: number | null;
  };
}

export interface BrainHistoryItem {
  id: string;
  batterySessionId: string | null;
  testKey: BrainTestKey;
  domain: string;
  completedAt: string | null;
  durationMs: number | null;
  rawCompositeScore: number | null;
  formScore: number | null;
  validityStatus: 'valid' | 'invalid';
  historyStatus: BrainHistoryStatus;
  invalidReasons: string[];
}
