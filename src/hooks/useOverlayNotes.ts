import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { overlayNotesApi } from '@/utils/api/overlayNotes';
import type { OverlayNote, OverlayNoteInput } from '@/types/overlayNote.types';

const AUTOSAVE_DELAY_MS = 650;

const createDraftNote = (payload: OverlayNoteInput = {}): OverlayNote => {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    title: payload.title || '',
    content: payload.content || '',
    gameId: payload.gameId ?? null,
    position: payload.position || { x: 24, y: 24 },
    size: payload.size || { width: 420, height: 320 },
    opacity: payload.opacity ?? 0.88,
    pinned: payload.pinned ?? true,
    createdAt: now,
    updatedAt: now,
  };
};

export const useOverlayNotes = () => {
  const [notes, setNotes] = useState<OverlayNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingUpdatesRef = useRef<Record<string, OverlayNoteInput>>({});
  const timersRef = useRef<Record<string, number>>({});

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || notes[0] || null,
    [notes, selectedNoteId]
  );

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedNotes = await overlayNotesApi.getNotes();
      setNotes(loadedNotes);
      setSelectedNoteId((current) => current || loadedNotes[0]?.id || null);
    } catch (loadError) {
      console.error('[OverlayNotes] Failed to load notes:', loadError);
      setError('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const flushNoteUpdate = useCallback(async (noteId: string) => {
    const payload = pendingUpdatesRef.current[noteId];
    if (!payload || noteId.startsWith('draft-')) {
      return;
    }

    delete pendingUpdatesRef.current[noteId];
    setIsSaving(true);

    try {
      const savedNote = await overlayNotesApi.updateNote(noteId, payload);
      setNotes((current) => current.map((note) => (note.id === noteId ? savedNote : note)));
      setError(null);
    } catch (saveError) {
      console.error('[OverlayNotes] Failed to save note:', saveError);
      pendingUpdatesRef.current[noteId] = {
        ...(pendingUpdatesRef.current[noteId] || {}),
        ...payload,
      };
      setError('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, []);

  const queueNoteUpdate = useCallback(
    (noteId: string, payload: OverlayNoteInput) => {
      pendingUpdatesRef.current[noteId] = {
        ...(pendingUpdatesRef.current[noteId] || {}),
        ...payload,
      };

      if (timersRef.current[noteId]) {
        window.clearTimeout(timersRef.current[noteId]);
      }

      timersRef.current[noteId] = window.setTimeout(() => {
        void flushNoteUpdate(noteId);
      }, AUTOSAVE_DELAY_MS);
    },
    [flushNoteUpdate]
  );

  const createNote = useCallback(async (payload: OverlayNoteInput = {}) => {
    const draft = createDraftNote(payload);
    setNotes((current) => [draft, ...current]);
    setSelectedNoteId(draft.id);
    setIsSaving(true);

    try {
      const savedNote = await overlayNotesApi.createNote(payload);
      setNotes((current) => current.map((note) => (note.id === draft.id ? savedNote : note)));
      setSelectedNoteId(savedNote.id);
      setError(null);
      return savedNote;
    } catch (createError) {
      console.error('[OverlayNotes] Failed to create note:', createError);
      setNotes((current) => current.filter((note) => note.id !== draft.id));
      setSelectedNoteId((current) => (current === draft.id ? null : current));
      setError('Failed to create note');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateNote = useCallback(
    (noteId: string, payload: OverlayNoteInput, options?: { immediate?: boolean }) => {
      setNotes((current) =>
        current.map((note) =>
          note.id === noteId
            ? {
                ...note,
                ...payload,
                updatedAt: new Date().toISOString(),
              }
            : note
        )
      );

      if (options?.immediate) {
        pendingUpdatesRef.current[noteId] = {
          ...(pendingUpdatesRef.current[noteId] || {}),
          ...payload,
        };
        if (timersRef.current[noteId]) {
          window.clearTimeout(timersRef.current[noteId]);
        }
        void flushNoteUpdate(noteId);
        return;
      }

      queueNoteUpdate(noteId, payload);
    },
    [flushNoteUpdate, queueNoteUpdate]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const previousNotes = notes;
      setNotes((current) => current.filter((note) => note.id !== noteId));
      setSelectedNoteId((current) => (current === noteId ? previousNotes.find((note) => note.id !== noteId)?.id || null : current));

      if (noteId.startsWith('draft-')) {
        return;
      }

      try {
        await overlayNotesApi.deleteNote(noteId);
        setError(null);
      } catch (deleteError) {
        console.error('[OverlayNotes] Failed to delete note:', deleteError);
        setNotes(previousNotes);
        setSelectedNoteId(noteId);
        setError('Failed to delete note');
      }
    },
    [notes]
  );

  return {
    notes,
    selectedNote,
    selectedNoteId,
    isLoading,
    isSaving,
    error,
    setSelectedNoteId,
    createNote,
    updateNote,
    deleteNote,
    reloadNotes: loadNotes,
  };
};
