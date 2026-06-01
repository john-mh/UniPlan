import { Request, Response } from 'express';
import { prisma } from '../app.js';

export async function listOrganizers(req: Request, res: Response) {
  try {
    const filter = req.query.filter as string || 'pending';

    const organizers = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT o.*, 
         COALESCE(s.first_name, e.first_name) as first_name,
         COALESCE(s.last_name, e.last_name) as last_name,
         COALESCE(s.email, e.email) as email
       FROM public.uniplan_organizers o
       LEFT JOIN public.students s ON o.student_id = s.id
       LEFT JOIN public.employees e ON o.employee_id = e.id
       WHERE ($1 = 'all' OR ($1 = 'pending' AND o.approved_by_admin = false) OR ($1 = 'approved' AND o.approved_by_admin = true))
       ORDER BY o.created_at DESC`,
      filter
    );
    res.json({ data: organizers });
  } catch (e) {
    console.error('ListOrganizers error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function approveOrganizer(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const org = await prisma.$queryRawUnsafe<Array<{ student_id: string | null; employee_id: string | null }>>(
      `SELECT student_id, employee_id FROM public.uniplan_organizers WHERE id = $1`, id
    );
    if (!org || org.length === 0) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }

    const userId = org[0].student_id || org[0].employee_id;
    if (userId) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.users SET role = 'ORGANIZER' WHERE (student_id = $1 OR employee_id = $1) AND is_active = true`,
        userId
      );
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.uniplan_organizers SET approved_by_admin = true WHERE id = $1`, id
    );
    res.json({ message: 'Organizer approved' });
  } catch (e) {
    console.error('ApproveOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function rejectOrganizer(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    const org = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM public.uniplan_organizers WHERE id = $1`, id
    );
    if (!org || org.length === 0) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.uniplan_organizers SET is_active = false, approved_by_admin = false WHERE id = $1`, id
    );
    res.json({ message: 'Organizer rejected' });
  } catch (e) {
    console.error('RejectOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
