import axios from 'axios';
import { handleApiError } from '../apiUtils';

// Базовый URL для API
const baseUrl = '';

/**
 * Получение всех карточек игроков с пагинацией
 * @param page - номер страницы
 * @param limit - количество элементов на странице
 * @returns Promise с результатом запроса
 */
export const getAllPlayerCards = async (page: number = 1, limit: number = 50) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.get(`${baseUrl}/api/player-cards?page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при получении списка карточек игроков');
    return { success: false, error: errorMsg };
  }
};

/**
 * Получение карточки игрока по ID игрока
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const getPlayerCard = async (userId: string) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.get(`${baseUrl}/api/player-cards/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при получении карточки игрока');
    return { success: false, error: errorMsg };
  }
};

/**
 * Создание карточки игрока
 * @param userId - ID игрока для которого создается карточка
 * @returns Promise с результатом запроса
 */
export const createPlayerCard = async (userId: string) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.post(`${baseUrl}/api/player-cards`, { userId }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при создании карточки игрока');
    return { success: false, error: errorMsg };
  }
};

/**
 * Обновление контактов игрока
 * @param contacts - Объект с контактами
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const updatePlayerContacts = async (
  contacts: {
    vk: string;
    telegram: string;
    faceit: string;
    steam: string;
    nickname: string;
  },
  userId: string
) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.put(`${baseUrl}/api/player-cards/${userId}/contacts`, {
      contacts
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при обновлении контактов');
    return { success: false, error: errorMsg };
  }
};

/**
 * Обновление коммуникативной линии игрока
 * @param communicationLine - Текст коммуникативной линии
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const updateCommunicationLine = async (
  communicationLine: string,
  userId: string
) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.put(`${baseUrl}/api/player-cards/${userId}/communication-line`, {
      communicationLine
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при обновлении коммуникативной линии');
    return { success: false, error: errorMsg };
  }
};

/**
 * Загрузка изображения Roadmap
 * @param file - Файл изображения
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const uploadRoadmap = async (file: File, userId: string) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const formData = new FormData();
    formData.append("roadmap", file);
    
    const response = await axios.post(
      `${baseUrl}/api/player-cards/${userId}/roadmap`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при загрузке Roadmap');
    return { success: false, error: errorMsg };
  }
};

/**
 * Загрузка изображения Mindmap
 * @param file - Файл изображения
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const uploadMindmap = async (file: File, userId: string) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const formData = new FormData();
    formData.append("mindmap", file);
    
    const response = await axios.post(
      `${baseUrl}/api/player-cards/${userId}/mindmap`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при загрузке Mindmap');
    return { success: false, error: errorMsg };
  }
}; 

/**
 * Удаление карточки игрока
 * @param userId - ID игрока
 * @returns Promise с результатом запроса
 */
export const deletePlayerCard = async (userId: string): Promise<{success: boolean, data?: any, error?: string}> => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.delete(`${baseUrl}/api/player-cards/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при удалении карточки игрока');
    return { success: false, error: errorMsg };
  }
};

/**
 * Привязка игрока к существующей карточке
 * @param cardId - ID карточки
 * @param newUserId - ID игрока для привязки
 * @returns Promise с результатом запроса
 */
export const attachPlayerToCard = async (cardId: string, newUserId: string) => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('Требуется авторизация');
    }
    
    const response = await axios.put(`${baseUrl}/api/player-cards/attach-player`, {
      cardId,
      newUserId
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const errorMsg = handleApiError(error, 'Ошибка при привязке игрока к карточке');
    return { success: false, error: errorMsg };
  }
};
