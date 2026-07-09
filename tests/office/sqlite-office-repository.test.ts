// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteOfficeRepository } from '../../src/main/office/persistence/sqlite-office-repository';

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'jarvis-office-'));
  let tick = 0;
  const repository = new SqliteOfficeRepository(
    join(directory, 'office.sqlite'),
    () => new Date(`2026-01-0${Math.min(tick + 1, 9)}T09:00:00.000Z`),
    () => `id-${++tick}`,
  );
  return {
    repository,
    cleanup: () => {
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('SqliteOfficeRepository', () => {
  it('runs versioned migrations and supports task CRUD', () => {
    const { repository, cleanup } = createRepository();
    try {
      expect(repository.schemaVersion()).toBe(1);
      const task = repository.createTask({
        title: 'Finish invoice',
        priority: 'high',
        labels: ['finance'],
        dueAt: '2026-01-02T09:00:00.000Z',
        progress: 25,
      });
      expect(task).toMatchObject({ title: 'Finish invoice', priority: 'high', progress: 25 });
      const updated = repository.updateTask({
        id: task.id,
        title: 'Finish invoice draft',
        progress: 60,
      });
      expect(updated).toMatchObject({ title: 'Finish invoice draft', progress: 60 });
      const completed = repository.completeTask(task.id);
      expect(completed).toMatchObject({ completed: true, progress: 100 });
      expect(repository.deleteTask(task.id)).toBe(true);
      expect(repository.listTasks()).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('stores markdown notes with version history, pin and archive state', () => {
    const { repository, cleanup } = createRepository();
    try {
      const note = repository.createNote({
        title: 'Daily work',
        content: '- [ ] Review\n\n```ts\nconst ok = true;\n```',
        tags: ['daily'],
        pinned: true,
      });
      const updated = repository.updateNote({
        id: note.id,
        content: '| A | B |\n| - | - |\n| 1 | 2 |',
        archived: true,
      });
      expect(updated?.versions).toHaveLength(2);
      expect(updated).toMatchObject({ pinned: true, archived: true });
      expect(repository.search('daily', 10).some((result) => result.kind === 'note')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('manages projects, goals, reminders, dashboard data and search', () => {
    const { repository, cleanup } = createRepository();
    try {
      const project = repository.createProject({
        name: 'Apollo',
        goals: ['Launch dashboard', 'Validate tests'],
        deadlineAt: '2026-01-05T09:00:00.000Z',
        priority: 'critical',
      });
      expect(repository.createProject({ name: 'Defaults' })).toMatchObject({
        status: 'active',
        priority: 'medium',
        progress: 0,
      });
      const task = repository.createTask({
        title: 'Dashboard review',
        projectId: project.id,
        dueAt: '2026-01-01T12:00:00.000Z',
      });
      repository.createNote({
        title: 'Pinned',
        content: 'Apollo notes',
        projectId: project.id,
        pinned: true,
      });
      const reminder = repository.createReminder({
        title: 'Meeting',
        note: 'Apollo reminder',
        remindAt: '2026-01-01T10:00:00.000Z',
        taskId: task.id,
        recurrence: { frequency: 'daily', interval: 1 },
      });
      expect(repository.listProjects()[0]).toMatchObject({ taskCount: 1, noteCount: 1 });
      expect(
        repository.snoozeReminder({ id: reminder.id, until: '2026-01-01T10:10:00.000Z' }),
      ).toMatchObject({
        status: 'snoozed',
      });
      expect(repository.dismissReminder(reminder.id)).toMatchObject({ status: 'dismissed' });
      expect(
        repository.updateReminder({
          id: reminder.id,
          recurrence: null,
          taskId: null,
          projectId: project.id,
        }),
      ).toMatchObject({ recurrence: undefined, taskId: undefined, projectId: project.id });
      expect(
        repository.updateTask({ id: task.id, recurrence: null, projectId: null }),
      ).toMatchObject({
        recurrence: undefined,
        projectId: undefined,
      });
      expect(
        repository.updateNote({ id: repository.listNotes()[0]!.id, projectId: null }),
      ).toMatchObject({
        projectId: undefined,
      });
      const dashboard = repository.dashboard(new Date('2026-01-01T08:00:00.000Z'));
      expect(dashboard.todayTasks).toHaveLength(1);
      expect(dashboard.pinnedNotes).toHaveLength(1);
      expect(dashboard.statistics.activeProjects).toBe(2);
      expect(repository.search('Apollo', 10).map((result) => result.kind)).toContain('project');
      expect(repository.search('reminder', 10).map((result) => result.kind)).toContain('reminder');
      expect(repository.search('not-present', 10)).toHaveLength(0);
      expect(repository.deleteProject(project.id)).toBe(true);
    } finally {
      cleanup();
    }
  });
});
