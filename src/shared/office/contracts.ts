export const OFFICE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const OFFICE_PROJECT_STATUSES = [
  'planning',
  'active',
  'blocked',
  'completed',
  'archived',
] as const;
export const OFFICE_REMINDER_STATUSES = ['scheduled', 'snoozed', 'dismissed', 'completed'] as const;
export const OFFICE_RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export type OfficePriority = (typeof OFFICE_PRIORITIES)[number];
export type ProjectStatus = (typeof OFFICE_PROJECT_STATUSES)[number];
export type ReminderStatus = (typeof OFFICE_REMINDER_STATUSES)[number];
export type RecurrenceFrequency = (typeof OFFICE_RECURRENCE_FREQUENCIES)[number];

export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  readonly endsAt?: string;
}

export interface OfficeTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly completed: boolean;
  readonly priority: OfficePriority;
  readonly dueAt?: string;
  readonly labels: readonly string[];
  readonly category?: string;
  readonly projectId?: string;
  readonly recurrence?: RecurrenceRule;
  readonly progress: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface CreateTaskRequest {
  readonly title: string;
  readonly description?: string;
  readonly priority?: OfficePriority;
  readonly dueAt?: string;
  readonly labels?: readonly string[];
  readonly category?: string;
  readonly projectId?: string;
  readonly recurrence?: RecurrenceRule;
  readonly progress?: number;
}

export interface UpdateTaskRequest {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly priority?: OfficePriority;
  readonly dueAt?: string | null;
  readonly labels?: readonly string[];
  readonly category?: string | null;
  readonly projectId?: string | null;
  readonly recurrence?: RecurrenceRule | null;
  readonly progress?: number;
}

export interface TaskIdRequest {
  readonly id: string;
}

export interface OfficeNoteVersion {
  readonly id: string;
  readonly noteId: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
}

export interface OfficeNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly archived: boolean;
  readonly projectId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly versions: readonly OfficeNoteVersion[];
}

export interface CreateNoteRequest {
  readonly title: string;
  readonly content?: string;
  readonly tags?: readonly string[];
  readonly pinned?: boolean;
  readonly projectId?: string;
}

export interface UpdateNoteRequest {
  readonly id: string;
  readonly title?: string;
  readonly content?: string;
  readonly tags?: readonly string[];
  readonly pinned?: boolean;
  readonly archived?: boolean;
  readonly projectId?: string | null;
}

export interface NoteIdRequest {
  readonly id: string;
}

export interface ProjectGoal {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly completed: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfficeProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly priority: OfficePriority;
  readonly deadlineAt?: string;
  readonly progress: number;
  readonly goals: readonly ProjectGoal[];
  readonly taskCount: number;
  readonly noteCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProjectRequest {
  readonly name: string;
  readonly description?: string;
  readonly status?: ProjectStatus;
  readonly priority?: OfficePriority;
  readonly deadlineAt?: string;
  readonly progress?: number;
  readonly goals?: readonly string[];
}

export interface UpdateProjectRequest {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly status?: ProjectStatus;
  readonly priority?: OfficePriority;
  readonly deadlineAt?: string | null;
  readonly progress?: number;
  readonly goals?: readonly string[];
}

export interface ProjectIdRequest {
  readonly id: string;
}

export interface OfficeReminder {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly remindAt: string;
  readonly status: ReminderStatus;
  readonly recurrence?: RecurrenceRule;
  readonly taskId?: string;
  readonly projectId?: string;
  readonly snoozedUntil?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateReminderRequest {
  readonly title: string;
  readonly note?: string;
  readonly remindAt: string;
  readonly recurrence?: RecurrenceRule;
  readonly taskId?: string;
  readonly projectId?: string;
}

export interface UpdateReminderRequest {
  readonly id: string;
  readonly title?: string;
  readonly note?: string;
  readonly remindAt?: string;
  readonly recurrence?: RecurrenceRule | null;
  readonly taskId?: string | null;
  readonly projectId?: string | null;
}

export interface ReminderIdRequest {
  readonly id: string;
}

export interface SnoozeReminderRequest {
  readonly id: string;
  readonly until: string;
}

export interface OfficeDashboard {
  readonly todayTasks: readonly OfficeTask[];
  readonly upcomingDeadlines: readonly OfficeProject[];
  readonly pinnedNotes: readonly OfficeNote[];
  readonly recentConversations: readonly {
    readonly id: string;
    readonly title: string;
    readonly updatedAt: string;
    readonly preview: string;
  }[];
  readonly recentMemories: readonly {
    readonly id: string;
    readonly summary: string;
    readonly updatedAt: string;
  }[];
  readonly quickActions: readonly string[];
  readonly statistics: {
    readonly openTasks: number;
    readonly completedTasks: number;
    readonly activeProjects: number;
    readonly scheduledReminders: number;
    readonly pinnedNotes: number;
  };
}

export type OfficeSearchKind = 'task' | 'note' | 'project' | 'reminder' | 'conversation' | 'memory';

export interface OfficeSearchRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface OfficeSearchResult {
  readonly id: string;
  readonly kind: OfficeSearchKind;
  readonly title: string;
  readonly preview: string;
  readonly updatedAt: string;
  readonly score: number;
}

export type OfficeNaturalLanguageAction =
  | { readonly kind: 'create-task'; readonly task: OfficeTask }
  | { readonly kind: 'create-reminder'; readonly reminder: OfficeReminder }
  | { readonly kind: 'create-project'; readonly project: OfficeProject }
  | { readonly kind: 'create-note'; readonly note: OfficeNote };

export interface OfficeQuickAddRequest {
  readonly text: string;
  readonly now?: string;
}

export interface OfficeQuickAddResult {
  readonly action: OfficeNaturalLanguageAction;
  readonly interpretedAs: string;
}
