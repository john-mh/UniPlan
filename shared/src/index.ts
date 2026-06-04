export enum EventType {
  WORKSHOP = 'WORKSHOP',
  TALK = 'TALK',
  SPORTS_TOURNAMENT = 'SPORTS_TOURNAMENT',
  VOLUNTEERING = 'VOLUNTEERING',
  OTHER = 'OTHER',
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export enum OrganizerType {
  PROFESSOR = 'PROFESSOR',
  STUDENT_LEADER = 'STUDENT_LEADER',
  BIENESTAR_STAFF = 'BIENESTAR_STAFF',
}

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  CANCELLED = 'CANCELLED',
  ATTENDED = 'ATTENDED',
}

export enum UserRole {
  STUDENT = 'STUDENT',
  ORGANIZER = 'ORGANIZER',
  ADMIN = 'ADMIN',
}

export interface UserDto {
  id: string;
  username: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
}

export interface EventDto {
  id: string;
  uniqueCode: string;
  title: string;
  description: string;
  eventType: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxAttendees: number;
  currentRegistrations: number;
  organizerId: string;
  organizerName: string;
  status: EventStatus;
}

export interface EventDetailDto {
  [key: string]: unknown;
  eventId: string;
  eventType: EventType;
}

export interface WorkshopDetail extends EventDetailDto {
  eventType: EventType.WORKSHOP;
  materials: string[];
  prerequisiteSubjectCode?: string;
  prerequisiteSemester?: number;
}

export interface TalkDetail extends EventDetailDto {
  eventType: EventType.TALK;
  speakerName?: string;
  speakerProfile?: string;
  speakerAffiliation?: string;
  relatedLinks?: string[];
  extendedDescription?: string;
}

export interface SportsTournamentDetail extends EventDetailDto {
  eventType: EventType.SPORTS_TOURNAMENT;
  sportType: string;
  rules?: string;
  playersPerTeam?: number;
  tournamentStructure?: string;
}

export interface VolunteeringDetail extends EventDetailDto {
  eventType: EventType.VOLUNTEERING;
  cause?: string;
  hoursRequired: number;
  activities?: string[];
  meetingPoints?: string[];
  responsiblePersons?: string[];
}

export interface OtherEventDetail extends EventDetailDto {
  eventType: EventType.OTHER;
  additionalInfo: Record<string, unknown>;
}

export interface RegistrationDto {
  id: string;
  studentId: string;
  eventId: string;
  eventTitle?: string;
  eventType?: EventType;
  eventDate?: string;
  registrationDate: string;
  status: RegistrationStatus;
  cancellationDate?: string;
}

export interface OrganizerDto {
  id: string;
  employeeId?: string;
  studentId?: string;
  organizerType: OrganizerType;
  name: string;
  email: string;
  isActive: boolean;
  approvedByAdmin: boolean;
  department?: string;
  specialization?: string;
  semester?: number;
  studentGroup?: string;
  adminArea?: string;
  positionTitle?: string;
}

export interface EventStatsDto {
  eventId: string;
  eventTitle?: string;
  totalRegistered: number;
  totalCancelled: number;
  totalAttended: number;
  occupancyPercentage: number;
  demographics?: Record<string, unknown>;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  studentCode: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

export interface RegistrationByEventType {
  eventType: EventType;
  registered: number;
  cancelled: number;
  attended: number;
}

export interface EventsByStatus {
  status: EventStatus;
  count: number;
}

export interface DashboardDto {
  totalEvents: number;
  activeEvents: number;
  finishedEvents: number;
  totalRegistrations: number;
  totalCancellations: number;
  totalAttendees: number;
  totalUniqueStudents: number;
  totalOrganizers: number;
  avgOccupancy: number;
  registrationsByEventType: RegistrationByEventType[];
  eventsByStatus: EventsByStatus[];
}

export interface FacultyEventTypeCount {
  faculty: string;
  count: number;
}

export interface FacultyByEventTypeBreakdown {
  data: Record<string, FacultyEventTypeCount[]>;
}

export interface OrganizerPerformanceDto {
  organizerId: string;
  organizerName: string;
  eventsCreated: number;
  totalRegistrations: number;
  avgOccupancy: number;
  eventsByApprovedOrganizer: number;
  eventsByUnapprovedOrganizer: number;
}

export interface TrendPoint {
  month: string;
  registrations: number;
  events: number;
}

export interface TrendsDto {
  data: TrendPoint[];
}
