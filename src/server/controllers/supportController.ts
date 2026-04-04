import { Request, Response } from 'express';
import { sendSupportRequestEmail } from '../services/mailService';

export const submitSupportRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      category,
      subject,
      message,
      pageUrl,
      userAgent,
    } = req.body as {
      name?: string;
      email: string;
      category: string;
      subject: string;
      message: string;
      pageUrl?: string;
      userAgent?: string;
    };

    await sendSupportRequestEmail({
      name,
      email,
      category,
      subject,
      message,
      pageUrl,
      userAgent,
    });

    res.status(200).json({
      message: 'Заявка отправлена. Мы получили ваш запрос и свяжемся с вами по почте.',
    });
  } catch (error) {
    console.error('Ошибка отправки заявки в техподдержку:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Не удалось отправить заявку в техподдержку',
    });
  }
};
