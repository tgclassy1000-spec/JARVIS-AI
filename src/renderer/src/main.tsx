import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { RendererErrorBoundary, RendererStartupGuard } from './components/RendererErrorBoundary';
import './styles/index.css';

function errorDetails(reason: unknown): string {
  if (reason instanceof Error) return reason.stack ?? reason.message;
  return String(reason);
}

function reportRendererFailure(reason: string, detail: string): void {
  console.error(`[JARVIS renderer] ${reason}`, detail);

  if (typeof window.jarvis === 'undefined') return;
  void window.jarvis.production
    .recordRendererCrash({
      kind: 'renderer-crash',
      reason,
      message: detail,
      processType: 'renderer',
    })
    .catch((error: unknown) => {
      console.error('[JARVIS renderer] Crash report delivery failed', errorDetails(error));
    });
}

window.onerror = (event, _source, _line, _column, error) => {
  reportRendererFailure('renderer-error', errorDetails(error ?? event));
  return false;
};

window.onunhandledrejection = (event) => {
  reportRendererFailure('renderer-unhandled-rejection', errorDetails(event.reason));
};

console.info('[JARVIS renderer] Renderer started');

const root = document.getElementById('root');

if (!root) throw new Error('Renderer root element was not found.');

const preloadAvailable = typeof window.jarvis !== 'undefined';
console.info(`[JARVIS renderer] Preload available: ${String(preloadAvailable)}`);
if (!preloadAvailable) {
  console.error(
    '[JARVIS renderer] Preload unavailable: window.jarvis was not exposed before React startup.',
  );
}

createRoot(root).render(
  <StrictMode>
    <RendererErrorBoundary>
      <RendererStartupGuard preloadAvailable={preloadAvailable}>
        <App />
      </RendererStartupGuard>
    </RendererErrorBoundary>
  </StrictMode>,
);

console.info('[JARVIS renderer] Root mounted');
