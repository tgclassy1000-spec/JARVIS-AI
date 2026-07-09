import { z } from 'zod';

import {
  PLUGIN_CAPABILITY_KINDS,
  PLUGIN_PERMISSIONS,
  PLUGIN_SOURCES,
  type PluginJsonValue,
} from '../../../shared/plugins/contracts';
import { IPC_CHANNELS } from '../../../shared/platform/ipc';
import { PERMISSIONS } from '../../../shared/platform/permissions';
import type { IpcRouter } from '../../platform/ipc/ipc-router';
import type { PluginManager } from '../service/plugin-manager';

export type PluginController = Pick<
  PluginManager,
  | 'dashboard'
  | 'registry'
  | 'validateManifest'
  | 'installPlugin'
  | 'enablePlugin'
  | 'disablePlugin'
  | 'updatePlugin'
  | 'removePlugin'
  | 'updateSettings'
  | 'resetPlugin'
  | 'logs'
  | 'invokeTool'
  | 'routeTool'
  | 'auditLogs'
>;

const emptySchema = z.object({}).strict();
const jsonSchema: z.ZodType<PluginJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);
const jsonObjectSchema = z.record(z.string(), jsonSchema);
const pluginPermissionSchema = z.enum(PLUGIN_PERMISSIONS);
const capabilitySchema = z
  .object({
    id: z.string().trim().min(3).max(64),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(400),
    kind: z.enum(PLUGIN_CAPABILITY_KINDS),
    requiredPermissions: z.array(pluginPermissionSchema).max(PLUGIN_PERMISSIONS.length),
  })
  .strict();
const manifestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    id: z.string().trim().min(3).max(64),
    version: z.string().trim().min(5).max(20),
    author: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
    permissions: z.array(pluginPermissionSchema).max(PLUGIN_PERMISSIONS.length),
    capabilities: z.array(capabilitySchema).min(1).max(20),
    minimumJarvisVersion: z.string().trim().min(5).max(20),
  })
  .strict();
const signatureSchema = z
  .object({
    algorithm: z.literal('ed25519'),
    value: z.string().trim().min(1).max(500),
    trusted: z.boolean(),
  })
  .strict();
const installSchema = z
  .object({
    manifest: manifestSchema,
    source: z.enum(PLUGIN_SOURCES).optional(),
    signature: signatureSchema.optional(),
  })
  .strict();
const updateSchema = z
  .object({
    pluginId: z.string().trim().min(3).max(64),
    manifest: manifestSchema,
    signature: signatureSchema.optional(),
  })
  .strict();
const pluginIdSchema = z.object({ pluginId: z.string().trim().min(3).max(64) }).strict();
const removeSchema = z
  .object({
    pluginId: z.string().trim().min(3).max(64),
    confirm: z.literal(true).optional(),
  })
  .strict();
const settingsSchema = z
  .object({
    pluginId: z.string().trim().min(3).max(64),
    configuration: jsonObjectSchema.optional(),
    grantedPermissions: z.array(pluginPermissionSchema).max(PLUGIN_PERMISSIONS.length).optional(),
  })
  .strict();
const invokeToolSchema = z
  .object({
    pluginId: z.string().trim().min(3).max(64),
    capabilityId: z.string().trim().min(3).max(64),
    input: jsonObjectSchema,
  })
  .strict();
const routeToolSchema = z
  .object({
    prompt: z.string().trim().min(1).max(1_000),
    input: jsonObjectSchema.optional(),
  })
  .strict();

export function registerPluginEndpoints(router: IpcRouter, controller: PluginController): void {
  router.register({
    channel: IPC_CHANNELS.pluginDashboard,
    requestSchema: emptySchema,
    handle: () => controller.dashboard(),
  });
  router.register({
    channel: IPC_CHANNELS.pluginRegistry,
    requestSchema: emptySchema,
    handle: () => controller.registry(),
  });
  router.register({
    channel: IPC_CHANNELS.pluginValidateManifest,
    requestSchema: manifestSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.validateManifest(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginInstall,
    requestSchema: installSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.installPlugin(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginEnable,
    requestSchema: pluginIdSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.enablePlugin(request.pluginId),
  });
  router.register({
    channel: IPC_CHANNELS.pluginDisable,
    requestSchema: pluginIdSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.disablePlugin(request.pluginId),
  });
  router.register({
    channel: IPC_CHANNELS.pluginUpdate,
    requestSchema: updateSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.updatePlugin(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginRemove,
    requestSchema: removeSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.removePlugin(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginSettings,
    requestSchema: settingsSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.updateSettings(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginReset,
    requestSchema: pluginIdSchema,
    requiredPermission: PERMISSIONS.plugins,
    handle: (request) => controller.resetPlugin(request.pluginId),
  });
  router.register({
    channel: IPC_CHANNELS.pluginLogs,
    requestSchema: pluginIdSchema.partial().strict(),
    handle: (request) => controller.logs(request.pluginId),
  });
  router.register({
    channel: IPC_CHANNELS.pluginInvokeTool,
    requestSchema: invokeToolSchema,
    requiredPermission: PERMISSIONS.pluginTools,
    handle: (request) => controller.invokeTool(request),
  });
  router.register({
    channel: IPC_CHANNELS.pluginRouteTool,
    requestSchema: routeToolSchema,
    requiredPermission: PERMISSIONS.pluginTools,
    handle: (request) => controller.routeTool(request.prompt, request.input),
  });
  router.register({
    channel: IPC_CHANNELS.pluginAuditLogs,
    requestSchema: emptySchema,
    handle: () => controller.auditLogs(),
  });
}
