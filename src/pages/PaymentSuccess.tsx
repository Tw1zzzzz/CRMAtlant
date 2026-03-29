import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getPaymentSuccessInfo } from '@/lib/api';
import ROUTES from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const PENDING_PAYMENT_STORAGE_KEY = 'payment:last-plan';
const MAX_STATUS_POLL_ATTEMPTS = 10;
const STATUS_POLL_INTERVAL_MS = 2000;

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [planName, setPlanName] = useState<string>('Новый тариф');
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Подтверждаем оплату...');

  const paymentParams = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return {
      OutSum: query.get('OutSum'),
      InvId: query.get('InvId'),
      SignatureValue: query.get('SignatureValue'),
    };
  }, [location.search]);

  useEffect(() => {
    const rawPlan = sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);

    if (rawPlan) {
      try {
        const parsed = JSON.parse(rawPlan) as { name?: string };
        if (parsed.name) {
          setPlanName(parsed.name);
        }
      } catch {
        // Ignore invalid session storage payloads.
      }
    }

    let isMounted = true;

    const syncPaymentState = async () => {
      for (let attempt = 1; attempt <= MAX_STATUS_POLL_ATTEMPTS; attempt += 1) {
        try {
          const successInfo = await getPaymentSuccessInfo(paymentParams);

          if (!isMounted) {
            return;
          }

          if (successInfo.planName) {
            setPlanName(successInfo.planName);
          }

          await refreshUser();
          await queryClient.invalidateQueries({ queryKey: ['current-user'] });
          await queryClient.invalidateQueries({ queryKey: ['plans'] });

          if (successInfo.status === 'active' || successInfo.hasAccess) {
            setIsAwaitingConfirmation(false);
            setStatusMessage('Оплата подтверждена и доступ открыт.');
            return;
          }

          if (attempt < MAX_STATUS_POLL_ATTEMPTS) {
            setStatusMessage('Оплата принята, ожидаем подтверждение сервера...');
            await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
          }
        } catch {
          if (!isMounted) {
            return;
          }

          if (attempt < MAX_STATUS_POLL_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
          }
        }
      }

      if (!isMounted) {
        return;
      }

      setIsAwaitingConfirmation(false);
      setStatusMessage('Оплата принята, но подтверждение задерживается. Обновите страницу через несколько секунд.');
    };

    void syncPaymentState();

    return () => {
      isMounted = false;
    };
  }, [paymentParams, queryClient, refreshUser]);

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto max-w-2xl border-primary/30 shadow-lg shadow-primary/10">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-3xl">Оплата прошла успешно</CardTitle>
          <CardDescription>
            Доступ к платным возможностям обновляется автоматически после подтверждения оплаты Робокассой.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-lg">
            Новый тариф: <span className="font-semibold">{planName}</span>
          </p>
          {isAwaitingConfirmation ? (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusMessage}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Если права обновились не сразу, страница уже инициировала повторную синхронизацию профиля.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => navigate(ROUTES.DASHBOARD)}>
            В Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
