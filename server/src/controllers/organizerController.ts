import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { applyOrganizerSchema } from '../utils/validation.js';
import { handleZodError } from '../utils/handleZodError.js';

export async function applyAsOrganizer(req: Request, res: Response) {
  try {
    const data = applyOrganizerSchema.parse(req.body);
    const userId = req.user!.userId;

    const isStudent = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.students WHERE id = $1`, userId
    );
    const isEmployee = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.employees WHERE id = $1`, userId
    );

    if (isStudent.length === 0 && isEmployee.length === 0) {
      res.status(404).json({ message: 'User not found in institutional database', code: 'NOT_FOUND' });
      return;
    }

    // Check if already applied
    const existing = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM public.uniplan_organizers WHERE employee_id = $1 OR student_id = $1`, userId
    );
    if (existing && existing.length > 0) {
      res.status(409).json({ message: 'You have already applied', code: 'DUPLICATE_APPLICATION' });
      return;
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.uniplan_organizers (employee_id, student_id, organizer_type, department, specialization, semester, student_group, admin_area, position_title, approved_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)`,
      isEmployee.length > 0 ? userId : null,
      isStudent.length > 0 ? userId : null,
      data.organizerType,
      data.department || null,
      data.specialization || null,
      data.semester || null,
      data.studentGroup || null,
      data.adminArea || null,
      data.positionTitle || null
    );

    res.status(201).json({ message: 'Application submitted for review' });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Apply organizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getOrganizer(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const organizer = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT o.* FROM public.uniplan_organizers o WHERE o.id = $1`, id
    );
    if (!organizer || organizer.length === 0) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(organizer[0]);
  } catch (e) {
    console.error('GetOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
