export type OverlayNote = {
  id: string;
  title?: string;
  content: string;
  gameId?: number | null;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  opacity: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OverlayNoteInput = Partial<Omit<OverlayNote, 'id' | 'createdAt' | 'updatedAt'>>;
