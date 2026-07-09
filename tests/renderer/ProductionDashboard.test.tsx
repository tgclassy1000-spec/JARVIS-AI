import { fireEvent, render, screen } from '@testing-library/react';

import { ProductionDashboard } from '../../src/renderer/src/components/production/ProductionDashboard';

describe('ProductionDashboard', () => {
  it('shows production readiness and runs release actions accessibly', async () => {
    render(<ProductionDashboard />);

    expect(await screen.findByText('Production Hardening')).toBeInTheDocument();
    expect(await screen.findByText('Crash recovery')).toBeInTheDocument();
    expect(await screen.findByText('AES-GCM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run Security Audit' }));
    expect(await screen.findByText('Release security audit completed.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export Diagnostics' }));
    expect((await screen.findAllByText(/jarvis-diagnostics-test.json/)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Enable Debug' }));
    expect(await screen.findByText('Debug mode enabled.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'High Contrast' }));
    expect(document.documentElement).toHaveClass('high-contrast');
  });
});
