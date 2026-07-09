// @vitest-environment node

import type {
  DocumentAnalysisResult,
  DocumentDashboard,
  DocumentDetail,
} from '../../src/shared/documents/contracts';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { PERMISSIONS } from '../../src/shared/platform/permissions';
import type { DocumentController } from '../../src/main/documents/ipc/document.endpoints';
import { registerDocumentEndpoints } from '../../src/main/documents/ipc/document.endpoints';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import { createPermissionMiddleware } from '../../src/main/platform/ipc/middleware';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';

class Adapter implements IpcMainAdapter {
  public readonly handlers = new Map<string, IpcListener>();
  public handle(channel: string, listener: IpcListener): void {
    this.handlers.set(channel, listener);
  }
  public removeHandler(channel: string): void {
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

const timestamp = '2026-01-01T00:00:00.000Z';
const detail: DocumentDetail = {
  id: 'doc',
  title: 'Report.md',
  format: 'markdown',
  sourcePath: 'Report.md',
  byteSize: 100,
  mimeType: 'text/markdown',
  checksum: 'abc',
  wordCount: 10,
  characterCount: 50,
  tableCount: 0,
  ocrStatus: 'not-required',
  pinned: false,
  importedAt: timestamp,
  updatedAt: timestamp,
  preview: 'Report preview',
  chunks: [
    { id: 'chunk', documentId: 'doc', index: 0, content: 'Report preview', tokenEstimate: 4 },
  ],
  tables: [],
};
const dashboard: DocumentDashboard = {
  recent: [detail],
  pinned: [],
  totalDocuments: 1,
  totalChunks: 1,
  supportedFormats: [
    'pdf',
    'docx',
    'xlsx',
    'pptx',
    'txt',
    'markdown',
    'csv',
    'json',
    'png',
    'jpg',
    'jpeg',
    'webp',
  ],
};
const analysis: DocumentAnalysisResult = {
  documentId: 'doc',
  action: 'summarize',
  content: 'Summary',
  generatedAt: timestamp,
};

function createRouter(decision: 'allow' | 'deny' = 'allow') {
  const adapter = new Adapter();
  const router = new IpcRouter(
    adapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [
      createPermissionMiddleware(
        new PermissionManager(new Map([[PERMISSIONS.fileAccess, decision]])),
      ),
    ],
    logger,
    () => 'document-request',
  );
  return { adapter, router };
}

describe('document IPC endpoints', () => {
  it('registers allow-listed endpoints and handles document contracts', async () => {
    const { adapter, router } = createRouter();
    const controller: DocumentController = {
      dashboard: vi.fn(() => dashboard),
      importDocument: vi.fn(() => Promise.resolve(detail)),
      list: vi.fn(() => [detail]),
      get: vi.fn(() => detail),
      pin: vi.fn(() => ({ ...detail, pinned: true })),
      delete: vi.fn(),
      search: vi.fn(() => [
        { document: detail, chunk: detail.chunks[0], score: 1, match: 'Report' },
      ]),
      analyze: vi.fn(() => Promise.resolve(analysis)),
    };
    registerDocumentEndpoints(router, controller);
    expect(adapter.handlers.size).toBe(8);
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.(event, payload);
    await expect(invoke(IPC_CHANNELS.documentDashboard, {})).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.documentImport, { filePath: 'A:\\report.md', pin: true }),
    ).resolves.toMatchObject({ ok: true });
    await invoke(IPC_CHANNELS.documentList, {});
    await invoke(IPC_CHANNELS.documentGet, { documentId: 'doc' });
    await invoke(IPC_CHANNELS.documentPin, { documentId: 'doc', pinned: true });
    await invoke(IPC_CHANNELS.documentSearch, { query: 'report', formats: ['markdown'] });
    await invoke(IPC_CHANNELS.documentAnalyze, { documentId: 'doc', action: 'summarize' });
    await invoke(IPC_CHANNELS.documentDelete, { documentId: 'doc' });
    expect(controller.delete).toHaveBeenCalledWith('doc');
    router.dispose();
  });

  it('rejects invalid payloads and denied file access', async () => {
    const { adapter, router } = createRouter('deny');
    registerDocumentEndpoints(router, {
      dashboard: vi.fn(() => dashboard),
      importDocument: vi.fn(() => Promise.resolve(detail)),
      list: vi.fn(() => []),
      get: vi.fn(() => detail),
      pin: vi.fn(() => detail),
      delete: vi.fn(),
      search: vi.fn(() => []),
      analyze: vi.fn(() => Promise.resolve(analysis)),
    });
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    await expect(
      adapter.handlers.get(IPC_CHANNELS.documentSearch)?.(event, { query: '' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    await expect(
      adapter.handlers.get(IPC_CHANNELS.documentImport)?.(event, { filePath: 'A:\\report.md' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});
