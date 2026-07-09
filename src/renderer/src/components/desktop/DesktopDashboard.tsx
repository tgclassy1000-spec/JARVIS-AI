import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  AllowedApplicationId,
  AuditLogEntry,
  DesktopDashboard as DesktopDashboardData,
  NotificationKind,
  ScreenshotRecord,
  SystemInformation,
} from '../../../../shared/desktop/contracts';
import { HudPanel } from '../HudPanel';

function formatBytes(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    notation: value > 999_999_999 ? 'compact' : 'standard',
  }).format(value);
}

function systemRows(system: SystemInformation): readonly { label: string; value: string }[] {
  return [
    { label: 'CPU', value: `${system.cpu.model} (${system.cpu.cores} cores)` },
    { label: 'RAM', value: `${system.ram.usedPercent}% used` },
    { label: 'Disk', value: `${system.disk.usedPercent}% used` },
    { label: 'Battery', value: system.battery.available ? `${system.battery.percent}%` : 'N/A' },
    { label: 'GPU', value: `${system.gpu.vendor} ${system.gpu.model}` },
    { label: 'OS', value: `${system.operatingSystem.platform} ${system.operatingSystem.release}` },
    { label: 'Network', value: system.network.online ? 'Online' : 'Offline' },
  ];
}

export function DesktopDashboard() {
  const [dashboard, setDashboard] = useState<DesktopDashboardData | null>(null);
  const [command, setCommand] = useState('Open VS Code');
  const [clipboardText, setClipboardText] = useState('');
  const [notificationKind, setNotificationKind] = useState<NotificationKind>('desktop');
  const [status, setStatus] = useState('Desktop automation ready.');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setDashboard(await window.jarvis.desktop.dashboard());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Desktop dashboard failed.');
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
      setStatus(error instanceof Error ? error.message : 'Desktop automation request failed.');
    } finally {
      setLoading(false);
    }
  };

  const routeCommand = () =>
    run(async () => {
      const result = await window.jarvis.desktop.routeTool({ prompt: command });
      setStatus(result.summary);
    }, 'Command routed through allow-listed tools.');

  const openApplication = (appId: AllowedApplicationId) =>
    run(async () => {
      await window.jarvis.desktop.openApplication({ appId });
    }, 'Allowed application opened.');

  const captureScreen = () =>
    run(async () => {
      await window.jarvis.desktop.screenshot({ kind: 'screen' });
    }, 'Screenshot captured.');

  const writeClipboard = () =>
    run(async () => {
      await window.jarvis.desktop.writeClipboard({ text: clipboardText });
    }, 'Clipboard updated.');

  const readClipboard = () =>
    run(async () => {
      const snapshot = await window.jarvis.desktop.readClipboard();
      setClipboardText(snapshot.text);
    }, 'Clipboard read.');

  const sendNotification = () =>
    run(async () => {
      await window.jarvis.desktop.notify({
        kind: notificationKind,
        title: 'J.A.R.V.I.S.',
        body: 'Permission-first desktop notification delivered.',
        progressPercent: notificationKind === 'progress' ? 67 : undefined,
      });
    }, 'Notification sent.');

  const rows = useMemo(() => (dashboard ? systemRows(dashboard.system) : []), [dashboard]);

  return (
    <main className="desktop-shell">
      <HudPanel title="Desktop Dashboard" eyebrow="MODULE 09">
        <div className="desktop-command">
          <input
            aria-label="Desktop command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void routeCommand();
            }}
          />
          <button type="button" disabled={loading} onClick={() => void routeCommand()}>
            Route
          </button>
          <button type="button" disabled={loading} onClick={() => void captureScreen()}>
            Screenshot
          </button>
        </div>
        <p className="desktop-status" role="status">
          {loading ? 'Checking permissions...' : status}
        </p>
        <div className="desktop-app-grid">
          {dashboard?.allowedApplications.map((app) => (
            <button
              key={app.id}
              type="button"
              disabled={!app.supported || loading}
              onClick={() => void openApplication(app.id)}
            >
              <strong>{app.name}</strong>
              <span>{app.supported ? 'Allowed' : 'Unavailable'}</span>
            </button>
          ))}
        </div>
      </HudPanel>

      <section className="desktop-grid">
        <HudPanel title="Running Apps" eyebrow="ALLOW-LIST">
          <ul className="desktop-list">
            {dashboard?.runningApplications.map((app) => (
              <li key={app.id}>
                <strong>{app.name}</strong>
                <span>{app.status}</span>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="System Monitor" eyebrow="LOCAL">
          <ul className="desktop-list">
            {rows.map((row) => (
              <li key={row.label}>
                <strong>{row.label}</strong>
                <span>{row.value}</span>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Clipboard" eyebrow="PERMISSION">
          <textarea
            value={clipboardText}
            aria-label="Clipboard text"
            onChange={(event) => setClipboardText(event.target.value)}
          />
          <div className="desktop-actions">
            <button type="button" disabled={loading} onClick={() => void readClipboard()}>
              Read
            </button>
            <button type="button" disabled={loading} onClick={() => void writeClipboard()}>
              Write
            </button>
          </div>
          <ul className="desktop-list desktop-list--compact">
            {dashboard?.clipboardHistory.map((entry) => (
              <li key={entry.updatedAt}>
                <strong>{entry.text || 'Empty clipboard'}</strong>
                <span>{new Date(entry.updatedAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Notifications" eyebrow="DESKTOP">
          <div className="desktop-actions">
            <select
              value={notificationKind}
              aria-label="Notification kind"
              onChange={(event) => setNotificationKind(event.target.value as NotificationKind)}
            >
              {['desktop', 'progress', 'reminder', 'ai'].map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <button type="button" disabled={loading} onClick={() => void sendNotification()}>
              Send
            </button>
          </div>
          <ul className="desktop-list desktop-list--compact">
            {dashboard?.notifications.map((notification) => (
              <li key={notification.id}>
                <strong>{notification.title}</strong>
                <span>{notification.kind}</span>
              </li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Screenshot Gallery" eyebrow="CAPTURES">
          <ScreenshotGallery screenshots={dashboard?.screenshots ?? []} />
        </HudPanel>

        <HudPanel title="Audit Logs" eyebrow="SECURITY">
          <AuditLog logs={dashboard?.auditLogs ?? []} />
        </HudPanel>

        <HudPanel title="Files" eyebrow="READ-ONLY">
          <ul className="desktop-list">
            {dashboard?.favoriteFolders.map((folder) => (
              <li key={folder.path}>
                <strong>{folder.name || folder.path}</strong>
                <span>{formatBytes(folder.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        </HudPanel>
      </section>
    </main>
  );
}

function ScreenshotGallery({ screenshots }: { readonly screenshots: readonly ScreenshotRecord[] }) {
  if (screenshots.length === 0) return <p className="desktop-empty">No screenshots captured.</p>;
  return (
    <div className="screenshot-gallery">
      {screenshots.map((screenshot) => (
        <figure key={screenshot.id}>
          <img src={screenshot.dataUrl} alt={`${screenshot.kind} screenshot`} />
          <figcaption>
            {screenshot.width}x{screenshot.height}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function AuditLog({ logs }: { readonly logs: readonly AuditLogEntry[] }) {
  if (logs.length === 0) return <p className="desktop-empty">No audit entries.</p>;
  return (
    <ul className="desktop-list desktop-list--compact">
      {logs.map((log) => (
        <li key={log.id}>
          <strong>{log.action}</strong>
          <span>{log.allowed ? 'allowed' : 'denied'}</span>
        </li>
      ))}
    </ul>
  );
}
