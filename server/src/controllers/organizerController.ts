import { Request, Response } from 'express';
import { prisma } from '../app.js';
import { Organizer } from '../models/mongodb/index.js';
import { applyOrganizerSchema } from '../utils/validation.js';
import { handleZodError } from '../utils/handleZodError.js';

async function resolveUserName(userId: string): Promise<{ name: string; email: string }> {
  const student = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string; email: string }>>(
    `SELECT first_name, last_name, email FROM public.students WHERE id = $1`, userId,
  );
  if (student.length > 0) {
    return { name: `${student[0].first_name} ${student[0].last_name}`, email: student[0].email };
  }

  const emp = await prisma.$queryRawUnsafe<Array<{ first_name: string; last_name: string; email: string }>>(
    `SELECT first_name, last_name, email FROM public.employees WHERE id = $1`, userId,
  );
  if (emp.length > 0) {
    return { name: `${emp[0].first_name} ${emp[0].last_name}`, email: emp[0].email };
  }

  return { name: userId, email: '' };
}

export async function applyAsOrganizer(req: Request, res: Response) {
  try {
    const data = applyOrganizerSchema.parse(req.body);
    const userId = req.user!.userId;

    const isStudent = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.students WHERE id = $1`, userId,
    );
    const isEmployee = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.employees WHERE id = $1`, userId,
    );

    if (isStudent.length === 0 && isEmployee.length === 0) {
      res.status(404).json({ message: 'User not found in institutional database', code: 'NOT_FOUND' });
      return;
    }

    const existing = await Organizer.findOne({ userId });
    if (existing) {
      res.status(409).json({ message: 'You have already applied', code: 'DUPLICATE_APPLICATION' });
      return;
    }

    const { name, email } = await resolveUserName(userId);

    await Organizer.create({
      userId,
      name,
      email,
      type: data.organizerType,
      approvedByAdmin: false,
      isActive: true,
      profile: {
        department: data.department || undefined,
        specialization: data.specialization || undefined,
        semester: data.semester || undefined,
        studentGroup: data.studentGroup || undefined,
        adminArea: data.adminArea || undefined,
        positionTitle: data.positionTitle || undefined,
      },
    });

    res.status(201).json({ message: 'Application submitted for review' });
  } catch (e) {
    if (handleZodError(e, res)) return;
    console.error('Apply organizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export async function getOrganizer(req: Request, res: Response) {
  try {
    const organizer = await Organizer.findById(req.params.id).lean();
    if (!organizer) {
      res.status(404).json({ message: 'Organizer not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({
      id: organizer._id,
      userId: organizer.userId,
      employeeId: organizer.type === 'PROFESSOR' ? organizer.userId : null,
      studentId: organizer.type === 'STUDENT_LEADER' ? organizer.userId : null,
      name: organizer.name,
      email: organizer.email,
      organizerType: organizer.type,
      organizer_type: organizer.type,
      isActive: organizer.isActive,
      is_active: organizer.isActive,
      approvedByAdmin: organizer.approvedByAdmin,
      approved_by_admin: organizer.approvedByAdmin,
      department: organizer.profile?.department,
      specialization: organizer.profile?.specialization,
      semester: organizer.profile?.semester,
      studentGroup: organizer.profile?.studentGroup,
      student_group: organizer.profile?.studentGroup,
      adminArea: organizer.profile?.adminArea,
      admin_area: organizer.profile?.adminArea,
      positionTitle: organizer.profile?.positionTitle,
      position_title: organizer.profile?.positionTitle,
    });
  } catch (e) {
    console.error('GetOrganizer error:', e);
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
