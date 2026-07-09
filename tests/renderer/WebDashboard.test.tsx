import { fireEvent, render, screen } from '@testing-library/react';

import { WebDashboard } from '../../src/renderer/src/components/web/WebDashboard';

describe('WebDashboard', () => {
  it('runs web assistant, search, weather, news and currency actions', async () => {
    render(<WebDashboard />);

    expect(await screen.findByText('Latest AI news')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Web' }));
    expect(await screen.findByText('Web answer grounded.')).toBeInTheDocument();
    expect(await screen.findByText(/Grounded answer for Latest AI news/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Search complete.')).toBeInTheDocument();
    expect((await screen.findAllByText('JARVIS web intelligence')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    expect(await screen.findByText('Weather updated.')).toBeInTheDocument();
    expect(await screen.findByText(/Clear sky/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Headlines' }));
    expect(await screen.findByText('News feed updated.')).toBeInTheDocument();
    expect(
      (await screen.findAllByText('AI systems gain better web grounding')).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByText('Currency converted.')).toBeInTheDocument();
    expect(await screen.findByText(/1 USD = 83.00 INR/)).toBeInTheDocument();
  });
});
