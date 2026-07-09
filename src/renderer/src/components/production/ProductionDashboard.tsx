import { useEffect, useState } from 'react';

import type {
  DiagnosticBundle,
  ProductionDashboard as ProductionDashboardState,
  SecurityAuditReport,
} from '../../../../shared/production/contracts';
import { HudPanel } from '../HudPanel';

function statusLabel(value: string): string {
  return value.toUpperCase();
}

export function ProductionDashboard() {
  const [dashboard, setDashboard] = useState<ProductionDashboardState | null>(null);
  const [audit, setAudit] = useState<SecurityAuditReport | null>(null);
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [message, setMessage] = useState('Loading production readiness telemetry.');
  const [highContrast, setHighContrast] = useState(false);

  const loadDashboard = () => {
    setMessage('Refreshing production hardening dashboard.');
    void window.jarvis.production
      .dashboard()
      .then((next) => {
        setDashboard(next);
        setAudit(next.security);
        setMessage('Production hardening dashboard is current.');
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Production dashboard failed to load.');
      });
  };

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    return () => document.documentElement.classList.remove('high-contrast');
  }, [highContrast]);

  const runAudit = () => {
    setMessage('Running release security audit.');
    void window.jarvis.production.runSecurityAudit().then((report) => {
      setAudit(report);
      setMessage('Release security audit completed.');
    });
  };

  const exportDiagnostics = () => {
    setMessage('Exporting local diagnostic bundle.');
    void window.jarvis.production.exportDiagnostics().then((next) => {
      setBundle(next);
      setMessage(`Diagnostic bundle ready: ${next.filename}`);
    });
  };

  const toggleDebug = () => {
    const enabled = !(dashboard?.debugMode.enabled ?? false);
    void window.jarvis.production.setDebugMode(enabled).then((debugMode) => {
      setDashboard((current) => (current ? { ...current, debugMode } : current));
      setMessage(`Debug mode ${debugMode.enabled ? 'enabled' : 'disabled'}.`);
    });
  };

  const checks = dashboard?.checks ?? [];

  return (
    <main className="production-shell" aria-labelledby="production-title">
      <section className="production-hero hud-card">
        <div>
          <span className="eyebrow">MODULE 11</span>
          <h1 id="production-title">Production Hardening</h1>
          <p>
            Crash recovery, encrypted local data handling, diagnostics, release audits, performance
            telemetry, and accessibility verification are online.
          </p>
        </div>
        <div className={`production-orb production-orb--${dashboard?.overallStatus ?? 'warn'}`}>
          {statusLabel(dashboard?.overallStatus ?? 'sync')}
        </div>
      </section>

      <section className="production-actions" aria-label="Production hardening actions">
        <button type="button" onClick={loadDashboard}>
          Refresh
        </button>
        <button type="button" onClick={runAudit}>
          Run Security Audit
        </button>
        <button type="button" onClick={exportDiagnostics}>
          Export Diagnostics
        </button>
        <button
          type="button"
          onClick={toggleDebug}
          aria-pressed={dashboard?.debugMode.enabled ?? false}
        >
          {dashboard?.debugMode.enabled ? 'Disable Debug' : 'Enable Debug'}
        </button>
        <button
          type="button"
          onClick={() => setHighContrast((value) => !value)}
          aria-pressed={highContrast}
        >
          High Contrast
        </button>
      </section>

      <p className="sr-status" role="status" aria-live="polite">
        {message}
      </p>

      <section className="production-grid">
        <HudPanel title="Release Checks" eyebrow="AUDIT">
          <div className="production-checks">
            {checks.slice(0, 10).map((check) => (
              <article
                className={`production-check production-check--${check.status}`}
                key={`${check.area}-${check.name}`}
              >
                <span>{check.area}</span>
                <strong>{check.name}</strong>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
        </HudPanel>

        <HudPanel title="Crash Recovery" eyebrow="RESILIENCE">
          <div className="production-stat">
            <span>Reports</span>
            <strong>{dashboard?.recovery.reports.length ?? 0}</strong>
          </div>
          <div className="production-stat">
            <span>Safe restart</span>
            <strong>{dashboard?.recovery.restartAvailable ? 'READY' : 'UNAVAILABLE'}</strong>
          </div>
          <ul className="production-list">
            {(dashboard?.recovery.recommendations ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </HudPanel>

        <HudPanel title="Data Protection" eyebrow="LOCAL SECURITY">
          <div className="production-stat">
            <span>Encryption</span>
            <strong>
              {dashboard?.dataProtection.encryption.available ? 'AES-GCM' : 'OFFLINE'}
            </strong>
          </div>
          <div className="production-stat">
            <span>Database checks</span>
            <strong>{dashboard?.dataProtection.databaseIntegrity.length ?? 0}</strong>
          </div>
          <div className="production-stat">
            <span>Backups validated</span>
            <strong>{dashboard?.dataProtection.backupValidation.length ?? 0}</strong>
          </div>
        </HudPanel>

        <HudPanel title="Performance" eyebrow="REGRESSION GUARD">
          <div className="production-stat">
            <span>Uptime</span>
            <strong>{Math.round(dashboard?.performance.uptimeMs ?? 0)} ms</strong>
          </div>
          <div className="production-stat">
            <span>Heap</span>
            <strong>
              {Math.round((dashboard?.performance.memory.heapUsedBytes ?? 0) / 1_048_576)} MB
            </strong>
          </div>
          <div className="production-stat">
            <span>Leak detector</span>
            <strong>{dashboard?.performance.leakDetection.status.toUpperCase() ?? 'SYNC'}</strong>
          </div>
        </HudPanel>

        <HudPanel title="Security Audit" eyebrow="RELEASE GATE">
          <div className="production-stat">
            <span>Passed</span>
            <strong>{audit?.summary.passed ?? 0}</strong>
          </div>
          <div className="production-stat">
            <span>Warnings</span>
            <strong>{audit?.summary.warnings ?? 0}</strong>
          </div>
          <div className="production-stat">
            <span>Failed</span>
            <strong>{audit?.summary.failed ?? 0}</strong>
          </div>
        </HudPanel>

        <HudPanel title="Accessibility" eyebrow="HUMAN FACTORS">
          <div className="production-stat">
            <span>Keyboard</span>
            <strong>{dashboard?.accessibility.keyboardNavigation.toUpperCase() ?? 'SYNC'}</strong>
          </div>
          <div className="production-stat">
            <span>Screen reader</span>
            <strong>{dashboard?.accessibility.screenReaderLabels.toUpperCase() ?? 'SYNC'}</strong>
          </div>
          <div className="production-stat">
            <span>Reduced motion</span>
            <strong>{dashboard?.accessibility.reducedMotion.toUpperCase() ?? 'SYNC'}</strong>
          </div>
        </HudPanel>
      </section>

      {bundle ? (
        <section className="production-bundle hud-card" aria-label="Diagnostic bundle result">
          <strong>{bundle.filename}</strong>
          <span>{bundle.sections.join(' / ')}</span>
          <code>{bundle.content.length.toLocaleString()} bytes ready for local export</code>
        </section>
      ) : null}
    </main>
  );
}
