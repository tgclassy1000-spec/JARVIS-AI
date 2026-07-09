import { fireEvent, render, screen } from '@testing-library/react';

import { App } from '../../src/renderer/src/App';

describe('JARVIS foundation shell', () => {
  it('renders the release shell and keeps prior modules available', async () => {
    render(<App />);

    expect(screen.getByText('J.A.R.V.I.S.')).toBeInTheDocument();
    expect(screen.getByText('PUBLIC RELEASE SYSTEMS ONLINE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Production' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plugins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desktop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Web Intel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Office' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Memory Vault' })).toBeInTheDocument();
    expect(await screen.findByText('Public Release Engineering')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Production' }));
    expect(await screen.findByText('Production Hardening')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Plugins' }));
    expect(await screen.findByText('Plugin Dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Available Skills')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
    expect(await screen.findByText('Desktop Dashboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Web Intel' }));
    expect(await screen.findByText('Web Intelligence')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(await screen.findByText('Document Intelligence')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conversation' }));
    expect(await screen.findByPlaceholderText(/Ask JARVIS anything/)).toBeEnabled();
    expect(await screen.findByText('ELECTRON test-runtime')).toBeInTheDocument();
  });
});
