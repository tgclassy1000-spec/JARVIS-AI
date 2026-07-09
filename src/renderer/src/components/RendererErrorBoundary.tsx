import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RendererErrorBoundaryProps {
  readonly children: ReactNode;
}

interface RendererErrorBoundaryState {
  readonly error: Error | null;
  readonly componentStack: string;
}

interface RendererStartupGuardProps {
  readonly children: ReactNode;
  readonly preloadAvailable: boolean;
}

export function RendererStartupGuard({
  children,
  preloadAvailable,
}: RendererStartupGuardProps): ReactNode {
  if (!preloadAvailable) {
    throw new Error(
      'Preload unavailable: window.jarvis was not exposed before React startup. Check the BrowserWindow preload path, context isolation, and preload execution logs.',
    );
  }
  return children;
}

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  public state: RendererErrorBoundaryState = {
    error: null,
    componentStack: '',
  };

  public static getDerivedStateFromError(error: Error): Partial<RendererErrorBoundaryState> {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[JARVIS renderer] React render failure', error.stack ?? error.message, info);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  public render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="renderer-crash" role="alert">
        <section>
          <span className="eyebrow">RENDERER RECOVERY</span>
          <h1>The renderer crashed</h1>
          <p>JARVIS could not start its interface. The diagnostic stack is shown below.</p>
          <pre>{[error.stack ?? error.message, componentStack].filter(Boolean).join('\n')}</pre>
        </section>
      </main>
    );
  }
}
