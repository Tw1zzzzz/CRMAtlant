/**
 * Компонент индикатора загрузки
 */

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

/**
 * Индикатор загрузки с анимацией
 */
export const LoadingSpinner = ({ 
  size = "md", 
  className,
  text = "Загрузка..." 
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div 
        className={cn(
          "border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin",
          sizeClasses[size]
        )}
        role="status"
        aria-label="Загрузка"
      />
      {text && (
        <p className="text-sm text-gray-600 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
};

/**
 * Полноэкранный индикатор загрузки
 */
export const FullScreenLoader = ({ text }: { text?: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" text={text} />
  </div>
); 