import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { COLORS } from '@/styles/theme';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5
}) => {
  // Если страниц всего одна, не показываем пагинацию
  if (totalPages <= 1) {
    return null;
  }

  // Вычисляем видимые страницы для отображения
  const getVisiblePages = () => {
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Если достигли конца диапазона, сдвигаем начало
    if (endPage === totalPages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Генерируем массив номеров страниц
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  const visiblePages = getVisiblePages();
  const showStartEllipsis = visiblePages[0] > 1;
  const showEndEllipsis = visiblePages[visiblePages.length - 1] < totalPages;

  return (
    <div className="flex items-center justify-center space-x-1">
      {/* Кнопка "Предыдущая страница" */}
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{ 
          borderColor: COLORS.borderColor, 
          color: currentPage === 1 ? COLORS.textColorSecondary : COLORS.primary
        }}
  >
    <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Первая страница */}
      {showStartEllipsis && (
        <>
          <Button
            variant={currentPage === 1 ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(1)}
            style={{ 
              borderColor: COLORS.borderColor,
              backgroundColor: currentPage === 1 ? COLORS.primary : 'transparent',
              color: currentPage === 1 ? '#fff' : COLORS.textColor
            }}
          >
            1
          </Button>
          <span className="mx-0.5" style={{ color: COLORS.textColorSecondary }}>
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </>
      )}

      {/* Страницы */}
      {visiblePages.map(page => (
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="icon"
          onClick={() => onPageChange(page)}
          style={{ 
            borderColor: COLORS.borderColor,
            backgroundColor: currentPage === page ? COLORS.primary : 'transparent',
            color: currentPage === page ? '#fff' : COLORS.textColor
          }}
        >
          {page}
        </Button>
      ))}

      {/* Последняя страница */}
      {showEndEllipsis && (
        <>
          <span className="mx-0.5" style={{ color: COLORS.textColorSecondary }}>
    <MoreHorizontal className="h-4 w-4" />
  </span>
          <Button
            variant={currentPage === totalPages ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(totalPages)}
            style={{ 
              borderColor: COLORS.borderColor,
              backgroundColor: currentPage === totalPages ? COLORS.primary : 'transparent',
              color: currentPage === totalPages ? '#fff' : COLORS.textColor
            }}
          >
            {totalPages}
          </Button>
        </>
      )}

      {/* Кнопка "Следующая страница" */}
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{ 
          borderColor: COLORS.borderColor, 
          color: currentPage === totalPages ? COLORS.textColorSecondary : COLORS.primary
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
