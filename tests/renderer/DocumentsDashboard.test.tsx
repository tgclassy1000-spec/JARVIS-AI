import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DocumentsDashboard } from '../../src/renderer/src/components/documents/DocumentsDashboard';

describe('DocumentsDashboard', () => {
  it('renders document dashboard data and analyzes a selected document', async () => {
    render(<DocumentsDashboard />);
    expect(await screen.findByText('Document Intelligence')).toBeInTheDocument();
    expect(await screen.findByText('Module 7 Brief.md')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Analyze'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Document analysis complete.'),
    );
    expect(screen.getByText('Analysis for summarize')).toBeInTheDocument();
  });

  it('imports by explicit path and searches indexed documents', async () => {
    render(<DocumentsDashboard />);
    fireEvent.change(screen.getByLabelText('Document file path'), {
      target: { value: 'A:\\J.A.R.V.I.S\\brief.md' },
    });
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Document imported and indexed.'),
    );
    fireEvent.change(screen.getByLabelText('Document search'), { target: { value: 'module' } });
    expect(await screen.findByText('Module 7 document intelligence brief')).toBeInTheDocument();
  });
});
