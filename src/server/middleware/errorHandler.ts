import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/apiError';

type ErrorPayload = {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // ApiError (our controlled errors)
  if (err instanceof ApiError) {
    const payload: ErrorPayload = {
      success: false,
      message: err.message,
      code: err.code,
      details: err.details
    };
    return res.status(err.status).json(payload);
  }

  // Mongoose validation errors
  if (err?.name === 'ValidationError') {
    const fieldErrors = Object.keys(err.errors || {}).reduce((acc: Record<string, unknown>, key: string) => {
      acc[key] = err.errors[key]?.message || 'Некорректное значение';
      return acc;
    }, {});

    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации данных',
      code: 'VALIDATION_ERROR',
      details: fieldErrors
    } satisfies ErrorPayload);
  }

  // Mongo duplicate key
  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Конфликт данных (дубликат)',
      code: 'DUPLICATE_KEY',
      details: err.keyValue || undefined
    } satisfies ErrorPayload);
  }

  // Fallback
  const message = typeof err?.message === 'string' ? err.message : 'Внутренняя ошибка сервера';
  return res.status(500).json({
    success: false,
    message,
    code: 'INTERNAL_SERVER_ERROR'
  } satisfies ErrorPayload);
}

