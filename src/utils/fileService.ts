import axios from 'axios';

// Базовый URL для API
const API_URL = process.env.NODE_ENV === 'production' ? '' : '';

interface FileItem {
  _id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  readableSize?: string;
  path: string;
  mimeType?: string;
  owner: any;
  parentFolder: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface FileResponse {
  status: string;
  data: {
    files: FileItem[];
    pagination: PaginationData;
  };
}

interface CreateFolderResponse {
  status: string;
  data: {
    folder: FileItem;
  };
}

interface UploadFileResponse {
  status: string;
  data: {
    file: FileItem;
  };
}

const fileService = {
  // Кеш для информации о файлах
  _fileCache: new Map<string, FileItem>(),
  
  // Метод для получения файла из кеша или загрузки его информации
  getFileInfo: async (fileId: string): Promise<FileItem | null> => {
    // Проверяем кеш
    if (fileService._fileCache.has(fileId)) {
      return fileService._fileCache.get(fileId) || null;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      // Получаем информацию о файле по API
      const response = await axios.get<{status: string, data: {file: FileItem}}>(
        `${API_URL}/api/files/${fileId}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: status => status < 500 // Принимаем ответы с кодом ниже 500
        }
      );
      
      // Проверяем статус ответа
      if (response.status !== 200) {
        console.error('Ошибка при получении информации о файле:', response.data);
        return null;
      }
      
      const fileInfo = response.data.data.file;
      
      // Сохраняем в кеш
      fileService._fileCache.set(fileId, fileInfo);
      
      return fileInfo;
    } catch (error) {
      console.error('Ошибка при получении информации о файле:', error);
      return null;
    }
  },
  
  /**
   * Получение списка файлов и папок
   */
  getFiles: async (
    parentFolderId?: string, 
    search?: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{ files: FileItem[], pagination: PaginationData }> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const params: any = { page, limit };
      
      if (parentFolderId) {
        params.parentFolderId = parentFolderId;
      }
      
      if (search) {
        params.search = search;
      }
      
      const response = await axios.get<FileResponse>(`${API_URL}/api/files`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при получении списка файлов:', error);
      throw error;
    }
  },
  
  /**
   * Создание новой папки
   */
  createFolder: async (name: string, parentFolderId?: string): Promise<FileItem> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const response = await axios.post<CreateFolderResponse>(
        `${API_URL}/api/files/folder`,
        { name, parentFolderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data.data.folder;
    } catch (error) {
      console.error('Ошибка при создании папки:', error);
      throw error;
    }
  },
  
  /**
   * Загрузка файла
   */
  uploadFile: async (file: File, parentFolderId?: string): Promise<FileItem> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      if (parentFolderId) {
        formData.append('parentFolderId', parentFolderId);
      }
      
      const response = await axios.post<UploadFileResponse>(
        `${API_URL}/api/files/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data.data.file;
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      throw error;
    }
  },
  
  /**
   * Получение URL для скачивания файла
   */
  getDownloadUrl: (fileId: string): string => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Не авторизован');
    }
    
    return `${API_URL}/api/files/download/${fileId}?token=${token}`;
  },
  
  /**
   * Скачивание файла на устройство
   */
  downloadFile: async (fileId: string, fileName: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      // Создаем уведомление о начале скачивания
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Скачивание файла', {
          body: `Начинается скачивание файла ${fileName}`,
          icon: '/download-icon.png'
        });
      }
      
      // Вместо использования window.open делаем запрос с помощью fetch API
      const response = await fetch(`${API_URL}/api/files/download/${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при скачивании: ${response.status}`);
      }
      
      // Получаем бинарные данные файла
      const blob = await response.blob();
      
      // Создаем URL для объекта Blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Создаем временную ссылку и имитируем клик для скачивания
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName; // Устанавливаем имя файла
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Удаляем ссылку из DOM и освобождаем URL объект
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      throw error;
    }
  },
  
  /**
   * Удаление файла или папки
   */
  deleteFile: async (fileId: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      await axios.delete(`${API_URL}/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Ошибка при удалении файла:', error);
      throw error;
    }
  },
  
  /**
   * Скачивание нескольких файлов
   */
  downloadMultipleFiles: async (fileIds: string[]): Promise<void> => {
    if (fileIds.length === 0) return;
    
    try {
      // Если выбран только один файл, используем обычное скачивание
      if (fileIds.length === 1) {
        const fileInfo = await fileService.getFileInfo(fileIds[0]);
        if (fileInfo) {
          return fileService.downloadFile(fileInfo._id, fileInfo.name);
        }
        return;
      }
      
      // Для нескольких файлов скачиваем их последовательно
      for (const fileId of fileIds) {
        const fileInfo = await fileService.getFileInfo(fileId);
        if (fileInfo && fileInfo.type === 'file') {
          // Небольшая задержка между скачиваниями, чтобы не перегружать браузер
          await new Promise(resolve => setTimeout(resolve, 500));
          await fileService.downloadFile(fileInfo._id, fileInfo.name);
        }
      }
      
      // Показываем уведомление о завершении скачивания
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Скачивание завершено', {
          body: `Скачано файлов: ${fileIds.length}`,
          icon: '/download-icon.png'
        });
      }
    } catch (error) {
      console.error('Ошибка при скачивании файлов:', error);
      throw error;
    }
  }
};

export default fileService; 
