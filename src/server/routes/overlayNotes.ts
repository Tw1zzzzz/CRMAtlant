import express from 'express';
import OverlayNote from '../models/OverlayNote';
import { protect } from '../middleware/authMiddleware';
import { toObjectIdString } from '../utils/teamAccess';

const router = express.Router();

type AuthenticatedRequest = express.Request & {
 user: {
  _id: unknown;
 };
};

type OverlayNoteRecord = {
 _id: unknown;
 title?: string;
 content?: string;
 gameId?: number | null;
 position?: {
  x?: number;
  y?: number;
 };
 size?: {
  width?: number;
  height?: number;
 };
 opacity?: number;
 pinned?: boolean;
 createdAt: Date | string;
 updatedAt: Date | string;
};

const DEFAULT_POSITION = { x: 224, y: 12 };
const DEFAULT_SIZE = { width: 420, height: 360 };
const DEFAULT_OPACITY = 0.88;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const finiteOrFallback = (value: unknown, fallback: number) => {
 const numeric = Number(value);
 return Number.isFinite(numeric) ? numeric : fallback;
};

const toBodyRecord = (value: unknown): Record<string, unknown> => {
 return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
};

const normalizeText = (value: unknown, maxLength: number): string => {
 return typeof value === 'string' ? value.slice(0, maxLength) : '';
};

const normalizeOptionalGameId = (value: unknown): number | null => {
 if (value === null || value === undefined || value === '') {
  return null;
 }

 const numeric = Number(value);
 if (!Number.isInteger(numeric) || numeric < 0) {
  return null;
 }

 return numeric;
};

const normalizePoint = (value: unknown, fallback: typeof DEFAULT_POSITION) => {
 const raw = toBodyRecord(value);
 return {
  x: clamp(finiteOrFallback(raw.x, fallback.x), 0, 10000),
  y: clamp(finiteOrFallback(raw.y, fallback.y), 0, 10000),
 };
};

const normalizeSize = (value: unknown, fallback: typeof DEFAULT_SIZE) => {
 const raw = toBodyRecord(value);
 return {
  width: clamp(finiteOrFallback(raw.width, fallback.width), 260, 1400),
  height: clamp(finiteOrFallback(raw.height, fallback.height), 220, 1200),
 };
};

const normalizeOpacity = (value: unknown, fallback = DEFAULT_OPACITY) => {
 const numeric = Number(value);
 return Number.isFinite(numeric) ? clamp(numeric, 0.25, 1) : fallback;
};

const serializeNote = (note: OverlayNoteRecord) => ({
 id: toObjectIdString(note._id),
 title: note.title || '',
 content: note.content || '',
 gameId: note.gameId ?? null,
 position: {
  x: note.position?.x ?? DEFAULT_POSITION.x,
  y: note.position?.y ?? DEFAULT_POSITION.y,
 },
 size: {
  width: note.size?.width ?? DEFAULT_SIZE.width,
  height: note.size?.height ?? DEFAULT_SIZE.height,
 },
 opacity: note.opacity ?? DEFAULT_OPACITY,
 pinned: note.pinned ?? true,
 createdAt: new Date(note.createdAt).toISOString(),
 updatedAt: new Date(note.updatedAt).toISOString(),
});

const buildCreatePayload = (bodyValue: unknown, userId: unknown) => {
 const body = toBodyRecord(bodyValue);
 const content = normalizeText(body.content, 12000);
 const title = normalizeText(body.title, 120).trim();

 return {
  userId,
  title,
  content,
  gameId: normalizeOptionalGameId(body.gameId),
  position: normalizePoint(body.position, DEFAULT_POSITION),
  size: normalizeSize(body.size, DEFAULT_SIZE),
  opacity: normalizeOpacity(body.opacity),
  pinned: typeof body.pinned === 'boolean' ? body.pinned : true,
 };
};

const buildUpdatePayload = (bodyValue: unknown, current: OverlayNoteRecord) => {
 const body = toBodyRecord(bodyValue);
 const update: Record<string, unknown> = {};

 if ('title' in body) {
  update.title = normalizeText(body.title, 120).trim();
 }

 if ('content' in body) {
  update.content = normalizeText(body.content, 12000);
 }

 if ('gameId' in body) {
  update.gameId = normalizeOptionalGameId(body.gameId);
 }

 if ('position' in body) {
  update.position = normalizePoint(body.position, {
   x: current.position?.x ?? DEFAULT_POSITION.x,
   y: current.position?.y ?? DEFAULT_POSITION.y,
  });
 }

 if ('size' in body) {
  update.size = normalizeSize(body.size, {
   width: current.size?.width ?? DEFAULT_SIZE.width,
   height: current.size?.height ?? DEFAULT_SIZE.height,
  });
 }

 if ('opacity' in body) {
  update.opacity = normalizeOpacity(body.opacity, current.opacity ?? DEFAULT_OPACITY);
 }

 if ('pinned' in body) {
  update.pinned = Boolean(body.pinned);
 }

 return update;
};

router.use(protect);

router.get('/', async (req: AuthenticatedRequest, res) => {
 try {
  const filter: Record<string, unknown> = { userId: req.user._id };
  const gameId = normalizeOptionalGameId(req.query?.gameId);

  if (gameId !== null) {
   filter.gameId = gameId;
  }

  const notes = await OverlayNote.find(filter).sort({ updatedAt: -1 }).lean();
  return res.json({ notes: notes.map((note) => serializeNote(note as unknown as OverlayNoteRecord)) });
 } catch (error) {
  console.error('[OverlayNotes] Ошибка получения заметок:', error);
  return res.status(500).json({ message: 'Не удалось получить заметки' });
 }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
 try {
  const note = await OverlayNote.create(buildCreatePayload(req.body, req.user._id));
  return res.status(201).json({ note: serializeNote(note as unknown as OverlayNoteRecord) });
 } catch (error) {
  console.error('[OverlayNotes] Ошибка создания заметки:', error);
  return res.status(500).json({ message: 'Не удалось создать заметку' });
 }
});

router.patch('/:id', async (req: AuthenticatedRequest, res) => {
 try {
  const note = await OverlayNote.findOne({ _id: req.params.id, userId: req.user._id });

  if (!note) {
   return res.status(404).json({ message: 'Заметка не найдена' });
  }

  const update = buildUpdatePayload(req.body, note as unknown as OverlayNoteRecord);
  Object.assign(note, update);
  await note.save();

  return res.json({ note: serializeNote(note as unknown as OverlayNoteRecord) });
 } catch (error) {
  console.error('[OverlayNotes] Ошибка обновления заметки:', error);
  return res.status(500).json({ message: 'Не удалось обновить заметку' });
 }
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
 try {
  const note = await OverlayNote.findOne({ _id: req.params.id, userId: req.user._id });

  if (!note) {
   return res.status(404).json({ message: 'Заметка не найдена' });
  }

  await note.deleteOne();
  return res.json({ message: 'Заметка удалена' });
 } catch (error) {
  console.error('[OverlayNotes] Ошибка удаления заметки:', error);
  return res.status(500).json({ message: 'Не удалось удалить заметку' });
 }
});

export default router;
