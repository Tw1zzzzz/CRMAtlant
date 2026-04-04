import express from 'express';
import CalendarEvent from '../models/CalendarEvent';
import { protect } from '../middleware/authMiddleware';
import { getScopedTeamId, isTeamStaffUser, toObjectIdString } from '../utils/teamAccess';

const router = express.Router();

type CalendarScope = 'personal' | 'team';
type AuthCalendarUser = {
  _id: unknown;
  role?: string;
  playerType?: string;
  teamId?: unknown;
};
type AuthenticatedRequest = express.Request & {
  user: AuthCalendarUser;
};
type CalendarEventRecord = {
  _id: unknown;
  title: string;
  description?: string;
  location?: string;
  startAt: Date | string;
  endAt: Date | string;
  allDay?: boolean;
  color?: string;
  scope: CalendarScope;
  ownerUserId?: unknown;
  teamId?: unknown;
  createdBy: unknown;
  updatedBy: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};
type CalendarEventPayload = {
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  color: string;
  scope: CalendarScope;
  createdBy: unknown;
  updatedBy: unknown;
  ownerUserId: unknown | null;
  teamId: unknown | null;
};

const DEFAULT_COLOR = '#3590FF';
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const normalizeScope = (value: unknown): CalendarScope | null => {
  return value === 'personal' || value === 'team' ? value : null;
};

const normalizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
};

const normalizeColor = (value: unknown): string => {
  if (typeof value === 'string' && COLOR_PATTERN.test(value.trim())) {
    return value.trim();
  }

  return DEFAULT_COLOR;
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toBodyRecord = (value: unknown): Record<string, unknown> => {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
};

const hasTeamCalendarAccess = (user: AuthCalendarUser): boolean => {
  return user?.playerType === 'team' && Boolean(getScopedTeamId(user));
};

const canManageTeamCalendar = (user: AuthCalendarUser): boolean => {
  return isTeamStaffUser(user) && Boolean(getScopedTeamId(user));
};

const serializeCalendarEvent = (event: CalendarEventRecord) => ({
  id: toObjectIdString(event._id),
  title: event.title,
  description: event.description || '',
  location: event.location || '',
  startAt: new Date(event.startAt).toISOString(),
  endAt: new Date(event.endAt).toISOString(),
  allDay: Boolean(event.allDay),
  color: event.color || DEFAULT_COLOR,
  scope: event.scope,
  ownerUserId: toObjectIdString(event.ownerUserId) || null,
  teamId: toObjectIdString(event.teamId) || null,
  createdBy: toObjectIdString(event.createdBy),
  updatedBy: toObjectIdString(event.updatedBy),
  createdAt: new Date(event.createdAt).toISOString(),
  updatedAt: new Date(event.updatedAt).toISOString(),
});

const buildEventPayload = (
  rawBody: unknown,
  scope: CalendarScope,
  user: AuthCalendarUser
): { error: string } | { payload: CalendarEventPayload } => {
  const body = toBodyRecord(rawBody);
  const title = normalizeText(body.title, 160);
  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);

  if (!title) {
    return { error: 'Укажите название события' };
  }

  if (!startAt || !endAt) {
    return { error: 'Укажите корректные дату и время события' };
  }

  if (startAt.getTime() >= endAt.getTime()) {
    return { error: 'Дата окончания должна быть позже даты начала' };
  }

  if (scope === 'team' && !canManageTeamCalendar(user)) {
    return { error: 'Только staff команды может изменять командный календарь' };
  }

  const payload: CalendarEventPayload = {
    title,
    description: normalizeText(body.description, 4000),
    location: normalizeText(body.location, 240),
    startAt,
    endAt,
    allDay: Boolean(body.allDay),
    color: normalizeColor(body.color),
    scope,
    createdBy: user._id,
    updatedBy: user._id,
    ownerUserId: null,
    teamId: null,
  };

  if (scope === 'personal') {
    payload.ownerUserId = user._id;
    payload.teamId = null;
  } else {
    payload.ownerUserId = null;
    payload.teamId = getScopedTeamId(user);
  }

  return { payload };
};

const canReadEvent = (user: AuthCalendarUser, event: CalendarEventRecord): boolean => {
  if (event.scope === 'personal') {
    return toObjectIdString(event.ownerUserId) === toObjectIdString(user?._id);
  }

  return hasTeamCalendarAccess(user) && toObjectIdString(event.teamId) === getScopedTeamId(user);
};

const canMutateEvent = (user: AuthCalendarUser, event: CalendarEventRecord): boolean => {
  if (event.scope === 'personal') {
    return toObjectIdString(event.ownerUserId) === toObjectIdString(user?._id);
  }

  return canManageTeamCalendar(user) && toObjectIdString(event.teamId) === getScopedTeamId(user);
};

router.use(protect);

router.get('/events', async (req: AuthenticatedRequest, res) => {
  try {
    const scope = normalizeScope(req.query?.scope);
    const from = parseDate(req.query?.from);
    const to = parseDate(req.query?.to);

    if (!scope) {
      return res.status(400).json({ message: 'Укажите корректный scope календаря' });
    }

    if (!from || !to || from.getTime() >= to.getTime()) {
      return res.status(400).json({ message: 'Укажите корректный диапазон дат' });
    }

    const filter: Record<string, unknown> = {
      scope,
      startAt: { $lt: to },
      endAt: { $gt: from },
    };

    if (scope === 'personal') {
      filter.ownerUserId = req.user._id;
    } else {
      const teamId = getScopedTeamId(req.user);

      if (!hasTeamCalendarAccess(req.user) || !teamId) {
        return res.status(403).json({ message: 'Командный календарь недоступен для этого профиля' });
      }

      filter.teamId = teamId;
    }

    const events = await CalendarEvent.find(filter).sort({ startAt: 1, createdAt: 1 }).lean();

    return res.json({ events: events.map(serializeCalendarEvent) });
  } catch (error) {
    console.error('[Calendar] Ошибка получения событий:', error);
    return res.status(500).json({ message: 'Не удалось получить события календаря' });
  }
});

router.post('/events', async (req: AuthenticatedRequest, res) => {
  try {
    const scope = normalizeScope(req.body?.scope);
    if (!scope) {
      return res.status(400).json({ message: 'Укажите корректный scope события' });
    }

    const result = buildEventPayload(req.body, scope, req.user);
    if ('error' in result) {
      return res.status(400).json({ message: result.error });
    }

    const event = await CalendarEvent.create(result.payload);
    return res.status(201).json({ event: serializeCalendarEvent(event) });
  } catch (error) {
    console.error('[Calendar] Ошибка создания события:', error);
    return res.status(500).json({ message: 'Не удалось создать событие' });
  }
});

router.put('/events/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);

    if (!event || !canReadEvent(req.user, event as unknown as CalendarEventRecord)) {
      return res.status(404).json({ message: 'Событие не найдено' });
    }

    if (!canMutateEvent(req.user, event as unknown as CalendarEventRecord)) {
      return res.status(403).json({ message: 'Нет прав на изменение этого события' });
    }

    const requestedScope = normalizeScope(req.body?.scope);
    if (!requestedScope || requestedScope !== event.scope) {
      return res.status(400).json({ message: 'Нельзя менять тип календаря у существующего события' });
    }

    const result = buildEventPayload(req.body, event.scope, req.user);
    if ('error' in result) {
      return res.status(400).json({ message: result.error });
    }

    event.title = result.payload.title as string;
    event.description = result.payload.description as string;
    event.location = result.payload.location as string;
    event.startAt = result.payload.startAt as Date;
    event.endAt = result.payload.endAt as Date;
    event.allDay = result.payload.allDay as boolean;
    event.color = result.payload.color as string;
    event.updatedBy = req.user._id;

    await event.save();

    return res.json({ event: serializeCalendarEvent(event) });
  } catch (error) {
    console.error('[Calendar] Ошибка обновления события:', error);
    return res.status(500).json({ message: 'Не удалось обновить событие' });
  }
});

router.delete('/events/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const event = await CalendarEvent.findById(req.params.id);

    if (!event || !canReadEvent(req.user, event as unknown as CalendarEventRecord)) {
      return res.status(404).json({ message: 'Событие не найдено' });
    }

    if (!canMutateEvent(req.user, event as unknown as CalendarEventRecord)) {
      return res.status(403).json({ message: 'Нет прав на удаление этого события' });
    }

    await event.deleteOne();

    return res.json({ message: 'Событие удалено' });
  } catch (error) {
    console.error('[Calendar] Ошибка удаления события:', error);
    return res.status(500).json({ message: 'Не удалось удалить событие' });
  }
});

export default router;
