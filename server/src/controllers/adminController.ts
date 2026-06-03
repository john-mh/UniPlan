import { Request, Response } from 'express';
import { Organizer } from '../models/mongodb/index.js';
import { prisma } from '../app.js';

export async function listOrganizers(req: Request, res: Response) {
  try {
    const filter = req.query.filter as string || 'pending';

    let query: Record<string, unknown> = {};
    if (filter === 'pending') {
      query = { approvedByAdmin: false, isActive: true };
    } else if (filter === 'approved') {
      query = { approvedByAdmin: true };
    }

    const organizers = await Organizer.find(query).sort({ createdAt: -1 }).lean();

    const mapped = organizers.map(o => ({
      id: o._id,
      userId: o.userId,
      employeeId: o.type === 'PROFESSOR' ? o.userId : null,
      studentId: o.type === 'STUDENT_LEADER' ? o.userId : null,
      name: o.name,
      email: o.email,
      organizerType: o.type,
      organizer_type: o.type,
      first_name: o.name.split(' ')[0] || '',
      last_name: o.name.split(' ').slice(1).join(' ') || '',
      isActive: o.isActive,
      is_active: o.isActive,
      approvedByAdmin: o.approvedByAdmin,
      approved_by_admin: o.approvedByAdmin,
      department: o.profile?.department,
      specialization: o.profile?.specialization,
      semester: o.profile?.semester,
      studentGroup: o.profile?.studentGroup,
      student_group: o.profile?.studentGroup,
      adminArea: o.profile?.adminArea,
      admin_area: o.profile?.adminArea,
      positionTitle: o.profile?.positionTitle,
      position_title: o.profile?.positionTitle,
    }));

    res.json({ data: mapped });
  } catch (e) {
    console.error('ListOrganizers error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function approveOrganizer(req: Request, res: Response) {
  try {
    const id = req.params.id;

    const org = await Organizer.findById(id);
    if (!org) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }

    const userId = org.userId;
    if (userId) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.users SET role = 'ORGANIZER' WHERE (student_id = $1 OR employee_id = $1) AND is_active = true AND role = 'STUDENT'`,
        userId,
      );
    }

    org.approvedByAdmin = true;
    await org.save();

    res.json({ message: 'Organizer approved' });
  } catch (e) {
    console.error('ApproveOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function rejectOrganizer(req: Request, res: Response) {
  try {
    const id = req.params.id;

    const org = await Organizer.findById(id);
    if (!org) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }

    org.isActive = false;
    org.approvedByAdmin = false;
    await org.save();

    res.json({ message: 'Organizer rejected' });
  } catch (e) {
    console.error('RejectOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
