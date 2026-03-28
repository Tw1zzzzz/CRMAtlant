import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ROUTES from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const PENDING_PAYMENT_STORAGE_KEY = 'payment:last-plan';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const [planName, setPlanName] = useState<string>('Новый тариф');

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

    void queryClient.invalidateQueries({ queryKey: ['current-user'] });
    void queryClient.invalidateQueries({ queryKey: ['plans'] });
    void refreshUser();
  }, [queryClient, refreshUser]);

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
