interface SystemMetricProps {
  readonly label: string;
  readonly value: string;
  readonly active?: boolean;
}

export function SystemMetric({ label, value, active = false }: SystemMetricProps) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={active ? 'metric__value--active' : ''}>{value}</strong>
      <i aria-hidden="true">
        <b style={{ width: active ? '100%' : '18%' }} />
      </i>
    </div>
  );
}
