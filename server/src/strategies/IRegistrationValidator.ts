export interface IRegistrationValidator {
  validate(studentId: string, eventId: string): Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
