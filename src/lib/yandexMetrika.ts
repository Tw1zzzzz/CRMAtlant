const DEFAULT_YANDEX_METRIKA_ID = 109531131;

const parseCounterId = (value: string | undefined): number => {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_YANDEX_METRIKA_ID;
};

export const YANDEX_METRIKA_ID = parseCounterId(import.meta.env.VITE_YANDEX_METRIKA_ID);
export const isYandexMetrikaEnabled = import.meta.env.MODE === "production" && YANDEX_METRIKA_ID > 0;

type YandexMetrikaMethod = "init" | "hit";
type YandexMetrikaOptions = Record<string, unknown>;
type YandexMetrikaQueue = ((counterId: number, method: YandexMetrikaMethod, ...params: unknown[]) => void) & {
  a?: unknown[];
  l?: number;
};

declare global {
  interface Window {
    ym?: YandexMetrikaQueue;
  }
}

export const initYandexMetrika = (): void => {
  if (!isYandexMetrikaEnabled || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (document.querySelector(`script[data-yandex-metrika="${YANDEX_METRIKA_ID}"]`)) {
    return;
  }

  if (!window.ym) {
    window.ym = function ymQueue(...args: unknown[]) {
      window.ym!.a = window.ym!.a || [];
      window.ym!.a.push(args);
    } as YandexMetrikaQueue;
  }

  window.ym.l = Date.now();

  const script = document.createElement("script");
  const firstScript = document.getElementsByTagName("script")[0];

  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  script.dataset.yandexMetrika = String(YANDEX_METRIKA_ID);
  firstScript.parentNode?.insertBefore(script, firstScript);

  window.ym(YANDEX_METRIKA_ID, "init", {
    accurateTrackBounce: true,
    clickmap: true,
    trackLinks: true,
    webvisor: true,
  });
};

export const trackYandexPageView = (url: string, options?: YandexMetrikaOptions): void => {
  if (!isYandexMetrikaEnabled || typeof window === "undefined" || typeof window.ym !== "function") {
    return;
  }

  window.ym(YANDEX_METRIKA_ID, "hit", url, options);
};
