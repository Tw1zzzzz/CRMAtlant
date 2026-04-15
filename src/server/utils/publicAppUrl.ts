type RequestLike = {
  headers?: Record<string, unknown>;
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type ResolvePublicAppUrlOptions = {
  request?: RequestLike;
  baseUrl?: string;
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/g, '');

const readHeader = (request: RequestLike | undefined, name: string): string => {
  const fromGetter = normalizeText(request?.get?.(name));
  if (fromGetter) {
    return fromGetter;
  }

  const headerValue = request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
  if (Array.isArray(headerValue)) {
    return normalizeText(headerValue[0]);
  }

  return normalizeText(headerValue);
};

const normalizeProtocol = (value: string): string => {
  const normalized = normalizeText(value).split(',')[0].trim().replace(/:$/g, '').toLowerCase();
  return normalized === 'http' || normalized === 'https' ? normalized : '';
};

export const resolvePublicAppUrl = (options: ResolvePublicAppUrlOptions = {}): string => {
  const baseUrl = normalizeText(options.baseUrl || process.env.CLIENT_URL);
  if (baseUrl) {
    return trimTrailingSlashes(baseUrl);
  }

  const request = options.request;
  const origin = normalizeText(readHeader(request, 'origin'));
  if (/^https?:\/\//i.test(origin)) {
    return trimTrailingSlashes(origin);
  }

  const forwardedHost = normalizeText(readHeader(request, 'x-forwarded-host'));
  const host = forwardedHost || normalizeText(readHeader(request, 'host'));
  if (!host) {
    throw new Error('CLIENT_URL не настроен и публичный адрес приложения не определён');
  }

  if (/^https?:\/\//i.test(host)) {
    return trimTrailingSlashes(host);
  }

  const protocol =
    normalizeProtocol(readHeader(request, 'x-forwarded-proto')) ||
    normalizeProtocol(request?.protocol || '') ||
    (/(localhost|127\.0\.0\.1)/i.test(host) ? 'http' : 'https');

  return `${protocol}://${trimTrailingSlashes(host)}`;
};

export const buildPublicAppUrl = (
  path: string,
  options: ResolvePublicAppUrlOptions = {}
): string => {
  const baseUrl = resolvePublicAppUrl(options);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
