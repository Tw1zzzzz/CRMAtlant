import ROUTES from "./routes";

export const AUTH_SESSION_EXPIRED_EVENT = "crmatlant:auth-session-expired";

export const welcomeSessionExpiredPath = `${ROUTES.WELCOME}?session=expired`;

export function redirectToWelcomeAfterSessionExpired() {
  if (window.location.pathname + window.location.search !== welcomeSessionExpiredPath) {
    window.history.replaceState(window.history.state, "", welcomeSessionExpiredPath);
    const navigationEvent = typeof PopStateEvent === "function"
      ? new PopStateEvent("popstate", { state: window.history.state })
      : new Event("popstate");
    window.dispatchEvent(navigationEvent);
  }

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}
