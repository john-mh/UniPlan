import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pgPool } from '../app.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { registerSchema, loginSchema } from '../utils/validation.js';
import { handleZodError } from '../utils/handleZodError.js';

const q = (sql: string, params?: any[]) => pgPool.query(sql, params);

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);

    const existingStudent = await q('SELECT id FROM public.students WHERE id = $1', [data.studentCode]);

    if (!existingStudent || existingStudent.rows.length === 0) {
      res.status(404).json({ message: 'Student code not found in institutional database', code: 'STUDENT_NOT_FOUND' });
      return;
    }

    const hash = await bcrypt.hash(data.password, 12);
    await q(
      `INSERT INTO public.users (username, password_hash, role, student_id) VALUES ($1, $2, 'STUDENT', $3)`,
      [data.email, hash, data.studentCode],
    );
    res.status(201).json({ message: 'Registration successful' });
  } catch (e: any) {
    if (e?.code === '23505' || e?.code === 'P2002' || e?.code === 'P2010') {
      res.status(409).json({ message: 'User already registered', code: 'DUPLICATE_USER' });
      return;
    }
    if (handleZodError(e, res)) return;
    console.error('Registration error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const users = await q(
      'SELECT username, password_hash, role, student_id, employee_id FROM public.users WHERE username = $1 AND is_active = true',
      [data.username],
    );
    if (!users || users.rows.length === 0) {
      res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }
    const user = users.rows[0];
    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }
    const userId = user.student_id || user.employee_id || user.username;
    const accessToken = generateAccessToken(userId, user.role);
    const refreshToken = generateRefreshToken(userId);
    res.json({ accessToken, refreshToken, user: { id: userId, username: user.username, role: user.role } });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Login error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ message: 'Refresh token required', code: 'TOKEN_REQUIRED' });
    return;
  }
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const users = await q(
      `SELECT role FROM public.users WHERE (student_id = $1 OR employee_id = $1 OR username = $1) AND is_active = true`,
      [decoded.userId],
    );
    if (!users || users.rows.length === 0) {
      res.status(401).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }
    const accessToken = generateAccessToken(decoded.userId, users.rows[0].role);
    const newRefreshToken = generateRefreshToken(decoded.userId);
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (e: any) {
    console.error('Refresh error:', e);
    res.status(401).json({ message: 'Invalid refresh token', code: 'TOKEN_INVALID' });
  }
}

export async function logout(_req: Request, res: Response) {
  res.json({ message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const students = await q('SELECT id, first_name, last_name, email FROM public.students WHERE id = $1', [userId]);
    if (students && students.rows.length > 0) {
      const s = students.rows[0];
      res.json({ id: s.id, firstName: s.first_name, lastName: s.last_name, email: s.email, role: req.user!.role });
      return;
    }
    const employees = await q('SELECT id, first_name, last_name, email FROM public.employees WHERE id = $1', [userId]);
    if (employees && employees.rows.length > 0) {
      const e = employees.rows[0];
      res.json({ id: e.id, firstName: e.first_name, lastName: e.last_name, email: e.email, role: req.user!.role });
      return;
    }
    res.status(404).json({ message: 'User profile not found', code: 'NOT_FOUND' });
  } catch (e) {
    console.error('Me error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
