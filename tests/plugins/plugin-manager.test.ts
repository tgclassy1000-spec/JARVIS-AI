// @vitest-environment node

import { describe, expect, it } from 'vitest';

import type { PluginManifest } from '../../src/shared/plugins/contracts';
import {
  PluginManager,
  createTrustedSignature,
} from '../../src/main/plugins/service/plugin-manager';

function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'Calendar Bridge',
    id: 'calendar-bridge',
    version: '1.0.0',
    author: 'JARVIS Test',
    description: 'Calendar skill for plugin platform tests.',
    permissions: ['network', 'storage'],
    capabilities: [
      {
        id: 'calendar-summary',
        name: 'Calendar',
        description: 'Summarize calendar events.',
        kind: 'calendar',
        requiredPermissions: ['network'],
      },
    ],
    minimumJarvisVersion: '0.8.0',
    ...overrides,
  };
}

function createManager(rateLimitPerMinute = 20): PluginManager {
  let id = 0;
  return new PluginManager({
    appVersion: '0.8.0',
    rateLimitPerMinute,
    clock: () => new Date('2026-01-01T00:00:00.000Z'),
    idFactory: () => `plugin-id-${(id += 1)}`,
  });
}

function installEnabled(manager: PluginManager, plugin = manifest()) {
  const installed = manager.installPlugin({
    manifest: plugin,
    signature: createTrustedSignature(plugin.id),
  });
  manager.updateSettings({
    pluginId: installed.manifest.id,
    grantedPermissions: installed.manifest.permissions,
  });
  return manager.enablePlugin(installed.manifest.id);
}

describe('PluginManager', () => {
  it('validates manifest identity, versions, capabilities, and dependencies', () => {
    const manager = createManager();
    const invalid = manifest({
      id: 'Bad ID',
      version: '1',
      minimumJarvisVersion: '99.0.0',
      capabilities: [
        {
          id: 'bad cap',
          name: 'Bad',
          description: 'Bad capability',
          kind: 'calendar',
          requiredPermissions: ['clipboard'],
        },
      ],
    });

    const report = manager.validateManifest(invalid);

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'id',
        'version',
        'minimumJarvisVersion',
        'capabilities.id',
        'capabilities.requiredPermissions',
      ]),
    );
  });

  it('validates malformed manifest permissions and capability shapes defensively', () => {
    const manager = createManager();
    const invalid = manifest({
      minimumJarvisVersion: 'bad',
      permissions: ['network', 'network', 'desktop-admin' as 'network'],
      capabilities: [
        {
          id: 'calendar-summary',
          name: 'Calendar',
          description: 'Duplicate capability one.',
          kind: 'calendar',
          requiredPermissions: ['network'],
        },
        {
          id: 'calendar-summary',
          name: 'Unsupported',
          description: 'Duplicate capability two.',
          kind: 'unsupported-kind' as 'calendar',
          requiredPermissions: ['network'],
        },
      ],
    });
    const emptyCapabilities = manager.validateManifest(manifest({ capabilities: [] }));

    const report = manager.validateManifest(invalid);

    expect(report.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        'minimumJarvisVersion',
        'permissions',
        'capabilities',
        'capabilities.kind',
      ]),
    );
    expect(emptyCapabilities.issues.map((issue) => issue.field)).toContain('capabilities');
    expect(() => manager.installPlugin({ manifest: invalid })).toThrow(/validation/);
  });

  it('uses default registry, clock, id factory, and rate limit settings safely', async () => {
    const manager = new PluginManager({ appVersion: '0.8.0' });
    const plugin = manifest({ id: 'default-plugin' });

    manager.installPlugin({ manifest: plugin, signature: createTrustedSignature(plugin.id) });

    await expect(manager.listPluginIds()).resolves.toEqual([plugin.id]);
    expect(manager.registry().map((entry) => entry.id)).toContain('jarvis-translate');
  });

  it('installs, verifies, enables, disables, and removes plugins with confirmation', () => {
    const manager = createManager();
    const plugin = manifest();

    const unsigned = manager.installPlugin({ manifest: plugin });

    expect(unsigned.verification.status).toBe('missing');
    expect(() => manager.enablePlugin(plugin.id)).toThrow(/signature/);
    expect(manager.removePlugin({ pluginId: plugin.id }).confirmationRequired).toBe(true);
    expect(manager.removePlugin({ pluginId: plugin.id, confirm: true }).removed).toBe(true);

    manager.installPlugin({ manifest: plugin, signature: createTrustedSignature(plugin.id) });
    const enabled = manager.enablePlugin(plugin.id);
    const disabled = manager.disablePlugin(plugin.id);

    expect(enabled.status).toBe('enabled');
    expect(disabled.status).toBe('disabled');
    expect(manager.dashboard().installed).toHaveLength(1);
  });

  it('rejects duplicate installs and invalid manual updates', () => {
    const manager = createManager();
    const plugin = manifest();
    manager.installPlugin({ manifest: plugin, signature: createTrustedSignature(plugin.id) });

    expect(() =>
      manager.installPlugin({ manifest: plugin, signature: createTrustedSignature(plugin.id) }),
    ).toThrow(/already installed/);
    expect(() =>
      manager.updatePlugin({
        pluginId: plugin.id,
        manifest: { ...plugin, version: '1.0.0' },
        signature: createTrustedSignature(plugin.id),
      }),
    ).toThrow(/increase version/);

    const updated = manager.updatePlugin({
      pluginId: plugin.id,
      manifest: { ...plugin, version: '1.1.0' },
      signature: createTrustedSignature(plugin.id),
    });

    expect(updated.manifest.version).toBe('1.1.0');
  });

  it('rejects mismatched, invalid, and untrusted updates', () => {
    const manager = createManager();
    const plugin = installEnabled(manager);

    expect(() =>
      manager.updatePlugin({
        pluginId: plugin.manifest.id,
        manifest: { ...plugin.manifest, id: 'other-plugin', version: '1.1.0' },
        signature: createTrustedSignature('other-plugin'),
      }),
    ).toThrow(/same ID/);
    expect(() =>
      manager.updatePlugin({
        pluginId: plugin.manifest.id,
        manifest: { ...plugin.manifest, version: 'bad' },
        signature: createTrustedSignature(plugin.manifest.id),
      }),
    ).toThrow(/validation/);

    const updated = manager.updatePlugin({
      pluginId: plugin.manifest.id,
      manifest: { ...plugin.manifest, version: '1.1.0' },
      signature: { algorithm: 'ed25519', value: 'not-trusted', trusted: false },
    });

    expect(updated.status).toBe('disabled');
    expect(updated.verification.status).toBe('untrusted');
  });

  it('blocks sandboxed tool access until declared permissions are granted', () => {
    const manager = createManager();
    const plugin = manifest();
    manager.installPlugin({ manifest: plugin, signature: createTrustedSignature(plugin.id) });
    manager.enablePlugin(plugin.id);

    expect(() =>
      manager.invokeTool({ pluginId: plugin.id, capabilityId: 'calendar-summary', input: {} }),
    ).toThrow(/network/);

    manager.updateSettings({ pluginId: plugin.id, grantedPermissions: ['network'] });
    const result = manager.invokeTool({
      pluginId: plugin.id,
      capabilityId: 'calendar-summary',
      input: { query: 'today' },
    });

    expect(result.executedBy).toBe('tool-registry');
    expect(result.output.pluginCodeExecuted).toBe(false);
  });

  it('rejects undeclared settings grants and unsafe tool invocations', () => {
    const manager = createManager();
    const plugin = installEnabled(manager);

    expect(() =>
      manager.updateSettings({ pluginId: plugin.manifest.id, grantedPermissions: ['clipboard'] }),
    ).toThrow(/did not request/);
    manager.disablePlugin(plugin.manifest.id);
    expect(() =>
      manager.invokeTool({
        pluginId: plugin.manifest.id,
        capabilityId: 'calendar-summary',
        input: {},
      }),
    ).toThrow(/not enabled/);
    manager.enablePlugin(plugin.manifest.id);
    expect(() =>
      manager.invokeTool({
        pluginId: plugin.manifest.id,
        capabilityId: 'missing-skill',
        input: {},
      }),
    ).toThrow(/not found/);
    expect(() =>
      manager.invokeTool({
        pluginId: plugin.manifest.id,
        capabilityId: 'calendar-summary',
        input: Object.fromEntries(
          Array.from({ length: 51 }, (_value, index) => [`key-${index}`, 'value']),
        ),
      }),
    ).toThrow(/too large/);

    const stored = manager.dashboard().installed[0];
    if (!stored) throw new Error('Expected installed plugin.');
    const capability = stored.manifest.capabilities[0];
    if (!capability) throw new Error('Expected installed capability.');
    (capability as unknown as { requiredPermissions: readonly ['clipboard'] }).requiredPermissions =
      ['clipboard'];
    expect(() =>
      manager.invokeTool({
        pluginId: plugin.manifest.id,
        capabilityId: 'calendar-summary',
        input: {},
      }),
    ).toThrow(/declared/);
  });

  it('routes prompts through the tool registry instead of plugin code', () => {
    const manager = createManager();
    installEnabled(manager);

    const result = manager.routeTool('Show my calendar for today', { query: 'today' });

    expect(result.selected).toBe(true);
    expect(result.tool?.capabilityKind).toBe('calendar');
    expect(manager.auditLogs()[0]?.action).toBe('tool.invoke');
  });

  it('returns a safe no-match route result', () => {
    const manager = createManager();
    installEnabled(manager);

    const result = manager.routeTool('do something unrelated');

    expect(result.selected).toBe(false);
    expect(manager.auditLogs()[0]?.allowed).toBe(false);
  });

  it('reports update-available dashboard state from the registry', () => {
    const base = manifest();
    const manager = new PluginManager({
      appVersion: '0.8.0',
      registry: [{ ...base, version: '2.0.0' }],
      clock: () => new Date('2026-01-01T00:00:00.000Z'),
      idFactory: () => 'id',
    });
    manager.installPlugin({ manifest: base, signature: createTrustedSignature(base.id) });

    const dashboard = manager.dashboard();

    expect(dashboard.installed[0]?.status).toBe('update-available');
    expect(dashboard.updates).toHaveLength(1);
  });

  it('keeps existing settings when settings updates omit permission grants', () => {
    const manager = createManager();
    const plugin = installEnabled(manager);

    const updated = manager.updateSettings({
      pluginId: plugin.manifest.id,
      configuration: { mode: 'quiet' },
    });

    expect(updated.settings.grantedPermissions).toEqual(plugin.manifest.permissions);
    expect(updated.settings.configuration.mode).toBe('quiet');
  });

  it('resets settings, storage, and logs', () => {
    const manager = createManager();
    const plugin = installEnabled(manager);
    manager.invokeTool({
      pluginId: plugin.manifest.id,
      capabilityId: 'calendar-summary',
      input: {},
    });

    const reset = manager.resetPlugin(plugin.manifest.id);

    expect(reset.settings.grantedPermissions).toEqual([]);
    expect(manager.logs(plugin.manifest.id)).toHaveLength(1);
    expect(manager.logs(plugin.manifest.id)[0]?.message).toMatch(/reset/);
    expect(manager.logs()).toHaveLength(1);
  });

  it('enforces tool rate limits', () => {
    const manager = createManager(1);
    const plugin = installEnabled(manager);

    manager.invokeTool({
      pluginId: plugin.manifest.id,
      capabilityId: 'calendar-summary',
      input: {},
    });

    expect(() =>
      manager.invokeTool({
        pluginId: plugin.manifest.id,
        capabilityId: 'calendar-summary',
        input: {},
      }),
    ).toThrow(/rate limit/);
  });

  it('lists installed plugin ids and rejects missing plugins', async () => {
    const manager = createManager();
    const plugin = installEnabled(manager);

    await expect(manager.listPluginIds()).resolves.toEqual([plugin.manifest.id]);
    expect(() => manager.disablePlugin('missing-plugin')).toThrow(/not installed/);
  });
});
