import jwt from 'jsonwebtoken';

let _secret: string;
let _refreshSecret: string;

function getSecret(): string {
  if (!_secret) {
    _secret = process.env.JWT_SECRET!;
    if (!_secret) throw new Error('JWT_SECRET environment variable is required');
  }
  return _secret;
}

function getRefreshSecret(): string {
  if (!_refreshSecret) {
    _refreshSecret = process.env.JWT_REFRESH_SECRET!;
    if (!_refreshSecret) throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return _refreshSecret;
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getSecret(), { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, getRefreshSecret(), { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getSecret()) as { userId: string; role: string };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, getRefreshSecret()) as { userId: string };
}
