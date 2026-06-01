import { prisma } from '../app.js';
import { BaseValidator } from './BaseValidator.js';
import { ValidationResult } from './IRegistrationValidator.js';
import { EventDetail } from '../models/mongodb/EventDetail.js';
import { EventType } from '@uniplan/shared';

export class WorkshopValidator extends BaseValidator {
  protected async additionalChecks(studentId: string, eventId: number): Promise<ValidationResult> {
    // Get the prerequisite from MongoDB
    const detail = await EventDetail.findOne({ eventId, eventType: EventType.WORKSHOP }).lean() as any;
    const prereqSubject = detail?.prerequisiteSubjectCode;
    const prereqSemester = detail?.prerequisiteSemester;

    if (prereqSubject) {
      // Check if student has completed or is enrolled in the prerequisite subject
      const enrollments = await prisma.$queryRawUnsafe<Array<{ subject_code: string }>>(
        `SELECT g.subject_code FROM public.enrollments e
         JOIN public.groups g ON e.nrc = g.nrc
         WHERE e.student_id = $1 AND g.subject_code = $2 AND e.status IN ('Active', 'Passed')`,
        studentId, prereqSubject
      );
      if (!enrollments || enrollments.length === 0) {
        return { valid: false, reason: `Prerequisite course ${prereqSubject} not completed` };
      }
    }

    if (prereqSemester) {
      const studentSemester = await this.getStudentSemester(studentId);
      if (studentSemester < prereqSemester) {
        return { valid: false, reason: `Requires semester ${prereqSemester} or higher (you are in semester ${studentSemester})` };
      }
    }

    return { valid: true };
  }

  private async getStudentSemester(studentId: string): Promise<number> {
    const result = await prisma.$queryRawUnsafe<Array<{ semester: string }>>(
      `SELECT DISTINCT g.semester FROM public.enrollments e
       JOIN public.groups g ON e.nrc = g.nrc
       WHERE e.student_id = $1 AND e.status = 'Active'
       ORDER BY g.semester DESC LIMIT 1`,
      studentId
    );
    if (result && result.length > 0) {
      const sem = result[0].semester;
      const match = sem.match(/(\d+)-(\d+)/);
      if (match) return parseInt(match[1]);
    }
    return 1;
  }
}
