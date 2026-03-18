import axios from "axios";

const baseUrl =
  process.env.NODE_ENV === "production" ? window.location.origin : "";

export type PlayerDashboardData = {
  scores: {
    readiness: number | null;
    performance: number | null;
    discipline?: number | null;
    success: number | null;
    confidence: number;
    brainPerformance?: number | null;
  };
  windows: {
    days7: { readiness: number | null; performance: number | null; discipline?: number | null; success: number | null };
    days30: { readiness: number | null; performance: number | null; discipline?: number | null; success: number | null };
  };
  brain?: {
    brainPerformanceIndex: number | null;
    confidence: 'low' | 'medium' | 'high';
    calibrationStatus: 'calibrating' | 'ready';
  };
  drivers: { label: string; value: number | null }[];
  timeline: {
    days7: { date: string; readiness: number | null; performance: number | null; discipline?: number | null; success: number | null }[];
    days30: { date: string; readiness: number | null; performance: number | null; discipline?: number | null; success: number | null }[];
  };
  player?: {
    userId: string;
    name: string;
    email: string;
    avatar: string;
    nickname: string | null;
  };
};

type DashboardApiResponse =
  | { success: true; data: PlayerDashboardData }
  | { success: false; message?: string };

const toNullableNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeTimelinePoints = (points: unknown) =>
  Array.isArray(points)
    ? points.map((point: any) => ({
        date: typeof point?.date === "string" ? point.date : "",
        readiness: toNullableNumber(point?.readiness),
        performance: toNullableNumber(point?.performance),
        discipline: toNullableNumber(point?.discipline),
        success: toNullableNumber(point?.success),
      }))
    : [];

const normalizePlayerDashboardData = (payload: any): PlayerDashboardData => ({
  scores: {
    readiness: toNullableNumber(payload?.scores?.readiness),
    performance: toNullableNumber(payload?.scores?.performance),
    discipline: toNullableNumber(payload?.scores?.discipline),
    success: toNullableNumber(payload?.scores?.success),
    confidence: typeof payload?.scores?.confidence === "number" ? payload.scores.confidence : 0,
    brainPerformance: toNullableNumber(payload?.scores?.brainPerformance),
  },
  windows: {
    days7: {
      readiness: toNullableNumber(payload?.windows?.days7?.readiness),
      performance: toNullableNumber(payload?.windows?.days7?.performance),
      discipline: toNullableNumber(payload?.windows?.days7?.discipline),
      success: toNullableNumber(payload?.windows?.days7?.success),
    },
    days30: {
      readiness: toNullableNumber(payload?.windows?.days30?.readiness),
      performance: toNullableNumber(payload?.windows?.days30?.performance),
      discipline: toNullableNumber(payload?.windows?.days30?.discipline),
      success: toNullableNumber(payload?.windows?.days30?.success),
    },
  },
  brain: payload?.brain
    ? {
        brainPerformanceIndex: toNullableNumber(payload.brain.brainPerformanceIndex),
        confidence:
          payload.brain.confidence === "low" ||
          payload.brain.confidence === "medium" ||
          payload.brain.confidence === "high"
            ? payload.brain.confidence
            : "low",
        calibrationStatus:
          payload.brain.calibrationStatus === "ready" ? "ready" : "calibrating",
      }
    : undefined,
  drivers: Array.isArray(payload?.drivers)
    ? payload.drivers.map((driver: any) => ({
        label: typeof driver?.label === "string" ? driver.label : "Без названия",
        value: toNullableNumber(driver?.value),
      }))
    : [],
  timeline: {
    days7: normalizeTimelinePoints(payload?.timeline?.days7),
    days30: normalizeTimelinePoints(payload?.timeline?.days30),
  },
  player: payload?.player
    ? {
        userId: typeof payload.player.userId === "string" ? payload.player.userId : "",
        name: typeof payload.player.name === "string" ? payload.player.name : "",
        email: typeof payload.player.email === "string" ? payload.player.email : "",
        avatar: typeof payload.player.avatar === "string" ? payload.player.avatar : "",
        nickname:
          typeof payload.player.nickname === "string" || payload.player.nickname === null
            ? payload.player.nickname
            : null,
      }
    : undefined,
});

export async function getPlayerDashboard(userId: string): Promise<{ success: boolean; data?: PlayerDashboardData; error?: string }> {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.get<DashboardApiResponse>(`${baseUrl}/api/player-dashboard/user/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 10000
    });

    if ((response.data as any)?.success) {
      const rawData = (response.data as any)?.data ?? response.data;
      return { success: true, data: normalizePlayerDashboardData(rawData) };
    }

    return { success: false, error: (response.data as any)?.message || "Ошибка при загрузке дашборда" };
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || "Ошибка при загрузке дашборда";
    return { success: false, error: msg };
  }
}
