interface CoreReactorProps {
  readonly state: 'standby' | 'online';
}

export function CoreReactor({ state }: CoreReactorProps) {
  return (
    <div className="core-stage" aria-label={`JARVIS core ${state}`}>
      <div className="radar" aria-hidden="true">
        <span className="radar__ring radar__ring--outer" />
        <span className="radar__ring radar__ring--middle" />
        <span className="radar__ring radar__ring--inner" />
        <span className="radar__sweep" />
      </div>
      <div className={`reactor reactor--${state}`} aria-hidden="true">
        <span className="reactor__orbit reactor__orbit--one" />
        <span className="reactor__orbit reactor__orbit--two" />
        <span className="reactor__core" />
      </div>
      <div className="core-stage__label">
        <span className="signal-dot" /> {state === 'online' ? 'CORE ONLINE' : 'CORE STANDBY'}
      </div>
    </div>
  );
}
