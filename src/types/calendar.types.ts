export type CalendarEventScope = 'personal' | 'team';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  scope: CalendarEventScope;
  ownerUserId?: string | null;
  teamId?: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventListResponse {
  events: CalendarEvent[];
}

export interface CalendarEventResponse {
  event: CalendarEvent;
}

export interface CalendarEventsQuery {
  scope: CalendarEventScope;
  from: string;
  to: string;
}

export interface CalendarEventUpsertPayload {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  scope: CalendarEventScope;
}
