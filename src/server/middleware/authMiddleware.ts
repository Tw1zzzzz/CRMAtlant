import { protect, isStaff } from './auth';

export { protect, isStaff };

export const authorize = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Не авторизован' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    next();
  };
};
