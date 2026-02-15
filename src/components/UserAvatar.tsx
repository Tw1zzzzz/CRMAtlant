import React, { useMemo, useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types";
import { getUserAvatarUrl } from '@/utils/imageUtils';

interface UserAvatarProps {
  user: User | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  forceUpdate?: boolean;
}

/**
 * Компонент для отображения аватара пользователя
 */
const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  className = '',
  size = 'md',
  onClick,
  forceUpdate = false
}) => {
  // Локальное состояние для отслеживания загрузки изображения
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Сбрасываем состояние при изменении пользователя или аватара
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
  }, [user?.avatar, user?._updateTimestamp]);
  
  // Пробуем перезагрузить аватар при ошибке, но максимум 2 раза
  useEffect(() => {
    if (imageError && retryCount < 2) {
      const timer = setTimeout(() => {
        console.log(`🔄 Повторная попытка загрузки аватара (${retryCount + 1}/2)`);
        setRetryCount(prev => prev + 1);
        setImageError(false);
      }, 1000); // Пробуем снова через 1 секунду
      
      return () => clearTimeout(timer);
    }
  }, [imageError, retryCount]);
  
  // Размеры аватара
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  // Размеры текста
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };
  
  // Если пользователь не указан, показываем пустой аватар
  if (!user) {
    return (
      <Avatar 
        className={`${sizes[size]} ${className}`} 
        onClick={onClick}
      >
        <AvatarFallback className="bg-muted">
          ?
        </AvatarFallback>
      </Avatar>
    );
  }
  
  // Генерируем уникальный ключ для компонента и получаем URL аватара
  // Используем timestamp из пользователя если есть, или создаем новый
  // При принудительном обновлении также добавляем текущий timestamp
  const timestamp = forceUpdate 
    ? Date.now() 
    : (user._updateTimestamp || Date.now());
    
  const retryKey = retryCount > 0 ? `-retry${retryCount}` : '';
  const avatarKey = `avatar-${user.id}-${user.avatar || 'none'}-${timestamp}${retryKey}`;
  
  // Получаем URL аватара с помощью нашей утилиты
  const avatarUrl = getUserAvatarUrl(user.avatar);

  console.log('Avatar URL:', avatarUrl); // Логируем URL для отладки

  // Получаем инициалы пользователя для аватара
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Обработчик успешной загрузки изображения
  const handleImageLoad = () => {
    console.log('Avatar image loaded successfully');
    setImageLoaded(true);
    setImageError(false);
  };

  // Обработчик ошибки загрузки изображения
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Error loading avatar:', e);
    setImageLoaded(false);
    setImageError(true);
  };

  // Отфильтровываем props, чтобы убрать data-атрибуты, но key передаем отдельно
  const filteredProps = {
    className: `${sizes[size]} ${className} ${onClick ? 'cursor-pointer' : ''}`,
    onClick
  };

  return (
    <Avatar 
      key={avatarKey}
      {...filteredProps}
    >
      {user.avatar && !imageError && (
        <AvatarImage 
          src={avatarUrl} 
          alt={`Аватар ${user.name}`}
          key={`image-${avatarKey}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}
      <AvatarFallback 
        className={`${textSizes[size]} bg-primary text-primary-foreground`}
        key={`fallback-${avatarKey}`}
      >
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;