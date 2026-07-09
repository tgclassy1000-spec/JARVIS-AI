// @vitest-environment node

import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { registerMemoryEndpoints } from '../../src/main/memory/ipc/memory.endpoints';
import { MemoryManager } from '../../src/main/memory/manager/memory-manager';
import { SqliteMemoryRepository } from '../../src/main/memory/persistence/sqlite-memory-repository';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';

class Adapter implements IpcMainAdapter {
  readonly handlers = new Map<string, IpcListener>();
  handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}
const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

describe('memory IPC', () => {
  it('registers and validates the complete allow-listed memory surface', async () => {
    const adapter = new Adapter();
    const router = new IpcRouter(
      adapter,
      ALLOWED_IPC_CHANNELS,
      ALLOWED_IPC_EVENTS,
      [],
      logger,
      () => 'request',
    );
    const manager = new MemoryManager(new SqliteMemoryRepository(':memory:'));
    registerMemoryEndpoints(router, manager);
    const call = (channel: string, request: unknown) =>
      adapter.handlers.get(channel)!({ senderUrl: 'file:///app', send: vi.fn() }, request);

    const saved = await call(IPC_CHANNELS.memorySave, {
      kind: 'preference',
      content: 'Prefers dark mode',
      tags: ['ui'],
    });
    expect(saved).toMatchObject({ ok: true, data: { kind: 'preference' } });
    const id = (saved as { data: { id: string } }).data.id;
    expect(await call(IPC_CHANNELS.memoryList, {})).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ id })],
    });
    expect(await call(IPC_CHANNELS.memorySearch, { query: 'dark', mode: 'hybrid' })).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ score: 1 })],
    });
    expect(await call(IPC_CHANNELS.memoryUpdate, { id, pinned: true })).toMatchObject({
      ok: true,
      data: { pinned: true },
    });
    expect(await call(IPC_CHANNELS.memorySettings, {})).toMatchObject({
      ok: true,
      data: { enabled: true },
    });
    expect(await call(IPC_CHANNELS.memorySetEnabled, { enabled: false })).toMatchObject({
      ok: true,
      data: { enabled: false },
    });
    await call(IPC_CHANNELS.memorySetEnabled, { enabled: true });
    const backup = await call(IPC_CHANNELS.memoryBackup, {});
    const archive = (backup as { data: unknown }).data;
    expect(await call(IPC_CHANNELS.memoryExport, {})).toMatchObject({
      ok: true,
      data: { mimeType: 'application/json' },
    });
    expect(await call(IPC_CHANNELS.memoryMerge, {})).toMatchObject({
      ok: true,
      data: { merged: 0 },
    });
    expect(await call(IPC_CHANNELS.memoryDelete, { id })).toMatchObject({
      ok: true,
      data: { deleted: true },
    });
    expect(await call(IPC_CHANNELS.memoryRestore, { archive, replace: true })).toMatchObject({
      ok: true,
      data: { restored: 1 },
    });
    expect(await call(IPC_CHANNELS.memoryDeleteAll, { confirm: true })).toMatchObject({
      ok: true,
      data: { deleted: 1 },
    });
    expect(await call(IPC_CHANNELS.memorySave, { kind: 'invalid', content: 'x' })).toMatchObject({
      ok: false,
    });
    manager.close();
    router.dispose();
  });
});
