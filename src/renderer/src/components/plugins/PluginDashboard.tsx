import { useCallback, useEffect, useState } from 'react';

import type {
  InstalledPlugin,
  PluginCapability,
  PluginDashboard as PluginDashboardData,
  PluginManifest,
  PluginPermission,
} from '../../../../shared/plugins/contracts';
import { HudPanel } from '../HudPanel';

function signatureFor(pluginId: string) {
  return {
    algorithm: 'ed25519' as const,
    value: `jarvis-signature:${pluginId}`,
    trusted: true,
  };
}

function permissionText(permissions: readonly PluginPermission[]): string {
  return permissions.length > 0 ? permissions.join(', ') : 'none';
}

export function PluginDashboard() {
  const [dashboard, setDashboard] = useState<PluginDashboardData | null>(null);
  const [prompt, setPrompt] = useState('Translate this text');
  const [status, setStatus] = useState('Plugin platform ready.');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setDashboard(await window.jarvis.plugins.dashboard());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Plugin dashboard failed.');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (action: () => Promise<void>, message: string): Promise<void> => {
    setLoading(true);
    try {
      await action();
      await refresh();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Plugin request failed.');
    } finally {
      setLoading(false);
    }
  };

  const installPlugin = (manifest: PluginManifest) =>
    run(async () => {
      await window.jarvis.plugins.install({
        manifest,
        source: 'local',
        signature: signatureFor(manifest.id),
      });
    }, 'Plugin installed.');

  const enablePlugin = (plugin: InstalledPlugin) =>
    run(async () => {
      await window.jarvis.plugins.settings({
        pluginId: plugin.manifest.id,
        grantedPermissions: plugin.manifest.permissions,
      });
      await window.jarvis.plugins.enable(plugin.manifest.id);
    }, 'Plugin enabled.');

  const disablePlugin = (pluginId: string) =>
    run(async () => {
      await window.jarvis.plugins.disable(pluginId);
    }, 'Plugin disabled.');

  const routeTool = () =>
    run(async () => {
      const result = await window.jarvis.plugins.routeTool({ prompt, input: { text: prompt } });
      setStatus(result.selected ? result.reason : result.reason);
    }, 'Tool registry route completed.');

  const installedIds = new Set(dashboard?.installed.map((plugin) => plugin.manifest.id) ?? []);

  return (
    <main className="plugin-shell">
      <HudPanel title="Plugin Dashboard" eyebrow="MODULE 10">
        <div className="plugin-command">
          <input
            aria-label="Plugin tool prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void routeTool();
            }}
          />
          <button type="button" disabled={loading} onClick={() => void routeTool()}>
            Route Tool
          </button>
        </div>
        <p className="plugin-status" role="status">
          {loading ? 'Validating plugin boundary...' : status}
        </p>
      </HudPanel>

      <section className="plugin-grid">
        <HudPanel title="Installed Plugins" eyebrow="REGISTRY">
          <ul className="plugin-list">
            {dashboard?.installed.map((plugin) => (
              <li key={plugin.manifest.id}>
                <div>
                  <strong>{plugin.manifest.name}</strong>
                  <span>
                    {plugin.manifest.version} / {plugin.status} / {plugin.verification.status}
                  </span>
                </div>
                <div className="plugin-actions">
                  <button
                    type="button"
                    disabled={loading || plugin.status === 'enabled'}
                    onClick={() => void enablePlugin(plugin)}
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    disabled={loading || plugin.status === 'disabled'}
                    onClick={() => void disablePlugin(plugin.manifest.id)}
                  >
                    Disable
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Local Registry" eyebrow="MARKETPLACE READY">
          <ul className="plugin-list">
            {dashboard?.registry.map((manifest) => (
              <li key={manifest.id}>
                <div>
                  <strong>{manifest.name}</strong>
                  <span>
                    {manifest.capabilities.map((capability) => capability.name).join(', ')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={loading || installedIds.has(manifest.id)}
                  onClick={() => void installPlugin(manifest)}
                >
                  Install
                </button>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Available Skills" eyebrow="TOOLS">
          <SkillList skills={dashboard?.availableSkills ?? []} />
        </HudPanel>

        <HudPanel title="Permissions" eyebrow="SANDBOX">
          <ul className="plugin-list plugin-list--compact">
            {dashboard?.installed.map((plugin) => (
              <li key={plugin.manifest.id}>
                <div>
                  <strong>{plugin.manifest.name}</strong>
                  <span>{permissionText(plugin.settings.grantedPermissions)}</span>
                </div>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Updates" eyebrow="MANUAL">
          <ul className="plugin-list plugin-list--compact">
            {dashboard?.updates.map((plugin) => (
              <li key={plugin.manifest.id}>
                <div>
                  <strong>{plugin.manifest.name}</strong>
                  <span>{plugin.manifest.version}</span>
                </div>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Logs" eyebrow="AUDIT">
          <ul className="plugin-list plugin-list--compact">
            {dashboard?.logs.map((log) => (
              <li key={log.id}>
                <div>
                  <strong>{log.level}</strong>
                  <span>{log.message}</span>
                </div>
              </li>
            ))}
          </ul>
        </HudPanel>
      </section>
    </main>
  );
}

function SkillList({ skills }: { readonly skills: readonly PluginCapability[] }) {
  if (skills.length === 0) return <p className="plugin-status">No skills installed.</p>;
  return (
    <ul className="plugin-list plugin-list--compact">
      {skills.map((skill) => (
        <li key={skill.id}>
          <div>
            <strong>{skill.name}</strong>
            <span>
              {skill.kind} / {permissionText(skill.requiredPermissions)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
