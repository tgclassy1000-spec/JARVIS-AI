import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OfficeDashboard } from '../../src/renderer/src/components/office/OfficeDashboard';

describe('OfficeDashboard', () => {
  it('renders dashboard data and executes quick add', async () => {
    render(<OfficeDashboard />);
    expect(await screen.findByText('Daily Dashboard')).toBeInTheDocument();
    expect(await screen.findByText(/Open Tasks 1/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Natural language office command'), {
      target: { value: 'Remind me at 5 PM' },
    });
    fireEvent.click(screen.getByText('Quick Add'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Natural-language command completed.'),
    );
  });

  it('creates tasks and switches to search', async () => {
    render(<OfficeDashboard />);
    fireEvent.click(await screen.findByText('tasks'));
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'New task' } });
    fireEvent.click(screen.getByText('Add Task'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Task created.'));
    fireEvent.click(screen.getByText('search'));
    fireEvent.change(screen.getByLabelText('Global office search'), {
      target: { value: 'invoice' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Global office search')).toHaveValue('invoice'),
    );
  });
});
