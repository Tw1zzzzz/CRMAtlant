import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Key, Shield, Users, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { updatePrivilegeKey } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface StaffPrivilegeUpgradeProps {
  onUpgradeSuccess?: () => void;
  className?: string;
}

/**
 * Компонент для повышения привилегий staff пользователя
 * Позволяет вводить код доступа и получать расширенные права
 */
const StaffPrivilegeUpgrade: React.FC<StaffPrivilegeUpgradeProps> = ({
  onUpgradeSuccess,
  className = ''
}) => {
  const { user, refreshUser } = useAuth();
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Проверяем, есть ли уже привилегии
  const hasPrivileges = user?.privilegeKey && user.privilegeKey.trim() !== '';

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode.trim()) {
      setError('Введите код доступа');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Отправка кода доступа для повышения привилегий...');
      
      const response = await updatePrivilegeKey(accessCode);
      
      if (response.success) {
        setIsSuccess(true);
        setAccessCode('');
        toast.success('Привилегии успешно получены! Теперь вы можете управлять персоналом и игроками.');
        
        // Обновляем данные пользователя
        await refreshUser();
        
        // Вызываем callback если передан
        if (onUpgradeSuccess) {
          onUpgradeSuccess();
        }
      } else {
        setError(response.message || 'Неверный код доступа');
        toast.error('Неверный код доступа');
      }
    } catch (err: any) {
      console.error('Ошибка при повышении привилегий:', err);
      setError(err.message || 'Произошла ошибка при проверке кода');
      toast.error('Ошибка при проверке кода доступа');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Если уже есть привилегии, показываем статус
  if (hasPrivileges) {
    return (
      <Card className={`border-green-200 bg-green-50 ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-600" />
              <CardTitle className="text-green-800">Привилегированный доступ</CardTitle>
            </div>
            <Badge variant="default" className="bg-green-600">
              Активен
            </Badge>
          </div>
          <CardDescription className="text-green-700">
            У вас есть расширенные права для управления персоналом и игроками
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 text-sm text-green-700">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Управление игроками</span>
            </div>
            <div className="flex items-center space-x-1">
              <UserCog className="h-4 w-4" />
              <span>Управление персоналом</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Key className="h-5 w-5 text-blue-600" />
          <CardTitle>Получить привилегированный доступ</CardTitle>
        </div>
        <CardDescription>
          Введите код доступа для получения расширенных прав управления
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Привилегии успешно активированы! Перезагрузите страницу для применения изменений.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmitCode} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Введите код доступа"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              disabled={isSubmitting}
              className="font-mono"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isSubmitting || !accessCode.trim()}
            className="w-full"
          >
            {isSubmitting ? 'Проверка...' : 'Активировать привилегии'}
          </Button>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Что дают привилегии:
          </h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Управление составом персонала команды</li>
            <li>• Добавление и удаление игроков</li>
            <li>• Доступ к расширенной аналитике</li>
            <li>• Предоставление привилегий другим сотрудникам</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default StaffPrivilegeUpgrade; 