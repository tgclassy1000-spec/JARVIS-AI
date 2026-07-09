import { z } from 'zod';

import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { ProductionHardeningService } from '../service/production-hardening-service';

export type ProductionController = Pick<
  ProductionHardeningService,
  | 'dashboard'
  | 'recoveryReport'
  | 'exportDiagnostics'
  | 'runSecurityAudit'
  | 'validateBackups'
  | 'setDebugMode'
  | 'recordRendererCrash'
  | 'safeRestart'
>;

const emptySchema = z.object({}).strict();
const diagnosticBundleSchema = z
  .object({
    includeLogs: z.boolean().optional(),
    includeCrashReports: z.boolean().optional(),
    includeSecurityAudit: z.boolean().optional(),
  })
  .strict();
const backupValidationSchema = z
  .object({
    databasePaths: z.array(z.string().trim().min(1)).min(1).max(20),
    backupDirectory: z.string().trim().min(1).optional(),
  })
  .strict();
const debugModeSchema = z.object({ enabled: z.boolean() }).strict();
const rendererCrashSchema = z
  .object({
    kind: z.enum(['renderer-crash', 'renderer-gone']),
    reason: z.string().trim().min(1).max(300),
    message: z.string().trim().max(1_000).optional(),
    exitCode: z.number().int().optional(),
    processType: z.string().trim().max(100).optional(),
  })
  .strict();
const safeRestartSchema = z.object({ confirm: z.literal(true) }).strict();

export function registerProductionEndpoints(
  router: IpcRouter,
  controller: ProductionController,
): void {
  router.register({
    channel: IPC_CHANNELS.productionDashboard,
    requestSchema: emptySchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.productionRecoveryReport,
    requestSchema: emptySchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: () => controller.recoveryReport(),
  });
  router.register({
    channel: IPC_CHANNELS.productionExportDiagnostics,
    requestSchema: diagnosticBundleSchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: (request) => controller.exportDiagnostics(request),
  });
  router.register({
    channel: IPC_CHANNELS.productionRunSecurityAudit,
    requestSchema: emptySchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: () => controller.runSecurityAudit(),
  });
  router.register({
    channel: IPC_CHANNELS.productionValidateBackups,
    requestSchema: backupValidationSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.validateBackups(request),
  });
  router.register({
    channel: IPC_CHANNELS.productionSetDebugMode,
    requestSchema: debugModeSchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: (request) => controller.setDebugMode(request.enabled),
  });
  router.register({
    channel: IPC_CHANNELS.productionRecordRendererCrash,
    requestSchema: rendererCrashSchema,
    handle: (request) => controller.recordRendererCrash(request),
  });
  router.register({
    channel: IPC_CHANNELS.productionSafeRestart,
    requestSchema: safeRestartSchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: () => controller.safeRestart(),
  });
}
