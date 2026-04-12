import { Request } from 'express';
import mongoose from 'mongoose';

// Определяем общий интерфейс для запросов с аутентификацией
export interface AuthRequest extends Request {
  user?: {
    _id: mongoose.Types.ObjectId | string;
    id: string;
    role: string;
    name: string;
    email: string;
    isSuperAdmin?: boolean;
    isActive?: boolean;
    playerType?: string;
    teamId?: mongoose.Types.ObjectId | string | null;
    teamName?: string;
    faceitAccountId?: string;
    passwordChangedAt?: Date | null;
  };
}
