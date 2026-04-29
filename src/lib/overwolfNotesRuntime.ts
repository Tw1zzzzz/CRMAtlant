const NOTES_WINDOW_NAME = 'notes_overlay';
export const NOTES_ACTION_STORAGE_KEY = 'crmatlant-notes-overlay-action';
export const NOTES_CREATE_EVENT = 'crmatlant:notes-create';
export const NOTES_TOGGLE_EVENT = 'crmatlant:notes-toggle';

type OverwolfCallbackResult = {
  success?: boolean;
  status?: string;
  window?: {
    id?: string;
    name?: string;
  };
  window_state?: string;
};

type NotesWindowInfo = {
  id?: string;
  name?: string;
};

type HotkeyEvent = {
  name?: string;
};

const getOverwolfApi = () => (typeof window === 'undefined' ? undefined : (window as any).overwolf);

const isOverwolfRuntime = () => Boolean(getOverwolfApi()?.windows);

const getNotesWindow = () =>
  new Promise<NotesWindowInfo | null>((resolve) => {
    getOverwolfApi()?.windows?.obtainDeclaredWindow?.(NOTES_WINDOW_NAME, (result: OverwolfCallbackResult) => {
      resolve(result?.window || null);
    });
  });

const getWindowState = (windowId: string) =>
  new Promise<string | null>((resolve) => {
    const overwolfApi = getOverwolfApi();
    if (!overwolfApi?.windows?.getWindowState) {
      resolve(null);
      return;
    }

    overwolfApi.windows.getWindowState(windowId, (result: OverwolfCallbackResult) => {
      resolve(result?.window_state || null);
    });
  });

export const showNotesOverlay = async () => {
  const notesWindow = await getNotesWindow();
  const windowId = notesWindow?.id || notesWindow?.name || NOTES_WINDOW_NAME;
  getOverwolfApi()?.windows?.restore?.(windowId);
};

export const hideNotesOverlay = async () => {
  const notesWindow = await getNotesWindow();
  const windowId = notesWindow?.id || notesWindow?.name || NOTES_WINDOW_NAME;
  getOverwolfApi()?.windows?.hide?.(windowId);
};

const toggleNotesOverlay = async () => {
  const notesWindow = await getNotesWindow();
  const windowId = notesWindow?.id || notesWindow?.name || NOTES_WINDOW_NAME;
  const state = await getWindowState(windowId);

  if (state && state.toLowerCase() === 'normal') {
    getOverwolfApi()?.windows?.hide?.(windowId);
    return;
  }

  getOverwolfApi()?.windows?.restore?.(windowId);
};

export const requestNewOverlayNote = () => {
  const action = {
    type: 'new_note',
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };

  localStorage.setItem(NOTES_ACTION_STORAGE_KEY, JSON.stringify(action));
  window.dispatchEvent(new CustomEvent(NOTES_CREATE_EVENT, { detail: action }));
};

const handleHotkey = (event: HotkeyEvent) => {
  if (event.name === 'toggle_notes') {
    void toggleNotesOverlay();
    return;
  }

  if (event.name === 'new_note') {
    void showNotesOverlay();
    requestNewOverlayNote();
  }
};

const installBrowserFallbackHotkeys = () => {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.shiftKey) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'm') {
      event.preventDefault();
      requestNewOverlayNote();
      return;
    }

    if (key === 'n') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent(NOTES_TOGGLE_EVENT));
    }
  });
};

export const initializeOverwolfNotesRuntime = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isOverwolfRuntime()) {
    installBrowserFallbackHotkeys();
    return;
  }

  if (window.name === NOTES_WINDOW_NAME) {
    return;
  }

  getOverwolfApi()?.settings?.hotkeys?.onPressed?.addListener?.(handleHotkey);
};

initializeOverwolfNotesRuntime();
