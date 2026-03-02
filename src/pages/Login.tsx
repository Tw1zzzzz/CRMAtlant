import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";

/**
 * Интерфейс состояния формы входа
 */
interface LoginFormState {
  email: string;
  password: string;
  isLoading: boolean;
}

/**
 * Компонент страницы входа в систему
 */
const Login: React.FC = () => {
  // Состояние формы в одном объекте вместо отдельных useState
  const [formState, setFormState] = useState<LoginFormState>({
    email: "",
    password: "",
    isLoading: false
  });
  
  const { login } = useAuth();
  const navigate = useNavigate();

  /**
   * Обновление отдельного поля формы
   */
  const updateFormField = (field: keyof Omit<LoginFormState, 'isLoading'>, value: string): void => {
    setFormState(prevState => ({
      ...prevState,
      [field]: value
    }));
  };

  /**
   * Обработчик отправки формы
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const { email, password } = formState;
    
    // Валидация полей перед отправкой
    if (!email.trim() || !password) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }
    
    // Устанавливаем состояние загрузки
    setFormState(prevState => ({ ...prevState, isLoading: true }));
    
    try {
      const result = await login({ email, password });
      
      if (result.success) {
        toast.success("Вход выполнен успешно");
        navigate("/dashboard");
      } else {
        toast.error(result.error || "Ошибка при входе в систему");
      }
    } catch (error) {
      console.error("Ошибка аутентификации:", error);
      toast.error("Не удалось выполнить вход. Пожалуйста, попробуйте позже.");
    } finally {
      // Сбрасываем состояние загрузки независимо от результата
      setFormState(prevState => ({ ...prevState, isLoading: false }));
    }
  };

  const { email, password, isLoading } = formState;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Вход в систему</CardTitle>
          <CardDescription className="text-center">
            Введите свои данные для входа в аккаунт
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => updateFormField('email', e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => updateFormField('password', e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Загрузка..." : "Войти"}
            </Button>
            
            <div className="text-center text-sm">
              Нет аккаунта?{" "}
              <Link to="/register" className="text-blue-600 hover:underline">
                Зарегистрироваться
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
