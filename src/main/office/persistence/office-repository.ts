import type {
  CreateNoteRequest,
  CreateProjectRequest,
  CreateReminderRequest,
  CreateTaskRequest,
  OfficeDashboard,
  OfficeNote,
  OfficeProject,
  OfficeReminder,
  OfficeSearchResult,
  OfficeTask,
  SnoozeReminderRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateReminderRequest,
  UpdateTaskRequest,
} from '../../../shared/office/contracts';

export interface OfficeRepository {
  schemaVersion(): number;
  listTasks(): readonly OfficeTask[];
  createTask(request: CreateTaskRequest): OfficeTask;
  updateTask(request: UpdateTaskRequest): OfficeTask | undefined;
  completeTask(id: string): OfficeTask | undefined;
  deleteTask(id: string): boolean;
  listNotes(): readonly OfficeNote[];
  createNote(request: CreateNoteRequest): OfficeNote;
  updateNote(request: UpdateNoteRequest): OfficeNote | undefined;
  deleteNote(id: string): boolean;
  listProjects(): readonly OfficeProject[];
  createProject(request: CreateProjectRequest): OfficeProject;
  updateProject(request: UpdateProjectRequest): OfficeProject | undefined;
  deleteProject(id: string): boolean;
  listReminders(): readonly OfficeReminder[];
  createReminder(request: CreateReminderRequest): OfficeReminder;
  updateReminder(request: UpdateReminderRequest): OfficeReminder | undefined;
  snoozeReminder(request: SnoozeReminderRequest): OfficeReminder | undefined;
  dismissReminder(id: string): OfficeReminder | undefined;
  deleteReminder(id: string): boolean;
  dashboard(now: Date): OfficeDashboard;
  search(query: string, limit: number): readonly OfficeSearchResult[];
  close(): void;
}
