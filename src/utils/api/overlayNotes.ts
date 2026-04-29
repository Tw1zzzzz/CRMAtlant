import { apiClient } from './api-client';
import type { OverlayNote, OverlayNoteInput } from '@/types/overlayNote.types';

type OverlayNotesResponse = {
  notes: OverlayNote[];
};

type OverlayNoteResponse = {
  note: OverlayNote;
};

export const overlayNotesApi = {
  getNotes: async (gameId?: number | null): Promise<OverlayNote[]> => {
    const params = gameId ? { gameId } : undefined;
    const response = await apiClient.get<OverlayNotesResponse>('/overlay-notes', { params });
    return response.notes || [];
  },

  createNote: async (payload: OverlayNoteInput = {}): Promise<OverlayNote> => {
    const response = await apiClient.post<OverlayNoteResponse>('/overlay-notes', payload);
    return response.note;
  },

  updateNote: async (id: string, payload: OverlayNoteInput): Promise<OverlayNote> => {
    const response = await apiClient.patch<OverlayNoteResponse>(`/overlay-notes/${id}`, payload);
    return response.note;
  },

  deleteNote: async (id: string): Promise<void> => {
    await apiClient.delete(`/overlay-notes/${id}`);
  },
};
