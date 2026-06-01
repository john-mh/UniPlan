export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface IRegistrationValidator {
  validate(studentId: string, eventId: number): Promise<ValidationResult>;
}
