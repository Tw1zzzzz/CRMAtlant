import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Brain, Gauge, UserRound, Waves } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAnalyticsOverview, getTestsStateImpact } from "@/lib/api";

type OverviewData = {
  totals: {
    activePlayers: number;
    moodEntries: number;
    testEntries: number;
    balanceEntries: number;
    avgMood: number;
    avgEnergy: number;
    avgTestScore: number;
    avgBalanceIndex: number;
  };
  moodTrend: Array<{ date: string; mood: number; energy: number }>;
  testsByType: Array<{ type: string; count: number }>;
};

type StateImpactData = {
  totals: {
    avgScore: number;
    entries: number;
    scoredEntries: number;
    avgStateIndex: number;
  };
  stateToResult: {
    fatigue: { low: number; mid: number; high: number };
    focus: { low: number; mid: number; high: number };
    stress: { low: number; mid: number; high: number };
  };
};

const periodToRange = (period: string) => {
  const now = new Date();
  const from = new Date(now);
  if (period === "7d") {
    from.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    from.setDate(now.getDate() - 30);
  } else {
    from.setDate(now.getDate() - 90);
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10)
  };
};

const NewAnalytics: React.FC = () => {
  const [period, setPeriod] = useState("30d");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [stateImpact, setStateImpact] = useState<StateImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { from, to } = periodToRange(period);
        const [overviewResponse, stateResponse] = await Promise.all([
          getAnalyticsOverview(),
          getTestsStateImpact({ from, to })
        ]);
        setOverview(overviewResponse.data);
        setStateImpact(stateResponse.data);
      } catch (error) {
        console.error("Error loading new analytics data:", error);
        setOverview(null);
        setStateImpact(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [period]);

  const stateBars = useMemo(() => {
    if (!stateImpact) {
      return [];
    }

    return [
      {
        name: "Усталость",
        low: stateImpact.stateToResult.fatigue.low,
        mid: stateImpact.stateToResult.fatigue.mid,
        high: stateImpact.stateToResult.fatigue.high
      },
      {
        name: "Фокус",
        low: stateImpact.stateToResult.focus.low,
        mid: stateImpact.stateToResult.focus.mid,
        high: stateImpact.stateToResult.focus.high
      },
      {
        name: "Стресс",
        low: stateImpact.stateToResult.stress.low,
        mid: stateImpact.stateToResult.stress.mid,
        high: stateImpact.stateToResult.stress.high
      }
    ];
  }, [stateImpact]);

  return (
    <div className="container mx-auto p-6 space-y-6 performance-page">
      <div className="performance-hero flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
        <div>
          <span className="performance-eyebrow">Intelligence Deck</span>
          <h1 className="text-3xl font-bold performance-title">Новая аналитика</h1>
          <p className="text-muted-foreground performance-subtitle">
            Реальный обзор по данным настроения, тестов и колеса баланса
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Последние 7 дней</SelectItem>
            <SelectItem value="30d">Последние 30 дней</SelectItem>
            <SelectItem value="90d">Последние 90 дней</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Загрузка аналитики...
          </CardContent>
        </Card>
      ) : !overview ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Не удалось загрузить данные аналитики
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Среднее настроение</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{overview.totals.avgMood}</span>
                <Waves className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Средняя энергия</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{overview.totals.avgEnergy}</span>
                <Activity className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Средний балл тестов</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{overview.totals.avgTestScore}</span>
                <Brain className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Активные игроки</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-semibold">{overview.totals.activePlayers}</span>
                <UserRound className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Динамика состояния</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={overview.moodTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mood" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Распределение тестов по типам</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.testsByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {stateImpact && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{"Состояние -> результат теста"}</CardTitle>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" />
                  Индекс состояния: {stateImpact.totals.avgStateIndex}
                </Badge>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="low" stackId="a" fill="#22c55e" />
                    <Bar dataKey="mid" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="high" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default NewAnalytics;
