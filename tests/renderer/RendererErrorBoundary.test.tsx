import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { RendererErrorBoundary } from '../../src/renderer/src/components/RendererErrorBoundary';

function BrokenRenderer(): ReactNode {
  throw new Error('Renderer startup failed for test.');
}

describe('RendererErrorBoundary', () => {
  it('shows a visible diagnostic instead of a black window', () => {
    const originalError = console.error;
    console.error = () => undefined;

    try {
      render(
        <RendererErrorBoundary>
          <BrokenRenderer />
        </RendererErrorBoundary>,
      );
    } finally {
      console.error = originalError;
    }

    expect(screen.getByRole('alert')).toHaveTextContent('The renderer crashed');
    expect(screen.getByText(/Renderer startup failed for test/)).toBeInTheDocument();
  });
});
