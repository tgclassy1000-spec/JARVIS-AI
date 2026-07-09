export interface ModuleSummary {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly status: 'foundation' | 'queued';
}

interface ModuleListProps {
  readonly modules: readonly ModuleSummary[];
}

export function ModuleList({ modules }: ModuleListProps) {
  return (
    <ul className="module-list">
      {modules.map((module) => (
        <li className="module-row" key={module.id}>
          <div>
            <strong>{module.label}</strong>
            <span>{module.detail}</span>
          </div>
          <span className={`module-status module-status--${module.status}`}>
            {module.status === 'foundation' ? 'READY' : 'QUEUED'}
          </span>
        </li>
      ))}
    </ul>
  );
}
