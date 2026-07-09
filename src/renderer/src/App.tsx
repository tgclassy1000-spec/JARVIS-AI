import { useEffect, useState } from 'react';

import type { RuntimeInfo } from '../../shared/platform/ipc';
import { HudPanel } from './components/HudPanel';
import { ModuleList, type ModuleSummary } from './components/ModuleList';
import { SystemMetric } from './components/SystemMetric';
import { ChatPlatform } from './components/chat/ChatPlatform';
import { DesktopDashboard } from './components/desktop/DesktopDashboard';
import { DocumentsDashboard } from './components/documents/DocumentsDashboard';
import { MemoryReview } from './components/memory/MemoryReview';
import { OfficeDashboard } from './components/office/OfficeDashboard';
import { PluginDashboard } from './components/plugins/PluginDashboard';
import { ProductionDashboard } from './components/production/ProductionDashboard';
import { ReleaseCenter } from './components/release/ReleaseCenter';
import { WebDashboard } from './components/web/WebDashboard';

const queuedModules: readonly ModuleSummary[] = [
  { id: 'voice', label: 'Voice systems', detail: 'Input and output', status: 'queued' },
];

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function App() {
  const [now, setNow] = useState(() => new Date());
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [page, setPage] = useState<
    | 'conversation'
    | 'memory'
    | 'office'
    | 'documents'
    | 'web'
    | 'desktop'
    | 'plugins'
    | 'production'
    | 'release'
  >('release');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void window.jarvis.runtime
      .getInfo()
      .then((info) => {
        console.info('[JARVIS renderer] IPC ready');
        if (active) setRuntime(info);
      })
      .catch((error: unknown) => {
        console.error(
          '[JARVIS renderer] IPC readiness check failed',
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    console.info('[JARVIS renderer] App rendered');
  }, []);

  return (
    <div className="app-shell">
      <div className="scanlines" aria-hidden="true" />
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">J</span>
          <div>
            <strong>J.A.R.V.I.S.</strong>
            <span>DESKTOP INTELLIGENCE SYSTEM</span>
          </div>
        </div>
        <div className="system-state">
          <span className="signal-dot" /> PUBLIC RELEASE SYSTEMS ONLINE
        </div>
        <time dateTime={now.toISOString()}>
          <strong>{formatTime(now)}</strong>
          <span>
            {now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </time>
      </header>

      <nav className="hud-navigation" aria-label="JARVIS modules">
        <button
          className={page === 'release' ? 'active' : ''}
          type="button"
          onClick={() => setPage('release')}
        >
          Release
        </button>
        <button
          className={page === 'production' ? 'active' : ''}
          type="button"
          onClick={() => setPage('production')}
        >
          Production
        </button>
        <button
          className={page === 'plugins' ? 'active' : ''}
          type="button"
          onClick={() => setPage('plugins')}
        >
          Plugins
        </button>
        <button
          className={page === 'desktop' ? 'active' : ''}
          type="button"
          onClick={() => setPage('desktop')}
        >
          Desktop
        </button>
        <button
          className={page === 'web' ? 'active' : ''}
          type="button"
          onClick={() => setPage('web')}
        >
          Web Intel
        </button>
        <button
          className={page === 'documents' ? 'active' : ''}
          type="button"
          onClick={() => setPage('documents')}
        >
          Documents
        </button>
        <button
          className={page === 'office' ? 'active' : ''}
          type="button"
          onClick={() => setPage('office')}
        >
          Office
        </button>
        <button
          className={page === 'conversation' ? 'active' : ''}
          type="button"
          onClick={() => setPage('conversation')}
        >
          Conversation
        </button>
        <button
          className={page === 'memory' ? 'active' : ''}
          type="button"
          onClick={() => setPage('memory')}
        >
          Memory Vault
        </button>
      </nav>

      {page === 'release' ? (
        <ReleaseCenter />
      ) : page === 'production' ? (
        <ProductionDashboard />
      ) : page === 'plugins' ? (
        <PluginDashboard />
      ) : page === 'desktop' ? (
        <DesktopDashboard />
      ) : page === 'web' ? (
        <WebDashboard />
      ) : page === 'documents' ? (
        <DocumentsDashboard />
      ) : page === 'office' ? (
        <OfficeDashboard />
      ) : page === 'conversation' ? (
        <main className="dashboard">
          <ChatPlatform />
          <HudPanel title="Queued Systems" eyebrow="FUTURE MODULES">
            <ModuleList modules={queuedModules} />
          </HudPanel>
        </main>
      ) : (
        <main>
          <MemoryReview />
        </main>
      )}

      <section className="telemetry" aria-label="System telemetry">
        <SystemMetric label="SECURE IPC" value="ONLINE" active />
        <SystemMetric label="RENDERER SANDBOX" value="ACTIVE" active />
        <SystemMetric label="GEMINI CORE" value="2.5 FLASH" active />
        <SystemMetric label="CONVERSATION DB" value="ONLINE" active />
        <SystemMetric label="MEMORY VAULT" value="ACTIVE" active />
        <SystemMetric label="OFFICE DB" value="ONLINE" active />
        <SystemMetric label="DOCUMENT INDEX" value="ONLINE" active />
        <SystemMetric label="WEB INTEL" value="LIVE" active />
        <SystemMetric label="DESKTOP OPS" value="ALLOW-LISTED" active />
        <SystemMetric label="PLUGIN TOOLS" value="SANDBOXED" active />
        <SystemMetric label="PRODUCTION" value="HARDENED" active />
        <SystemMetric label="RELEASE" value="PACKAGED" active />
        <SystemMetric
          label="RUNTIME"
          value={runtime ? `ELECTRON ${runtime.electronVersion}` : 'DETECTING'}
          active={Boolean(runtime)}
        />
      </section>

      <footer className="footerbar">
        <span>MODULE 12 // PUBLIC RELEASE ENGINEERING</span>
        <span>
          {runtime ? `v${runtime.appVersion} · ${runtime.platform}` : 'SECURE HANDSHAKE…'}
        </span>
      </footer>
    </div>
  );
}
