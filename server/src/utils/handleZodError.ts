import { Response } from 'express';

export function handleZodError(err: unknown, res: Response): boolean {
  if ((err as any)?.name === 'ZodError') {
    res.status(400).json({
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: (err as any).errors,
    });
    return true;
  }
  return false;
}
