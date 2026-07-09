import type { PropsWithChildren, ReactNode } from 'react';

interface HudPanelProps extends PropsWithChildren {
  readonly title: string;
  readonly eyebrow?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function HudPanel({ title, eyebrow, action, className = '', children }: HudPanelProps) {
  return (
    <section className={`hud-panel ${className}`.trim()}>
      <header className="hud-panel__header">
        <div>
          {eyebrow ? <span className="hud-panel__eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      <div className="hud-panel__body">{children}</div>
    </section>
  );
}
