import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryReview } from '../../src/renderer/src/components/memory/MemoryReview';

const memory = {
  id: 'memory-1',
  kind: 'preference' as const,
  content: 'Prefers concise responses',
  summary: 'Concise responses',
  tags: ['writing'],
  pinned: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('MemoryReview', () => {
  it('shows, searches, edits, pins, disables, exports, and deletes visible memories', async () => {
    const list = vi.spyOn(window.jarvis.memory, 'list').mockResolvedValue([memory]);
    const search = vi
      .spyOn(window.jarvis.memory, 'search')
      .mockResolvedValue([{ memory, score: 1 }]);
    const update = vi
      .spyOn(window.jarvis.memory, 'update')
      .mockResolvedValue({ ...memory, pinned: true });
    const setEnabled = vi
      .spyOn(window.jarvis.memory, 'setEnabled')
      .mockResolvedValue({ enabled: false });
    const remove = vi.spyOn(window.jarvis.memory, 'delete').mockResolvedValue();
    const exportMemory = vi
      .spyOn(window.jarvis.memory, 'export')
      .mockResolvedValue({ filename: 'memory.json', mimeType: 'application/json', content: '{}' });
    const deleteAll = vi.spyOn(window.jarvis.memory, 'deleteAll').mockResolvedValue(1);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const createUrl = vi.fn(() => 'blob:test');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<MemoryReview />);
    expect(await screen.findByText('Prefers concise responses')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search memories'), { target: { value: 'concise' } });
    await waitFor(() => expect(search).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Pin'));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ pinned: true })),
    );
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Edit memory'), {
      target: { value: 'Prefers compact responses' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Prefers compact responses' }),
      ),
    );
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByText('Export JSON'));
    await waitFor(() => expect(exportMemory).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('memory-1'));
    fireEvent.click(screen.getByText('Delete everything'));
    await waitFor(() => expect(deleteAll).toHaveBeenCalled());
    expect(list).toHaveBeenCalled();
    await act(() => Promise.resolve());
  });
});
