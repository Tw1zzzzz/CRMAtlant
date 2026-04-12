import { apiClient } from "@/utils/api/api-client";
import type {
  CalendarEvent,
  CalendarEventListResponse,
  CalendarEventResponse,
  CalendarEventScope,
  CalendarEventUpsertPayload,
} from "@/types";

export const CALENDAR_EVENTS_UPDATED_EVENT = "crm:calendar-events-updated";

export const notifyCalendarEventsUpdated = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CALENDAR_EVENTS_UPDATED_EVENT));
};

export const getCalendarEvents = async (params: {
  scope: CalendarEventScope;
  from: string;
  to: string;
}): Promise<CalendarEvent[]> => {
  const searchParams = new URLSearchParams({
    scope: params.scope,
    from: params.from,
    to: params.to,
  });

  const response = await apiClient.get<CalendarEventListResponse>(`/calendar/events?${searchParams.toString()}`);
  return Array.isArray(response.events) ? response.events : [];
};

export const createCalendarEvent = async (
  payload: CalendarEventUpsertPayload
): Promise<CalendarEvent> => {
  const response = await apiClient.post<CalendarEventResponse>('/calendar/events', payload);
  return response.event;
};

export const updateCalendarEvent = async (
  eventId: string,
  payload: CalendarEventUpsertPayload
): Promise<CalendarEvent> => {
  const response = await apiClient.put<CalendarEventResponse>(`/calendar/events/${eventId}`, payload);
  return response.event;
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  await apiClient.delete<{ message: string }>(`/calendar/events/${eventId}`);
};
