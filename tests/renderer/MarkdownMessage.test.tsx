import { fireEvent, render, screen } from '@testing-library/react';

import { MarkdownMessage } from '../../src/renderer/src/components/chat/MarkdownMessage';

describe('MarkdownMessage', () => {
  it('renders GFM tables and syntax-highlighted code with copy controls', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(
      <MarkdownMessage
        content={'| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst answer = 42;\n```'}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('ts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'COPY' }));
    expect(writeText).toHaveBeenCalledWith('const answer = 42;\n');
    expect(await screen.findByText('COPIED')).toBeInTheDocument();
  });
});
