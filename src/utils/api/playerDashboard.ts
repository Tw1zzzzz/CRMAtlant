import axios from "axios";

const baseUrl =
  process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:5000";

export type PlayerDashboardData = {
  scores: {
    readiness: number | null;
    performance: number | null;
    discipline?: number | null;
    success: number | null;
    confidence: number;
  };
  windows: {
    days7: { readiness: number | null; performance: number | null; discipline?: number | null; success: number | null };
    days30: { readiness: number | null; performance: number | null; discipline?: number | null; success: number | null };
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

export async function getPlayerDashboard(userId: string): Promise<{ success: boolean; data?: PlayerDashboardData; error?: string }> {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.get<DashboardApiResponse>(`${baseUrl}/api/player-dashboard/user/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 10000
    });

    if ((response.data as any)?.success) {
      return { success: true, data: (response.data as any).data };
    }

    return { success: false, error: (response.data as any)?.message || "Ошибка при загрузке дашборда" };
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || "Ошибка при загрузке дашборда";
    return { success: false, error: msg };
  }
}
