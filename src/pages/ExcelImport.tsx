import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ImportReport = {
  totalRows: number;
  okRows: number;
  rejectedRows: number;
  errorsSample: Array<{ row: number; nickname?: string; reason: string }>;
};

const ExcelImport = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"team" | "player">("team");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const baseUrl = process.env.NODE_ENV === "production" ? window.location.origin : "http://localhost:5000";

  const submit = async () => {
    if (!file) {
      toast.error("Выберите Excel файл (.xlsx)");
      return;
    }
    try {
      setLoading(true);
      setReport(null);
      const token = localStorage.getItem("token");
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      form.append("date", date);

      const res = await axios.post(`${baseUrl}/api/imports/cs2-excel`, form, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "multipart/form-data"
        }
      });

      if (res.data?.success) {
        setReport(res.data.report);
        toast.success("Импорт завершен");
      } else {
        toast.error(res.data?.message || "Ошибка импорта");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Ошибка импорта");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "staff") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Импорт CS2 (Excel)</CardTitle>
          <CardDescription>Доступно только для staff</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Импорт CS2 (Excel)</CardTitle>
          <CardDescription>
            Поддержка: общий файл (nickname обязателен в каждой строке) и файл игрока (можно nickname__YYYY-MM-DD.xlsx)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Режим</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите режим" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team file (внутри nickname)</SelectItem>
                <SelectItem value="player">Player file (nickname из имени/строки)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Дата (если нет в имени файла)</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Excel файл</Label>
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Импорт..." : "Загрузить"}
          </Button>
        </CardFooter>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>Отчет импорта</CardTitle>
            <CardDescription>
              Всего строк: {report.totalRows} • OK: {report.okRows} • Reject: {report.rejectedRows}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.errorsSample?.length ? (
              <div className="text-sm space-y-1">
                {report.errorsSample.map((e, idx) => (
                  <div key={idx}>
                    <span className="font-medium">Строка {e.row}</span>
                    {e.nickname ? ` (${e.nickname})` : ""}: {e.reason}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Ошибок нет</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExcelImport;

