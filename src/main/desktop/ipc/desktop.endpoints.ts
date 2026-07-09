import { z } from 'zod';

import {
  ALLOWED_APPLICATION_IDS,
  FILE_OPERATION_KINDS,
  NOTIFICATION_KINDS,
  SCREENSHOT_KINDS,
} from '../../../shared/desktop/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { DesktopAutomationService } from '../service/desktop-automation-service';

export type DesktopController = Pick<
  DesktopAutomationService,
  | 'dashboard'
  | 'openApplication'
  | 'closeApplication'
  | 'restartApplication'
  | 'bringApplicationToFront'
  | 'openFile'
  | 'openFolder'
  | 'browseFolder'
  | 'operateFile'
  | 'readClipboard'
  | 'writeClipboard'
  | 'sendNotification'
  | 'captureScreenshot'
  | 'systemInformation'
  | 'routeTool'
  | 'auditLogs'
>;

const emptySchema = z.object({}).strict();
const applicationActionSchema = z
  .object({
    appId: z.enum(ALLOWED_APPLICATION_IDS),
    confirm: z.literal(true).optional(),
  })
  .strict();
const pathSchema = z.object({ path: z.string().trim().min(1).max(1_000) }).strict();
const fileOperationSchema = z
  .object({
    kind: z.enum(FILE_OPERATION_KINDS),
    sourcePath: z.string().trim().min(1).max(1_000),
    destinationPath: z.string().trim().min(1).max(1_000).optional(),
    confirm: z.literal(true).optional(),
  })
  .strict();
const clipboardWriteSchema = z.object({ text: z.string().max(100_000) }).strict();
const notificationSchema = z
  .object({
    kind: z.enum(NOTIFICATION_KINDS),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(500),
    progressPercent: z.number().min(0).max(100).optional(),
  })
  .strict();
const screenshotRegionSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1).max(8_000),
    height: z.number().int().min(1).max(8_000),
  })
  .strict();
const screenshotSchema = z
  .object({
    kind: z.enum(SCREENSHOT_KINDS),
    region: screenshotRegionSchema.optional(),
  })
  .strict();
const routeSchema = z.object({ prompt: z.string().trim().min(1).max(500) }).strict();

export function registerDesktopEndpoints(router: IpcRouter, controller: DesktopController): void {
  router.register({
    channel: IPC_CHANNELS.desktopDashboard,
    requestSchema: emptySchema,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.desktopOpenApplication,
    requestSchema: applicationActionSchema,
    requiredPermission: PERMISSIONS.appLaunch,
    handle: (request) => controller.openApplication(request.appId),
  });
  router.register({
    channel: IPC_CHANNELS.desktopCloseApplication,
    requestSchema: applicationActionSchema,
    requiredPermission: PERMISSIONS.appLaunch,
    handle: (request) => controller.closeApplication(request.appId, request.confirm),
  });
  router.register({
    channel: IPC_CHANNELS.desktopRestartApplication,
    requestSchema: applicationActionSchema,
    requiredPermission: PERMISSIONS.appLaunch,
    handle: (request) => controller.restartApplication(request.appId, request.confirm),
  });
  router.register({
    channel: IPC_CHANNELS.desktopFrontApplication,
    requestSchema: applicationActionSchema,
    requiredPermission: PERMISSIONS.appLaunch,
    handle: (request) => controller.bringApplicationToFront(request.appId),
  });
  router.register({
    channel: IPC_CHANNELS.desktopOpenFile,
    requestSchema: pathSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.openFile(request.path),
  });
  router.register({
    channel: IPC_CHANNELS.desktopOpenFolder,
    requestSchema: pathSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.openFolder(request.path),
  });
  router.register({
    channel: IPC_CHANNELS.desktopBrowseFolder,
    requestSchema: pathSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.browseFolder(request.path),
  });
  router.register({
    channel: IPC_CHANNELS.desktopFileOperation,
    requestSchema: fileOperationSchema,
    requiredPermission: PERMISSIONS.fileAccess,
    handle: (request) => controller.operateFile(request),
  });
  router.register({
    channel: IPC_CHANNELS.desktopClipboardRead,
    requestSchema: emptySchema,
    requiredPermission: PERMISSIONS.clipboard,
    handle: () => controller.readClipboard(),
  });
  router.register({
    channel: IPC_CHANNELS.desktopClipboardWrite,
    requestSchema: clipboardWriteSchema,
    requiredPermission: PERMISSIONS.clipboard,
    handle: (request) => controller.writeClipboard(request.text),
  });
  router.register({
    channel: IPC_CHANNELS.desktopNotify,
    requestSchema: notificationSchema,
    requiredPermission: PERMISSIONS.notifications,
    handle: (request) => controller.sendNotification(request),
  });
  router.register({
    channel: IPC_CHANNELS.desktopScreenshot,
    requestSchema: screenshotSchema,
    requiredPermission: PERMISSIONS.screenshot,
    handle: (request) => controller.captureScreenshot(request),
  });
  router.register({
    channel: IPC_CHANNELS.desktopSystem,
    requestSchema: emptySchema,
    requiredPermission: PERMISSIONS.systemInformation,
    handle: () => controller.systemInformation(),
  });
  router.register({
    channel: IPC_CHANNELS.desktopRouteTool,
    requestSchema: routeSchema,
    requiredPermission: PERMISSIONS.desktopAutomation,
    handle: (request) => controller.routeTool(request.prompt),
  });
  router.register({
    channel: IPC_CHANNELS.desktopAuditLogs,
    requestSchema: emptySchema,
    handle: () => controller.auditLogs(),
  });
}
