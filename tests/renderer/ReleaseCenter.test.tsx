import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ReleaseCenter } from '../../src/renderer/src/components/release/ReleaseCenter';

describe('ReleaseCenter', () => {
  it('renders release engineering status and actions', async () => {
    render(<ReleaseCenter />);

    expect(await screen.findByText('Public Release Engineering')).toBeInTheDocument();
    expect(screen.getByText('Installer Packaging')).toBeInTheDocument();
    expect(screen.getByText('Code Signing')).toBeInTheDocument();
    expect(screen.getByText('QA Gates')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Complete First Run'));
    await waitFor(() =>
      expect(screen.getByText('First-run wizard completed.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Toggle Contrast'));
    await waitFor(() =>
      expect(screen.getByText('Appearance changed to high-contrast.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Check Updates'));
    await waitFor(() =>
      expect(screen.getByText('Update check completed with status current.')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Export Backup'));
    await waitFor(() =>
      expect(
        screen.getByText('Backup artifact ready: jarvis-backup-test.json'),
      ).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Backup path'), {
      target: { value: 'A:\\J.A.R.V.I.S\\release\\jarvis-backup-test.json' },
    });
    fireEvent.click(screen.getByText('Validate Import'));
    await waitFor(() =>
      expect(
        screen.getAllByText('Backup is valid. Confirm restore to stage files for the next restart.')
          .length,
      ).toBeGreaterThan(0),
    );
  });
});
