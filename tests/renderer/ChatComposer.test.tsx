import { fireEvent, render, screen } from '@testing-library/react';

import { ChatComposer } from '../../src/renderer/src/components/chat/ChatComposer';

describe('ChatComposer', () => {
  it('sends with Enter, preserves Shift+Enter, edits, and stops generation', () => {
    const submit = vi.fn();
    const stop = vi.fn();
    const { rerender } = render(
      <ChatComposer
        disabled={false}
        streaming={false}
        onSubmit={submit}
        onStop={stop}
        onCancelEdit={vi.fn()}
      />,
    );
    const textarea = screen.getByPlaceholderText('Ask JARVIS anything…');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(submit).toHaveBeenCalledWith('Hello');

    rerender(
      <ChatComposer
        disabled={false}
        streaming
        editingContent="Edited"
        onSubmit={submit}
        onStop={stop}
        onCancelEdit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'STOP' }));
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.getByText('EDITING PROMPT')).toBeInTheDocument();
  });
});
