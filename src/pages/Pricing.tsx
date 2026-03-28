import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createInvoice, getPlans } from '@/lib/api';
import ROUTES from '@/lib/routes';
import { isPlanActiveForUser } from '@/lib/subscriptionAccess';
import type { Plan } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

const PENDING_PAYMENT_STORAGE_KEY = 'payment:last-plan';

const formatPrice = (price: number): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(price);

const PricingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <Card key={index} className="border-border/60">
        <CardHeader className="space-y-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    ))}
  </div>
);

const Pricing = () => {
  const { user } = useAuth();
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const {
    data: plans = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
  });

  const purchaseMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (data, planId) => {
      const selectedPlan = plans.find((plan) => plan.id === planId);

      if (selectedPlan) {
        sessionStorage.setItem(
          PENDING_PAYMENT_STORAGE_KEY,
          JSON.stringify({ id: selectedPlan.id, name: selectedPlan.name })
        );
      }

      window.location.href = data.paymentUrl;
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'Не удалось создать счёт';
      toast.error(message);
    },
  });

  const handleBuy = (plan: Plan) => {
    setActivePlanId(plan.id);
    purchaseMutation.mutate(plan.id);
  };

  const errorMessage = error instanceof Error ? error.message : 'Не удалось загрузить тарифы';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <span className="text-sm uppercase tracking-[0.24em] text-primary/80">Billing</span>
        <h1 className="text-3xl font-bold">Тарифы</h1>
        <p className="text-muted-foreground max-w-2xl">
          Выберите план и перейдите на защищённую страницу оплаты Робокассы. После подтверждения оплаты доступ к платным функциям обновится автоматически.
        </p>
      </div>

      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertTitle>Текущий доступ</AlertTitle>
        <AlertDescription>
          {user?.hasPerformanceCoachCrmAccess || user?.hasCorrelationAnalysisAccess || user?.hasGameStatsAccess
            ? 'У вас уже есть активные платные продукты. При необходимости можно докупить или продлить доступ к нужному разделу.'
            : 'У вас пока нет активных платных тарифов.'}
        </AlertDescription>
      </Alert>

      {isLoading ? <PricingSkeleton /> : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Не удалось загрузить тарифы</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{errorMessage}</span>
            <Button variant="outline" onClick={() => refetch()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !isError ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = isPlanActiveForUser(user, plan.name);
            const isProcessing = purchaseMutation.isPending && activePlanId === plan.id;

            return (
              <Card
                key={plan.id}
                className={`border-border/60 transition-all ${isCurrentPlan ? 'border-primary shadow-lg shadow-primary/10' : ''}`}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>{plan.periodDays} дней доступа</CardDescription>
                    </div>
                    {isCurrentPlan ? <Badge>Активный тариф</Badge> : null}
                  </div>
                  <div className="text-3xl font-bold tracking-tight">{formatPrice(plan.price)}</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={isProcessing}
                    onClick={() => handleBuy(plan)}
                    variant={isCurrentPlan ? 'outline' : 'default'}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Переход к оплате...
                      </>
                    ) : (
                      'Купить'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">
        После оплаты вы вернётесь в приложение. Если доступ не обновился мгновенно, откройте{' '}
        <a className="underline underline-offset-4" href={ROUTES.PAYMENT_SUCCESS}>
          страницу подтверждения
        </a>
        .
      </div>
    </div>
  );
};

export default Pricing;
