import { z } from 'zod';

import { DOCUMENT_ANALYSIS_ACTIONS, DOCUMENT_FORMATS } from '../../../shared/documents/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { DocumentService } from '../service/document-service';

export type DocumentController = Pick<
  DocumentService,
  'dashboard' | 'importDocument' | 'list' | 'get' | 'pin' | 'delete' | 'search' | 'analyze'
>;

const emptySchema = z.object({}).strict();
const documentIdSchema = z.string().trim().min(1).max(128);
const documentIdRequestSchema = z.object({ documentId: documentIdSchema }).strict();
const importSchema = z
  .object({
    filePath: z.string().trim().min(1).max(2_000),
    pin: z.boolean().optional(),
  })
  .strict();
const pinSchema = z
  .object({
    documentId: documentIdSchema,
    pinned: z.boolean(),
  })
  .strict();
const searchSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    mode: z.enum(['keyword', 'semantic', 'hybrid']).optional(),
    formats: z.array(z.enum(DOCUMENT_FORMATS)).max(DOCUMENT_FORMATS.length).optional(),
    pinnedOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();
const analysisSchema = z
  .object({
    documentId: documentIdSchema,
    action: z.enum(DOCUMENT_ANALYSIS_ACTIONS),
    question: z.string().trim().min(1).max(1_000).optional(),
    targetLanguage: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

export function registerDocumentEndpoints(router: IpcRouter, controller: DocumentController): void {
  router.register({
    channel: IPC_CHANNELS.documentDashboard,
    requestSchema: emptySchema,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.documentImport,
    requestSchema: importSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.importDocument(request.filePath, request.pin),
  });
  router.register({
    channel: IPC_CHANNELS.documentList,
    requestSchema: emptySchema,
    handle: () => controller.list(),
  });
  router.register({
    channel: IPC_CHANNELS.documentGet,
    requestSchema: documentIdRequestSchema,
    handle: (request) => controller.get(request.documentId),
  });
  router.register({
    channel: IPC_CHANNELS.documentPin,
    requestSchema: pinSchema,
    handle: (request) => controller.pin(request.documentId, request.pinned),
  });
  router.register({
    channel: IPC_CHANNELS.documentDelete,
    requestSchema: documentIdRequestSchema,
    handle: (request) => {
      controller.delete(request.documentId);
      return { deleted: true };
    },
  });
  router.register({
    channel: IPC_CHANNELS.documentSearch,
    requestSchema: searchSchema,
    handle: (request) => controller.search(request),
  });
  router.register({
    channel: IPC_CHANNELS.documentAnalyze,
    requestSchema: analysisSchema,
    handle: (request) => controller.analyze(request),
  });
}
