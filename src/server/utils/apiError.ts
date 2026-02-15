export type ApiErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: ApiErrorDetails;

  constructor(status: number, message: string, code?: string, details?: ApiErrorDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ApiErrorDetails) =>
  new ApiError(400, message, 'BAD_REQUEST', details);

export const unauthorized = (message: string = 'Не авторизован') =>
  new ApiError(401, message, 'UNAUTHORIZED');

export const forbidden = (message: string = 'Доступ запрещен') =>
  new ApiError(403, message, 'FORBIDDEN');

export const notFound = (message: string = 'Ресурс не найден') =>
  new ApiError(404, message, 'NOT_FOUND');

