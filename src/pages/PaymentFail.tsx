import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCcw, XCircle } from 'lucide-react';
import ROUTES from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const PaymentFail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const reason = searchParams.get('reason') || 'Платёж был отменён или не подтверждён.';

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto max-w-2xl border-destructive/30">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <CardTitle className="text-3xl">Оплата не завершена</CardTitle>
          <CardDescription>
            Вы можете попробовать ещё раз после проверки способа оплаты или параметров счёта.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">Причина</p>
          <p className="text-base font-medium">{reason}</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => navigate(ROUTES.PRICING)}>
            <RefreshCcw className="h-4 w-4" />
            Повторить
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PaymentFail;
