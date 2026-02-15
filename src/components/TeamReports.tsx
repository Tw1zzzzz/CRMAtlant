import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Filter, 
  Search, 
  Calendar,
  Eye,
  Edit,
  Trash2,
  Download,
  Users,
  Shield,
  Clock,
  CheckCircle,
  Archive,
  FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from "@/styles/theme";
import {
  getTeamReports,
  getTeamReportsStats,
  deleteTeamReport,
  updateTeamReportStatus,
  TeamReportResponse,
  TeamReportFilters
} from '@/lib/api';
import TeamReportModal from './TeamReportModal';
import TeamReportViewModal from './TeamReportViewModal';
import PDFExporter from '@/utils/export/PDFExporter';
import ExcelExporter from '@/utils/export/ExcelExporter';

interface TeamReportsStats {
  total: number;
  byStatus: {
    draft: number;
    published: number;
    archived: number;
  };
  byType: {
    weekly: number;
    monthly: number;
    custom: number;
    match_analysis: number;
    training_report: number;
  };
  recent: number;
}

const TeamReports: React.FC = () => {
  // Состояния
  const [reports, setReports] = useState<TeamReportResponse[]>([]);
  const [stats, setStats] = useState<TeamReportsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(true);
  const [filters, setFilters] = useState<TeamReportFilters>({
    page: 1,
    limit: 10
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TeamReportResponse | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  // Отладочная информация для понимания проблемы
  console.log('🔍 [TeamReports] Отладка аутентификации:', {
    user: user,
    userRole: user?.role,
    isStaff: isStaff,
    userCheck: user ? 'авторизован' : 'не авторизован',
    roleCheck: user?.role === 'staff' ? 'staff' : (user?.role || 'роль не определена')
  });

  // Проверяем загрузку пользователя
  useEffect(() => {
    const checkUserLoad = () => {
      // Добавляем небольшую задержку для загрузки аутентификации
      setTimeout(() => {
        setUserLoading(false);
      }, 100);
    };
    
    checkUserLoad();
  }, []);

  const fetchReports = async () => {
    if (!user) {
      console.log('Пользователь не загружен, пропускаем загрузку отчетов');
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getTeamReports(filters);
      const reportsData = response?.data?.data?.reports || response?.data?.reports || [];
      
      // Проверяем, что данные являются массивом
      if (Array.isArray(reportsData)) {
        setReports(reportsData);
      } else {
        console.warn('Получены некорректные данные отчетов:', reportsData);
        setReports([]);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки отчетов:', error);
      setReports([]);
      
      // Показываем ошибку только если это не ошибка аутентификации
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        toast({
          title: "Ошибка",
          description: error.response?.data?.message || "Не удалось загрузить отчеты",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user || !isStaff) {
      setStats(null);
      return;
    }

    try {
      const response = await getTeamReportsStats();
      const statsData = response?.data?.data || response?.data;
      
      // Проверяем структуру данных статистики
      if (statsData && typeof statsData === 'object') {
        const safeStats: TeamReportsStats = {
          total: statsData.total || 0,
          byStatus: {
            draft: statsData.byStatus?.draft || 0,
            published: statsData.byStatus?.published || 0,
            archived: statsData.byStatus?.archived || 0,
          },
          byType: {
            weekly: statsData.byType?.weekly || 0,
            monthly: statsData.byType?.monthly || 0,
            custom: statsData.byType?.custom || 0,
            match_analysis: statsData.byType?.match_analysis || 0,
            training_report: statsData.byType?.training_report || 0,
          },
          recent: statsData.recent || 0,
        };
        setStats(safeStats);
      } else {
        setStats(null);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки статистики отчетов:', error);
      setStats(null); // Устанавливаем null при ошибке
    }
  };

  // Эффекты
  useEffect(() => {
    if (user && !userLoading) {
      fetchReports();
    }
  }, [filters, user, userLoading]);

  useEffect(() => {
    if (isStaff && user && !userLoading) {
      fetchStats();
    }
  }, [isStaff, user, userLoading]);

  // Обработчики событий
  const handleSearch = () => {
    setFilters({ ...filters, page: 1 });
    fetchReports();
  };

  const handleFilterChange = (key: keyof TeamReportFilters, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handleCreateReport = () => {
    console.log('Создание отчета - клик по кнопке');
    
    // Проверяем авторизацию
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Необходимо войти в систему для создания отчетов",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedReport(null);
    setShowCreateModal(true);
    console.log('showCreateModal установлен в true');
  };

  const handleEditReport = (report: TeamReportResponse) => {
    setSelectedReport(report);
    setShowCreateModal(true);
  };

  const handleViewReport = (report: TeamReportResponse) => {
    setSelectedReport(report);
    setShowViewModal(true);
  };

  const handleStatusChange = async (reportId: string, newStatus: 'draft' | 'published' | 'archived') => {
    try {
      setIsUpdating(true);
      await updateTeamReportStatus(reportId, newStatus);
      await fetchReports();
      toast({
        title: "Успешно",
        description: `Статус отчета изменен на "${getStatusLabel(newStatus)}"`,
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.response?.data?.message || "Не удалось изменить статус",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот отчет?')) {
      return;
    }

    try {
      setIsUpdating(true);
      await deleteTeamReport(reportId);
      await fetchReports();
      await fetchStats();
      toast({
        title: "Успешно",
        description: "Отчет удален",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.response?.data?.message || "Не удалось удалить отчет",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const onReportSaved = async () => {
    setShowCreateModal(false);
    await fetchReports();
    await fetchStats();
  };

  // Функции экспорта
  const handleExportPDF = async () => {
    try {
      const pdfExporter = new PDFExporter();
      await pdfExporter.exportTeamReport({
        title: 'Отчеты команды',
        subtitle: 'Сводка всех отчетов команды',
        createdAt: new Date().toISOString(),
        summary: `Всего отчетов: ${stats?.total || 0}. Опубликованных: ${stats?.byStatus.published || 0}. Архивированных: ${stats?.byStatus.archived || 0}.`,
        keyMetrics: [
          { label: 'Всего отчетов', value: stats?.total || 0 },
          { label: 'Опубликованных', value: stats?.byStatus.published || 0 },
          { label: 'Черновиков', value: stats?.byStatus.draft || 0 },
          { label: 'Архивированных', value: stats?.byStatus.archived || 0 }
        ],
        details: `Активность команды за последний период показывает ${stats?.total || 0} отчетов. Большинство отчетов находятся в активном статусе.`,
        recommendations: [
          'Регулярно обновляйте отчеты для поддержания актуальности',
          'Переводите черновики в статус "опубликован" после завершения',
          'Архивируйте устаревшие отчеты для улучшения организации'
        ],
        attachments: []
      });
      
      toast({
        title: "Экспорт завершен",
        description: "PDF отчет успешно сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта PDF:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать PDF отчет",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    try {
      const excelExporter = new ExcelExporter();
      await excelExporter.exportTeamReports(reports);
      
      toast({
        title: "Экспорт завершен",
        description: "Excel файл успешно сохранен",
      });
    } catch (error) {
      console.error('Ошибка экспорта Excel:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось создать Excel файл",
        variant: "destructive",
      });
    }
  };

  // Вспомогательные функции
  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      weekly: 'Еженедельный',
      monthly: 'Ежемесячный',
      custom: 'Особый',
      match_analysis: 'Анализ матча',
      training_report: 'Отчет о тренировке'
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: 'Черновик',
      published: 'Опубликован',
      archived: 'Архивирован'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-500 text-white',
      published: 'bg-green-600 text-white',
      archived: 'bg-gray-500 text-white'
    };
    return colors[status] || 'bg-gray-500 text-white';
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'team': return <Users className="h-4 w-4" />;
      case 'staff': return <Shield className="h-4 w-4" />;
      case 'public': return <Eye className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Защитная проверка для reports
  const safeReports = Array.isArray(reports) ? reports : [];

  // Отладочная информация
  console.log('TeamReports render:', { 
    user: user?.username || user?.name, 
    isStaff, 
    showCreateModal, 
    reportsCount: safeReports.length,
    userLoading
  });

  // Показываем индикатор загрузки если пользователь еще не загружен
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-400" />
          <p className="text-white font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (loading && safeReports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-400" />
          <p className="text-white font-medium">Загрузка отчетов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика (только для персонала) */}
      {isStaff && stats && stats.byStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                  <p className="text-sm text-gray-300">Всего отчетов</p>
                </div>
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.byStatus?.published || 0}</p>
                  <p className="text-sm text-gray-300">Опубликованы</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.byStatus?.draft || 0}</p>
                  <p className="text-sm text-gray-300">Черновики</p>
                </div>
                <Edit className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.recent || 0}</p>
                  <p className="text-sm text-gray-300">За неделю</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Заголовок с кнопками экспорта */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Отчеты команды
          </h2>
          <p className="text-gray-300">
            Управление отчетами о работе команды
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Кнопки экспорта (только для персонала) */}
          {isStaff && (
            <>
              <Button 
                size="sm" 
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium border-0 shadow-md"
              >
                <FileText className="h-4 w-4" />
                <span className="text-white font-medium">Экспорт PDF</span>
              </Button>
              <Button 
                size="sm" 
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-0 shadow-md"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-white font-medium">Экспорт Excel</span>
              </Button>
            </>
          )}
          
          {/* Кнопка создания отчета доступна всем авторизованным пользователям */}
          {user && (
            <Button 
              onClick={handleCreateReport} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg"
              disabled={!user}
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="text-white font-medium">Создать отчет</span>
            </Button>
          )}
        </div>
      </div>

      {/* Фильтры и поиск */}
      <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Поиск отчетов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
              />
            </div>

            <Select value={filters.type || 'all'} onValueChange={(value) => handleFilterChange('type', value === 'all' ? undefined : value)}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Тип отчета" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="all" className="text-white hover:bg-gray-600">Все типы</SelectItem>
                <SelectItem value="weekly" className="text-white hover:bg-gray-600">Еженедельный</SelectItem>
                <SelectItem value="monthly" className="text-white hover:bg-gray-600">Ежемесячный</SelectItem>
                <SelectItem value="match_analysis" className="text-white hover:bg-gray-600">Анализ матча</SelectItem>
                <SelectItem value="training_report" className="text-white hover:bg-gray-600">Отчет о тренировке</SelectItem>
                <SelectItem value="custom" className="text-white hover:bg-gray-600">Особый</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="all" className="text-white hover:bg-gray-600">Все статусы</SelectItem>
                <SelectItem value="draft" className="text-white hover:bg-gray-600">Черновик</SelectItem>
                <SelectItem value="published" className="text-white hover:bg-gray-600">Опубликован</SelectItem>
                <SelectItem value="archived" className="text-white hover:bg-gray-600">Архивирован</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={handleSearch} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium border-0 shadow-md"
            >
              <Filter className="h-4 w-4 mr-2" />
              <span className="text-white font-medium">Применить</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список отчетов */}
      <div className="grid grid-cols-1 gap-4">
        {safeReports.map((report) => (
          <Card key={report.id} style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-white text-lg">
                      {report.title}
                    </h3>
                    <Badge className={getStatusColor(report.status)}>
                      {getStatusLabel(report.status)}
                    </Badge>
                    <Badge variant="outline" className="border-gray-600 text-gray-300">
                      {getTypeLabel(report.type)}
                    </Badge>
                  </div>
                  
                  <p className="text-sm mb-3 text-gray-300">
                    {report.summary}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span className="text-gray-300">{report.author?.username || 'Неизвестно'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-gray-300">{formatDate(report.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getVisibilityIcon(report.visibility)}
                      <span className="text-gray-300">{report.visibility}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleViewReport(report)}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-md"
                    title="Просмотреть отчет"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {isStaff && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleEditReport(report)}
                        className="bg-orange-600 hover:bg-orange-700 text-white border-0 shadow-md"
                        title="Редактировать отчет"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Select 
                        value={report.status} 
                        onValueChange={(value: any) => handleStatusChange(report.id, value)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-700 border-gray-600">
                          <SelectItem value="draft" className="text-white hover:bg-gray-600">Черновик</SelectItem>
                          <SelectItem value="published" className="text-white hover:bg-gray-600">Опубликован</SelectItem>
                          <SelectItem value="archived" className="text-white hover:bg-gray-600">Архивирован</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        size="sm"
                        onClick={() => handleDeleteReport(report.id)}
                        className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-md"
                        disabled={isUpdating}
                        title="Удалить отчет"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Пустое состояние */}
      {!loading && safeReports.length === 0 && (
        <Card style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2 text-white">
                {user ? 'Отчетов не найдено' : 'Войдите в систему для просмотра отчетов'}
              </h3>
              <p className="text-gray-300">
                {user ? (
                  searchQuery || filters.type || filters.status 
                    ? 'Попробуйте изменить параметры поиска'
                    : 'Создайте первый отчет команды'
                ) : 'Необходима авторизация для доступа к отчетам'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Модальные окна */}
      {showCreateModal && (
        <TeamReportModal
          report={selectedReport}
          onClose={() => {
            console.log('Закрытие модального окна создания отчета');
            setShowCreateModal(false);
          }}
          onSave={onReportSaved}
        />
      )}

      {showViewModal && selectedReport && (
        <TeamReportViewModal
          isOpen={showViewModal}
          report={selectedReport}
          onClose={() => setShowViewModal(false)}
        />
      )}
    </div>
  );
};

export default TeamReports; 