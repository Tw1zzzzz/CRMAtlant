import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPlayers } from "@/lib/api";
import type { User } from "@/types";

type Cs2Overview = {
  success: true;
  player: { userId: string; name: string; nickname: string | null };
  windows: {
    days7: any;
    days30: any;
  };
  questions: Array<{ id: string; title: string; answer: string }>;
};

export default function Cs2AnalyticsPanel() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<Cs2Overview | null>(null);

  const baseUrl = process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:5000";
  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await getPlayers();
        const arr: User[] = (res as any)?.data || [];
        setPlayers(arr);
        if (!selectedUserId && arr[0]?.id) setSelectedUserId(arr[0].id);
      } catch (e) {
        console.error(e);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!selectedUserId) return;
      try {
        setLoading(true);
        const res = await axios.get(`${baseUrl}/api/cs2/player/${selectedUserId}/overview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (res.data?.success) setData(res.data);
        else setData(null);
      } catch (e: any) {
        setData(null);
        toast.error(e?.response?.data?.message || e?.message || "Ошибка загрузки CS2 аналитики");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [baseUrl, selectedUserId, token]);

  if (user?.role !== "staff") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CS2 аналитика</CardTitle>
          <CardDescription>Доступно только для staff</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CS2 аналитика (7/30)</CardTitle>
          <CardDescription>Вопросно-ориентированная витрина по загруженным данным</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Игрок</div>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите игрока" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаем...
            </div>
          )}

          {!loading && data && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">PerformanceScore (7d)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {data.windows?.days7?.performanceScoreAvg != null ? Number(data.windows.days7.performanceScoreAvg).toFixed(2) : "—"}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">WinRate (7d)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {data.windows?.days7?.winRateAvg != null ? Number(data.windows.days7.winRateAvg).toFixed(2) + "%" : "—"}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">RoundWinRate (7d)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {data.windows?.days7?.roundWinRateAvg != null ? Number(data.windows.days7.roundWinRateAvg).toFixed(2) + "%" : "—"}
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.questions.map((q) => (
                  <Card key={q.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{q.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{q.answer}</CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

