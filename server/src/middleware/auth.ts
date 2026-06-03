import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
