import ROUTES from "./routes";

const MOBILE_BREAKPOINT = 768;

export const getMobileHomePath = (role?: string): string =>
  role === "staff" ? `${ROUTES.MOBILE}/staff/team` : `${ROUTES.MOBILE}/player/today`;

export const isMobileViewport = (): boolean => {
  if (typeof window === "undefined") return false;

  return window.innerWidth < MOBILE_BREAKPOINT || window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
};

