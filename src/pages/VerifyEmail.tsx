import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import ROUTES from "@/lib/routes";
import { authService } from "@/services/auth.service";

type VerificationStatus = "loading" | "success" | "error";

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("Проверяем ссылку подтверждения...");

  useEffect(() => {
    let cancelled = false;

    const runVerification = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Ссылка подтверждения неполная.");
        return;
      }

      const result = await authService.verifyEmail({ token });
      if (cancelled) {
        return;
      }

      if (result.success) {
        setStatus("success");
        setMessage(result.message || "Email успешно подтвержден. Теперь можно войти.");
      } else {
        setStatus("error");
        setMessage(result.error || "Не удалось подтвердить email.");
      }
    };

    runVerification();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Подтверждение email</CardTitle>
          <CardDescription>
            {status === "loading"
              ? "Завершаем активацию аккаунта."
              : status === "success"
                ? "Аккаунт активирован."
                : "Не удалось активировать аккаунт."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-muted-foreground"}>
            {message}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" className="w-full" onClick={() => navigate(ROUTES.WELCOME)}>
            На экран входа
          </Button>
          {status === "success" && (
            <Button className="w-full" onClick={() => navigate(ROUTES.WELCOME)}>
              Войти
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default VerifyEmail;
