import React from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Calendar,
  Users,
  Shield,
  Eye,
  User,
  ExternalLink,
  CheckCircle,
  Clock,
  Archive
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { COLORS } from "@/styles/theme";
import { TeamReportResponse } from '@/lib/api';

interface TeamReportViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: TeamReportResponse;
}

const TeamReportViewModal: React.FC<TeamReportViewModalProps> = ({
  isOpen,
  onClose,
  report
}) => {
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

  const getVisibilityLabel = (visibility: string): string => {
    const labels: Record<string, string> = {
      team: 'Команда',
      staff: 'Персонал',
      public: 'Публичный'
    };
    return labels[visibility] || visibility;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return '🖼️';
    } else if (['pdf'].includes(extension || '')) {
      return '📄';
    } else if (['doc', 'docx'].includes(extension || '')) {
      return '📝';
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return '📊';
    } else {
      return '📎';
    }
  };

  const downloadFile = (url: string, filename: string) => {
    try {
      console.log('Downloading file:', { url, filename });
      
      // Создаем полный URL для файла
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback - просто открываем файл в новой вкладке
      window.open(url, '_blank');
    }
  };

  const openFile = (url: string) => {
    try {
      console.log('Opening file:', url);
      
      // Создаем полный URL для файла
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      
      window.open(fullUrl, '_blank');
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: COLORS.cardBackground }}>
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold mb-2" style={{ color: COLORS.textColor }}>
                {report.title}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(report.status)} text-white font-medium`}>
                  {getStatusLabel(report.status)}
                </Badge>
                <Badge className="bg-blue-600 text-white border-0 font-medium flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {getTypeLabel(report.type)}
                </Badge>
                <Badge className="bg-purple-600 text-white border-0 font-medium flex items-center gap-1">
                  {getVisibilityIcon(report.visibility)}
                  {getVisibilityLabel(report.visibility)}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Информация об отчете */}
          <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" style={{ color: COLORS.textColorSecondary }} />
                  <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Создано:</span>
                  <span className="text-sm font-medium" style={{ color: COLORS.textColor }}>
                    {formatDate(report.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" style={{ color: COLORS.textColorSecondary }} />
                  <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Автор:</span>
                  <span className="text-sm font-medium" style={{ color: COLORS.textColor }}>
                    {report.createdBy?.name || 'Неизвестный автор'}
                  </span>
                </div>

                {report.updatedAt && report.createdAt && report.updatedAt !== report.createdAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: COLORS.textColorSecondary }} />
                    <span className="text-sm" style={{ color: COLORS.textColorSecondary }}>Обновлено:</span>
                    <span className="text-sm font-medium" style={{ color: COLORS.textColor }}>
                      {formatDate(report.updatedAt)}
                    </span>
                  </div>
                )}
              </div>

              {report.description && (
                <div className="mt-4">
                  <p style={{ color: COLORS.textColorSecondary }}>
                    {report.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Краткое изложение */}
          <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ color: COLORS.textColor }}>
                Краткое изложение
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{ color: COLORS.textColor, lineHeight: '1.6' }}>
                {report.content?.summary || 'Краткое изложение не указано'}
              </p>
            </CardContent>
          </Card>

          {/* Подробное описание */}
          <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg" style={{ color: COLORS.textColor }}>
                Подробное описание
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ color: COLORS.textColor, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {report.content?.details || 'Подробное описание не указано'}
              </div>
            </CardContent>
          </Card>

          {/* Рекомендации */}
          {report.content?.recommendations && report.content.recommendations.length > 0 && (
            <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg" style={{ color: COLORS.textColor }}>
                  Рекомендации
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.content.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span style={{ color: COLORS.textColor }}>
                        {recommendation}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Дополнительные секции */}
          {report.content?.sections && report.content.sections.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: COLORS.textColor }}>
                Дополнительные секции
              </h3>
              {report.content.sections.map((section, index) => (
                <Card key={index} style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base" style={{ color: COLORS.textColor }}>
                      {section?.title || `Секция ${index + 1}`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ color: COLORS.textColor, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {section?.content || 'Содержимое секции не указано'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Вложения */}
          {report.content?.attachments && report.content.attachments.length > 0 && (
            <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg" style={{ color: COLORS.textColor }}>
                  Вложения ({report.content?.attachments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.content?.attachments?.map((attachment, index) => {
                    // Отладочная информация
                    console.log(`Attachment ${index}:`, attachment);
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 rounded-lg border"
                        style={{ backgroundColor: COLORS.cardBackground, borderColor: COLORS.borderColor }}
                      >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {getFileIcon(attachment?.filename || '')}
                        </span>
                        <div>
                          <p className="font-medium" style={{ color: COLORS.textColor }}>
                            {attachment?.filename || 'Файл без имени'}
                          </p>
                          <p className="text-sm" style={{ color: COLORS.textColorSecondary }}>
                            Загружено: {attachment.uploadedAt ? formatDate(attachment.uploadedAt.toString()) : 'Дата неизвестна'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log('Open button clicked:', attachment);
                            if (attachment?.url) {
                              openFile(attachment.url);
                            } else {
                              console.error('No URL found for attachment:', attachment);
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-md"
                          disabled={!attachment?.url}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Открыть
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log('Download button clicked:', attachment);
                            if (attachment?.url && attachment?.filename) {
                              downloadFile(attachment.url, attachment.filename);
                            } else {
                              console.error('Missing URL or filename for attachment:', attachment);
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-md"
                          disabled={!attachment?.url || !attachment?.filename}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Скачать
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Назначения и доступы */}
          {((report.assignedTo && report.assignedTo.length > 0) || 
           (report.viewableBy && report.viewableBy.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.assignedTo && report.assignedTo.length > 0 && (
                <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base" style={{ color: COLORS.textColor }}>
                      Назначено игрокам
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.assignedTo.map((user, index) => (
                        <div key={user?._id || index} className="flex items-center gap-2">
                          <User className="h-4 w-4" style={{ color: COLORS.textColorSecondary }} />
                          <span style={{ color: COLORS.textColor }}>{user?.name || 'Неизвестный пользователь'}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.viewableBy && report.viewableBy.length > 0 && (
                <Card style={{ backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base" style={{ color: COLORS.textColor }}>
                      Доступ для просмотра
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {report.viewableBy.map((user, index) => (
                        <div key={user?._id || index} className="flex items-center gap-2">
                          <Eye className="h-4 w-4" style={{ color: COLORS.textColorSecondary }} />
                          <span style={{ color: COLORS.textColor }}>{user?.name || 'Неизвестный пользователь'}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Нижняя панель с кнопками */}
        <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: COLORS.borderColor }}>
          <Button 
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white border-0 shadow-md"
          >
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamReportViewModal; 