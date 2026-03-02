import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";

/**
 * Тип роли пользователя
 */
type UserRole = "player" | "staff";

/**
 * Интерфейс состояния формы регистрации
 */
interface RegisterFormState {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  faceitUrl: string;
  isLoading: boolean;
}

/**
 * Компонент страницы регистрации пользователя
 */
const Register: React.FC = () => {
  // Состояние формы в одном объекте для удобства управления
  const [formState, setFormState] = useState<RegisterFormState>({
    name: "",
    email: "",
    password: "",
    role: "player",
    faceitUrl: "",
    isLoading: false
  });
  
  const { register } = useAuth();
  const navigate = useNavigate();

  /**
   * Обновление текстового поля формы
   */
  const updateFormField = (field: keyof Omit<RegisterFormState, 'isLoading' | 'role'>, value: string): void => {
    setFormState(prevState => ({
      ...prevState,
      [field]: value
    }));
  };

  /**
   * Обновление поля роли пользователя
   */
  const updateRole = (value: UserRole): void => {
    setFormState(prevState => ({
      ...prevState,
      role: value
    }));
  };

  /**
   * Обработчик отправки формы регистрации
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    const { name, email, password, role, faceitUrl } = formState;
    
    // Валидация полей перед отправкой
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }

    if (role === "player" && !faceitUrl.trim()) {
      toast.error("Для игрока ссылка Faceit обязательна");
      return;
    }
    
    // Устанавливаем состояние загрузки
    setFormState(prevState => ({ ...prevState, isLoading: true }));
    
    try {
      const result = await register({ name, email, password, role, faceitUrl: faceitUrl.trim() || undefined });
      
      if (result.success) {
        toast.success("Регистрация прошла успешно");
        navigate("/dashboard");
      } else {
        toast.error(result.error || "Ошибка при регистрации");
      }
    } catch (error) {
      console.error("Ошибка при регистрации:", error);
      toast.error("Не удалось создать аккаунт. Пожалуйста, попробуйте позже.");
    } finally {
      // Сбрасываем состояние загрузки независимо от результата
      setFormState(prevState => ({ ...prevState, isLoading: false }));
    }
  };

  const { name, email, password, role, faceitUrl, isLoading } = formState;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Регистрация</CardTitle>
          <CardDescription className="text-center">
            Создайте новый аккаунт
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => updateFormField('name', e.target.value)}
                required
                autoComplete="name"
                disabled={isLoading}
              />
            </div>
            
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
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Роль</Label>
              <RadioGroup 
                defaultValue="player" 
                value={role} 
                onValueChange={(value) => updateRole(value as UserRole)}
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="player" id="player" />
                  <Label htmlFor="player">Игрок</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="staff" id="staff" />
                  <Label htmlFor="staff">Стафф</Label>
                </div>
              </RadioGroup>
            </div>

            {role === "player" && (
              <div className="space-y-2">
                <Label htmlFor="faceitUrl">Ссылка Faceit</Label>
                <Input
                  id="faceitUrl"
                  value={faceitUrl}
                  onChange={(e) => updateFormField('faceitUrl', e.target.value)}
                  required
                  placeholder="https://www.faceit.com/en/players/your_nickname"
                  disabled={isLoading}
                />
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Загрузка..." : "Зарегистрироваться"}
            </Button>
            
            <div className="text-center text-sm">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Войти
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;
