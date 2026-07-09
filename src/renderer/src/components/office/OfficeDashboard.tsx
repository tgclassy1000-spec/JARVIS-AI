import { useEffect, useMemo, useState } from 'react';

import type {
  OfficeDashboard as OfficeDashboardData,
  OfficeNote,
  OfficeProject,
  OfficeReminder,
  OfficeSearchResult,
  OfficeTask,
} from '../../../../shared/office/contracts';
import { HudPanel } from '../HudPanel';
import { MarkdownMessage } from '../chat/MarkdownMessage';

type OfficeTab = 'dashboard' | 'tasks' | 'projects' | 'notes' | 'reminders' | 'search';

interface OfficeState {
  readonly dashboard: OfficeDashboardData | null;
  readonly tasks: readonly OfficeTask[];
  readonly projects: readonly OfficeProject[];
  readonly notes: readonly OfficeNote[];
  readonly reminders: readonly OfficeReminder[];
}

const emptyState: OfficeState = {
  dashboard: null,
  tasks: [],
  projects: [],
  notes: [],
  reminders: [],
};

function formatDate(value?: string): string {
  if (!value) return 'Unscheduled';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function priorityClass(priority: string): string {
  return `office-chip office-chip--${priority}`;
}

export function OfficeDashboard() {
  const [tab, setTab] = useState<OfficeTab>('dashboard');
  const [state, setState] = useState<OfficeState>(emptyState);
  const [quickAdd, setQuickAdd] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [projectName, setProjectName] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly OfficeSearchResult[]>([]);
  const [status, setStatus] = useState('Office systems ready.');
  const [loading, setLoading] = useState(false);

  const refresh = async (): Promise<void> => {
    const [dashboard, tasks, projects, notes, reminders] = await Promise.all([
      window.jarvis.office.dashboard(),
      window.jarvis.office.tasks.list(),
      window.jarvis.office.projects.list(),
      window.jarvis.office.notes.list(),
      window.jarvis.office.reminders.list(),
    ]);
    setState({ dashboard, tasks, projects, notes, reminders });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Office refresh failed.');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const timer = window.setTimeout(() => {
      if (!query) {
        setSearchResults([]);
        return;
      }
      void window.jarvis.office
        .search({ query, limit: 25 })
        .then(setSearchResults)
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : 'Search failed.');
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const overdueTasks = useMemo(
    () =>
      state.tasks.filter((task) => !task.completed && task.dueAt && task.dueAt < task.createdAt),
    [state.tasks],
  );

  const runAction = async (action: () => Promise<void>, message: string): Promise<void> => {
    setLoading(true);
    try {
      await action();
      await refresh();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Office action failed.');
    } finally {
      setLoading(false);
    }
  };

  const submitQuickAdd = () =>
    runAction(async () => {
      if (!quickAdd.trim()) return;
      const result = await window.jarvis.office.quickAdd({
        text: quickAdd,
        now: new Date().toISOString(),
      });
      setQuickAdd('');
      setStatus(result.interpretedAs);
    }, 'Natural-language command completed.');

  return (
    <main className="office-shell">
      <HudPanel title="Office Command Deck" eyebrow="MODULE 06">
        <div className="office-quick-add">
          <input
            aria-label="Natural language office command"
            placeholder="Try “Remind me at 5 PM” or “Create project Apollo”"
            value={quickAdd}
            onChange={(event) => setQuickAdd(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitQuickAdd();
            }}
          />
          <button type="button" disabled={loading} onClick={() => void submitQuickAdd()}>
            Quick Add
          </button>
        </div>
        <p className="office-status" role="status">
          {loading ? 'Synchronizing office matrix…' : status}
        </p>
      </HudPanel>

      <nav className="office-tabs" aria-label="Office sections">
        {(['dashboard', 'tasks', 'projects', 'notes', 'reminders', 'search'] as const).map(
          (item) => (
            <button
              className={tab === item ? 'active' : ''}
              key={item}
              type="button"
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ),
        )}
      </nav>

      {tab === 'dashboard' && (
        <section className="office-grid">
          <HudPanel title="Daily Dashboard" eyebrow="TODAY">
            <div className="office-stat-grid">
              <span>Open Tasks {state.dashboard?.statistics.openTasks ?? 0}</span>
              <span>Done {state.dashboard?.statistics.completedTasks ?? 0}</span>
              <span>Projects {state.dashboard?.statistics.activeProjects ?? 0}</span>
              <span>Reminders {state.dashboard?.statistics.scheduledReminders ?? 0}</span>
            </div>
            <h4>Today’s tasks</h4>
            <OfficeTaskList tasks={state.dashboard?.todayTasks ?? []} onComplete={runAction} />
          </HudPanel>
          <HudPanel title="Signal Priority" eyebrow="FOCUS">
            <p>{overdueTasks.length} overdue task(s) detected.</p>
            <h4>Pinned notes</h4>
            <OfficeNoteList notes={state.dashboard?.pinnedNotes ?? []} compact />
            <h4>Recent conversations</h4>
            <ul className="office-list">
              {(state.dashboard?.recentConversations ?? []).map((conversation) => (
                <li key={conversation.id}>
                  <strong>{conversation.title}</strong>
                  <span>{conversation.preview || 'No preview'}</span>
                </li>
              ))}
            </ul>
          </HudPanel>
        </section>
      )}

      {tab === 'tasks' && (
        <section className="office-grid">
          <HudPanel title="Task Manager" eyebrow="EXECUTION">
            <div className="office-inline-form">
              <input
                aria-label="Task title"
                placeholder="Create task"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  void runAction(async () => {
                    if (!taskTitle.trim()) return;
                    await window.jarvis.office.tasks.create({
                      title: taskTitle,
                      priority: 'medium',
                    });
                    setTaskTitle('');
                  }, 'Task created.')
                }
              >
                Add Task
              </button>
            </div>
            <OfficeTaskList tasks={state.tasks} onComplete={runAction} />
          </HudPanel>
        </section>
      )}

      {tab === 'projects' && (
        <section className="office-grid">
          <HudPanel title="Project Manager" eyebrow="MISSIONS">
            <div className="office-inline-form">
              <input
                aria-label="Project name"
                placeholder="Create project"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  void runAction(async () => {
                    if (!projectName.trim()) return;
                    await window.jarvis.office.projects.create({ name: projectName });
                    setProjectName('');
                  }, 'Project created.')
                }
              >
                Add Project
              </button>
            </div>
            <OfficeProjectList projects={state.projects} />
          </HudPanel>
        </section>
      )}

      {tab === 'notes' && (
        <section className="office-grid">
          <HudPanel title="Markdown Notes" eyebrow="KNOWLEDGE">
            <div className="office-note-form">
              <input
                aria-label="Note title"
                placeholder="Note title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
              />
              <textarea
                aria-label="Note content"
                placeholder="- [ ] Checklist&#10;&#10;```ts&#10;console.log('JARVIS')&#10;```"
                value={noteContent}
                onChange={(event) => setNoteContent(event.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  void runAction(async () => {
                    if (!noteTitle.trim()) return;
                    await window.jarvis.office.notes.create({
                      title: noteTitle,
                      content: noteContent,
                      pinned: true,
                    });
                    setNoteTitle('');
                    setNoteContent('');
                  }, 'Markdown note saved.')
                }
              >
                Save Note
              </button>
            </div>
          </HudPanel>
          <HudPanel title="Note Vault" eyebrow="PINNED + ARCHIVE">
            <OfficeNoteList notes={state.notes} />
          </HudPanel>
        </section>
      )}

      {tab === 'reminders' && (
        <section className="office-grid">
          <HudPanel title="Reminder Queue" eyebrow="TEMPORAL">
            <div className="office-inline-form">
              <input
                aria-label="Reminder title"
                placeholder="Reminder"
                value={reminderTitle}
                onChange={(event) => setReminderTitle(event.target.value)}
              />
              <button
                type="button"
                onClick={() =>
                  void runAction(async () => {
                    if (!reminderTitle.trim()) return;
                    const remindAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                    await window.jarvis.office.reminders.create({ title: reminderTitle, remindAt });
                    setReminderTitle('');
                  }, 'Reminder scheduled.')
                }
              >
                Add +1h
              </button>
            </div>
            <OfficeReminderList reminders={state.reminders} onAction={runAction} />
          </HudPanel>
        </section>
      )}

      {tab === 'search' && (
        <section className="office-grid">
          <HudPanel title="Global Search" eyebrow="TASKS · NOTES · PROJECTS · MEMORY · CHAT">
            <input
              className="office-search"
              aria-label="Global office search"
              placeholder="Search the JARVIS workspace"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <ul className="office-list">
              {searchResults.map((result) => (
                <li key={`${result.kind}-${result.id}`}>
                  <strong>
                    {result.kind.toUpperCase()} // {result.title}
                  </strong>
                  <span>{result.preview || 'No preview'}</span>
                </li>
              ))}
            </ul>
          </HudPanel>
        </section>
      )}
    </main>
  );
}

function OfficeTaskList({
  tasks,
  onComplete,
}: {
  readonly tasks: readonly OfficeTask[];
  readonly onComplete: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  if (tasks.length === 0) return <p className="office-empty">No tasks in this vector.</p>;
  return (
    <ul className="office-list">
      {tasks.map((task) => (
        <li key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <span>{task.description || task.category || 'No description'}</span>
          </div>
          <span className={priorityClass(task.priority)}>{task.priority}</span>
          <span>{formatDate(task.dueAt)}</span>
          <progress max={100} value={task.progress} />
          {!task.completed && (
            <button
              type="button"
              onClick={() =>
                void onComplete(
                  async () => window.jarvis.office.tasks.complete(task.id).then(() => undefined),
                  'Task completed.',
                )
              }
            >
              Complete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function OfficeProjectList({ projects }: { readonly projects: readonly OfficeProject[] }) {
  if (projects.length === 0) return <p className="office-empty">No projects launched yet.</p>;
  return (
    <ul className="office-list">
      {projects.map((project) => (
        <li key={project.id}>
          <div>
            <strong>{project.name}</strong>
            <span>{project.description || `${project.goals.length} goal(s)`}</span>
          </div>
          <span className={priorityClass(project.priority)}>{project.priority}</span>
          <span>{project.status}</span>
          <progress max={100} value={project.progress} />
        </li>
      ))}
    </ul>
  );
}

function OfficeNoteList({
  notes,
  compact = false,
}: {
  readonly notes: readonly OfficeNote[];
  readonly compact?: boolean;
}) {
  if (notes.length === 0) return <p className="office-empty">No notes captured.</p>;
  return (
    <ul className="office-list office-list--notes">
      {notes.map((note) => (
        <li key={note.id}>
          <strong>
            {note.pinned ? '★ ' : ''}
            {note.title}
          </strong>
          {!compact && <MarkdownMessage content={note.content || '_Empty note_'} />}
          <span>{note.tags.join(', ') || `${note.versions.length} version(s)`}</span>
        </li>
      ))}
    </ul>
  );
}

function OfficeReminderList({
  reminders,
  onAction,
}: {
  readonly reminders: readonly OfficeReminder[];
  readonly onAction: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  if (reminders.length === 0) return <p className="office-empty">Reminder queue clear.</p>;
  return (
    <ul className="office-list">
      {reminders.map((reminder) => (
        <li key={reminder.id}>
          <div>
            <strong>{reminder.title}</strong>
            <span>{reminder.note || formatDate(reminder.remindAt)}</span>
          </div>
          <span>{reminder.status}</span>
          <button
            type="button"
            onClick={() =>
              void onAction(
                async () =>
                  window.jarvis.office.reminders
                    .snooze({
                      id: reminder.id,
                      until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                    })
                    .then(() => undefined),
                'Reminder snoozed.',
              )
            }
          >
            Snooze
          </button>
          <button
            type="button"
            onClick={() =>
              void onAction(
                async () =>
                  window.jarvis.office.reminders.dismiss(reminder.id).then(() => undefined),
                'Reminder dismissed.',
              )
            }
          >
            Dismiss
          </button>
        </li>
      ))}
    </ul>
  );
}
