import { Request } from 'express';
import mongoose from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Определяем общий интерфейс для запросов с аутентификацией
export interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId | string;
    id: string;
    role: string;
    name: string;
    email: string;
    faceitAccountId?: string;
  };
}
