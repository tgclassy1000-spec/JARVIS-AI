// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import type { PluginController } from '../../src/main/plugins/ipc/plugin.endpoints';
import { registerPluginEndpoints } from '../../src/main/plugins/ipc/plugin.endpoints';
import { IpcRouter } from '../../src/main/platform/ipc/ipc-router';
import { createPermissionMiddleware } from '../../src/main/platform/ipc/middleware';
import type { IpcListener, IpcMainAdapter } from '../../src/main/platform/ipc/types';
import type { Logger } from '../../src/main/platform/logging/logger';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';
import type { PluginManifest } from '../../src/shared/plugins/contracts';
import {
  ALLOWED_IPC_CHANNELS,
  ALLOWED_IPC_EVENTS,
  IPC_CHANNELS,
} from '../../src/shared/platform/ipc';
import { PERMISSIONS, type PermissionDecision } from '../../src/shared/platform/permissions';

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

const plugin: PluginManifest = {
  name: 'Translate',
  id: 'translate-plugin',
  version: '1.0.0',
  author: 'JARVIS',
  description: 'Translation skill.',
  permissions: ['storage'],
  capabilities: [
    {
      id: 'translate-text',
      name: 'Translate',
      description: 'Translate text.',
      kind: 'translate',
      requiredPermissions: [],
    },
  ],
  minimumJarvisVersion: '0.8.0',
};

function createRouter(decision: PermissionDecision = 'allow') {
  const adapter = new Adapter();
  const permissions = new Map(
    Object.values(PERMISSIONS).map((permission) => [permission, decision] as const),
  );
  const router = new IpcRouter(
    adapter,
    ALLOWED_IPC_CHANNELS,
    ALLOWED_IPC_EVENTS,
    [createPermissionMiddleware(new PermissionManager(permissions))],
    logger,
    () => 'plugin-request',
  );
  return { adapter, router };
}

function controller(): PluginController {
  const installed = {
    manifest: plugin,
    source: 'local' as const,
    status: 'enabled' as const,
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    verification: {
      status: 'verified' as const,
      reason: 'trusted',
      checkedAt: '2026-01-01T00:00:00.000Z',
    },
    settings: {
      configuration: {},
      grantedPermissions: ['storage' as const],
      storage: {},
      storageBytes: 0,
    },
  };
  const tool = {
    pluginId: plugin.id,
    capabilityId: 'translate-text',
    capabilityKind: 'translate' as const,
    executedBy: 'tool-registry' as const,
    output: { pluginCodeExecuted: false },
  };
  return {
    dashboard: () => ({
      installed: [installed],
      registry: [plugin],
      availableSkills: plugin.capabilities,
      updates: [],
      logs: [],
      audit: [],
    }),
    registry: () => [plugin],
    validateManifest: () => ({ valid: true, issues: [] }),
    installPlugin: () => installed,
    enablePlugin: () => installed,
    disablePlugin: () => ({ ...installed, status: 'disabled' as const }),
    updatePlugin: (request) => ({ ...installed, manifest: request.manifest }),
    removePlugin: (request) => ({
      pluginId: request.pluginId,
      confirmationRequired: !request.confirm,
      removed: Boolean(request.confirm),
    }),
    updateSettings: () => installed,
    resetPlugin: () => installed,
    logs: () => [],
    invokeTool: () => tool,
    routeTool: () => ({ selected: true, reason: 'selected', tool }),
    auditLogs: () => [],
  };
}

describe('plugin IPC endpoints', () => {
  it('registers allow-listed plugin endpoints and handles typed contracts', async () => {
    const { adapter, router } = createRouter();
    registerPluginEndpoints(router, controller());
    const event = { senderUrl: 'file:///app', send: vi.fn() };
    const invoke = (channel: string, payload: unknown) =>
      adapter.handlers.get(channel)?.(event, payload);

    expect(adapter.handlers.size).toBe(14);
    await expect(invoke(IPC_CHANNELS.pluginDashboard, {})).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.pluginRegistry, {})).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.pluginValidateManifest, plugin)).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      invoke(IPC_CHANNELS.pluginInstall, {
        manifest: plugin,
        signature: { algorithm: 'ed25519', value: 'jarvis-signature:test', trusted: true },
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.pluginEnable, { pluginId: plugin.id })).resolves.toMatchObject(
      {
        ok: true,
      },
    );
    await expect(
      invoke(IPC_CHANNELS.pluginDisable, { pluginId: plugin.id }),
    ).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      invoke(IPC_CHANNELS.pluginUpdate, {
        pluginId: plugin.id,
        manifest: { ...plugin, version: '1.1.0' },
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.pluginRemove, { pluginId: plugin.id, confirm: true }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.pluginSettings, { pluginId: plugin.id, grantedPermissions: ['storage'] }),
    ).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.pluginReset, { pluginId: plugin.id })).resolves.toMatchObject({
      ok: true,
    });
    await expect(invoke(IPC_CHANNELS.pluginLogs, {})).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.pluginInvokeTool, {
        pluginId: plugin.id,
        capabilityId: 'translate-text',
        input: { text: 'hello' },
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      invoke(IPC_CHANNELS.pluginRouteTool, { prompt: 'translate hello', input: { text: 'hello' } }),
    ).resolves.toMatchObject({ ok: true });
    await expect(invoke(IPC_CHANNELS.pluginAuditLogs, {})).resolves.toMatchObject({ ok: true });
    router.dispose();
  });

  it('rejects invalid payloads and denied plugin permissions', async () => {
    const { adapter } = createRouter('deny');
    registerPluginEndpoints(
      new IpcRouter(
        adapter,
        ALLOWED_IPC_CHANNELS,
        ALLOWED_IPC_EVENTS,
        [
          createPermissionMiddleware(
            new PermissionManager(new Map([[PERMISSIONS.plugins, 'deny']])),
          ),
        ],
        logger,
        () => 'plugin-request',
      ),
      controller(),
    );
    const event = { senderUrl: 'file:///app', send: vi.fn() };

    await expect(
      adapter.handlers.get(IPC_CHANNELS.pluginInstall)?.(event, { manifest: { id: '' } }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    await expect(
      adapter.handlers.get(IPC_CHANNELS.pluginDashboard)?.(event, {}),
    ).resolves.toMatchObject({ ok: true });
  });
});
