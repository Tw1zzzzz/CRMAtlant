import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Lock, Move, Plus, Save, StickyNote, Trash2, Unlock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
 hideNotesOverlay,
 NOTES_ACTION_STORAGE_KEY,
 NOTES_CREATE_EVENT,
 NOTES_TOGGLE_EVENT,
} from '@/lib/overwolfNotesRuntime';
import { useOverlayNotes } from '@/hooks/useOverlayNotes';
import type { OverlayNote } from '@/types/overlayNote.types';

type DragState = {
 noteId: string;
 startX: number;
 startY: number;
 originX: number;
 originY: number;
};

const defaultNewNote = () => ({
 title: 'New note',
 content: '',
 position: { x: 24, y: 24 },
 size: { width: 420, height: 320 },
 opacity: 0.88,
 pinned: true,
});

const deriveTitle = (content: string) => {
 const firstLine = content.split('\n').find((line) => line.trim());
 return firstLine?.trim().slice(0, 120) || 'Untitled';
};

const clampPosition = (note: OverlayNote, x: number, y: number) => {
 const maxX = Math.max(window.innerWidth - 96, 0);
 const maxY = Math.max(window.innerHeight - 80, 0);

 return {
  x: Math.min(Math.max(x, 0), maxX),
  y: Math.min(Math.max(y, 0), maxY),
 };
};

const NotesOverlay = () => {
 const {
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
 } = useOverlayNotes();
 const panelRef = useRef<HTMLDivElement | null>(null);
 const dragStateRef = useRef<DragState | null>(null);
 const consumedActionRef = useRef<string | null>(sessionStorage.getItem('crmatlant-notes-last-action'));
 const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);
 const [isBrowserOverlayVisible, setIsBrowserOverlayVisible] = useState(true);

 useEffect(() => {
  document.body.classList.add('notes-overlay-body');
  return () => document.body.classList.remove('notes-overlay-body');
 }, []);

 const handleCreateNote = useCallback(() => {
  void createNote(defaultNewNote());
 }, [createNote]);

 const consumeAction = useCallback(
  (rawValue: string | null) => {
   if (!rawValue) {
    return;
   }

   try {
    const action = JSON.parse(rawValue) as { type?: string; nonce?: string; createdAt?: number };
    if (action.type !== 'new_note' || !action.nonce || consumedActionRef.current === action.nonce) {
     return;
    }

    if (typeof action.createdAt === 'number' && Date.now() - action.createdAt > 10000) {
     return;
    }

    consumedActionRef.current = action.nonce;
    sessionStorage.setItem('crmatlant-notes-last-action', action.nonce);
    handleCreateNote();
   } catch (actionError) {
    console.warn('[OverlayNotes] Failed to read note action:', actionError);
   }
  },
  [handleCreateNote]
 );

 useEffect(() => {
  consumeAction(localStorage.getItem(NOTES_ACTION_STORAGE_KEY));

  const handleStorage = (event: StorageEvent) => {
   if (event.key === NOTES_ACTION_STORAGE_KEY) {
    consumeAction(event.newValue);
   }
  };

  const handleCreate = () => {
   consumeAction(localStorage.getItem(NOTES_ACTION_STORAGE_KEY));
  };

  const handleToggle = () => {
   setIsBrowserOverlayVisible((current) => !current);
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(NOTES_CREATE_EVENT, handleCreate);
  window.addEventListener(NOTES_TOGGLE_EVENT, handleToggle);

  return () => {
   window.removeEventListener('storage', handleStorage);
   window.removeEventListener(NOTES_CREATE_EVENT, handleCreate);
   window.removeEventListener(NOTES_TOGGLE_EVENT, handleToggle);
  };
 }, [consumeAction]);

 useEffect(() => {
  if (!isLoading && notes.length === 0) {
   handleCreateNote();
  }
 }, [handleCreateNote, isLoading, notes.length]);

 const visiblePosition = useMemo(() => {
  if (!selectedNote) {
   return { x: 24, y: 24 };
  }

  return dragPreview || selectedNote.position;
 }, [dragPreview, selectedNote]);

 const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
  if (!selectedNote) {
   return;
  }

  event.currentTarget.setPointerCapture(event.pointerId);
  dragStateRef.current = {
   noteId: selectedNote.id,
   startX: event.clientX,
   startY: event.clientY,
   originX: selectedNote.position.x,
   originY: selectedNote.position.y,
  };
 };

 const continueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
  const dragState = dragStateRef.current;
  if (!dragState || !selectedNote) {
   return;
  }

  setDragPreview(
   clampPosition(
    selectedNote,
    dragState.originX + event.clientX - dragState.startX,
    dragState.originY + event.clientY - dragState.startY
   )
  );
 };

 const endDrag = () => {
  const dragState = dragStateRef.current;
  if (!dragState || !selectedNote || !dragPreview) {
   dragStateRef.current = null;
   setDragPreview(null);
   return;
  }

  updateNote(dragState.noteId, { position: dragPreview }, { immediate: true });
  dragStateRef.current = null;
  setDragPreview(null);
 };

 const persistPanelSize = () => {
  if (!selectedNote || !panelRef.current) {
   return;
  }

  const rect = panelRef.current.getBoundingClientRect();
  updateNote(
   selectedNote.id,
   {
    size: {
     width: Math.round(rect.width),
     height: Math.round(rect.height),
    },
   },
   { immediate: true }
  );
 };

 const handleContentChange = (content: string) => {
  if (!selectedNote) {
   return;
  }

  updateNote(selectedNote.id, {
   content,
   title: selectedNote.title ? selectedNote.title : deriveTitle(content),
  });
 };

 const handleClose = () => {
  void hideNotesOverlay();
 };

 if (isLoading) {
  return (
   <main className="notes-overlay-root">
    <div className="notes-overlay-loading">
     <Loader2 className="h-5 w-5 animate-spin" />
    </div>
   </main>
  );
 }

 if (!isBrowserOverlayVisible) {
  return <main className="notes-overlay-root" />;
 }

 return (
  <main className="notes-overlay-root">
   <aside className="notes-overlay-list">
    <div className="flex items-center justify-between gap-2">
     <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
      <StickyNote className="h-4 w-4 text-cyan-300" />
      Notes
     </div>
     <Button size="icon" className="h-8 w-8" onClick={handleCreateNote} title="Create note">
      <Plus className="h-4 w-4" />
     </Button>
    </div>

    <div className="mt-3 space-y-2">
     {notes.map((note) => (
      <button
       key={note.id}
       type="button"
       onClick={() => setSelectedNoteId(note.id)}
       className={cn(
        'w-full rounded-md border px-3 py-2 text-left text-sm transition',
        selectedNoteId === note.id
         ? 'border-cyan-300/70 bg-cyan-300/15 text-white'
         : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
       )}
      >
       <span className="block truncate font-medium">{note.title || deriveTitle(note.content)}</span>
       <span className="mt-0.5 block truncate text-xs text-slate-400">
        {note.content || 'Empty note'}
       </span>
      </button>
     ))}
    </div>

    {error && <p className="mt-3 text-xs text-red-200">{error}</p>}
   </aside>

   {selectedNote && (
    <section
     ref={panelRef}
     className="notes-overlay-panel"
     style={{
      left: visiblePosition.x,
      top: visiblePosition.y,
      width: selectedNote.size.width,
      height: selectedNote.size.height,
      opacity: selectedNote.opacity,
     }}
     onPointerUp={persistPanelSize}
     onMouseUp={persistPanelSize}
    >
     <div
      className="notes-overlay-panel-header"
      onPointerDown={startDrag}
      onPointerMove={continueDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
     >
      <div className="flex min-w-0 items-center gap-2">
       <Move className="h-4 w-4 shrink-0 text-slate-400" />
       <Input
        value={selectedNote.title || ''}
        placeholder="Name"
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => updateNote(selectedNote.id, { title: event.target.value })}
        className="h-8 border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
       />
      </div>

      <div className="flex items-center gap-1">
       <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-slate-200 hover:bg-white/10"
        title={selectedNote.pinned ? 'Unlink' : 'Pin'}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned }, { immediate: true })}
       >
        {selectedNote.pinned ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
       </Button>
       <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-red-100 hover:bg-red-500/20"
        title="Delete"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => void deleteNote(selectedNote.id)}
       >
        <Trash2 className="h-4 w-4" />
       </Button>
       <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-slate-200 hover:bg-white/10"
        title="Close overlay"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={handleClose}
       >
        <X className="h-4 w-4" />
       </Button>
      </div>
     </div>

     <Textarea
      value={selectedNote.content}
      onChange={(event) => handleContentChange(event.target.value)}
      placeholder="Game note..."
      className="notes-overlay-textarea"
     />

     <div className="notes-overlay-footer">
      <div className="flex w-36 items-center gap-2">
       <span className="text-xs text-slate-400">Opacity</span>
       <Slider
        min={25}
        max={100}
        step={5}
        value={[Math.round(selectedNote.opacity * 100)]}
        onValueChange={([value]) => updateNote(selectedNote.id, { opacity: value / 100 })}
       />
      </div>

      <div className="flex items-center gap-1 text-xs text-slate-400">
       {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
       {isSaving ? 'Saving' : 'Saved'}
      </div>
     </div>
    </section>
   )}
  </main>
 );
};

export default NotesOverlay;
