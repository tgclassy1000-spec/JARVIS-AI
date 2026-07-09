import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type {
  ConversationDetail,
  ConversationMessage,
  GenerationEvent,
} from '../../src/shared/conversation/contracts';
import type { JarvisBridge } from '../../src/shared/platform/ipc';
import { ChatPlatform } from '../../src/renderer/src/components/chat/ChatPlatform';

const timestamp = '2026-01-01T00:00:00.000Z';
const conversation: ConversationDetail = {
  id: 'conversation-1',
  title: 'Test chat',
  createdAt: timestamp,
  updatedAt: timestamp,
  messageCount: 0,
  preview: '',
  messages: [],
};
const userMessage: ConversationMessage = {
  id: 'user-1',
  conversationId: conversation.id,
  role: 'user',
  content: 'Hello JARVIS',
  status: 'complete',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const assistantMessage: ConversationMessage = {
  id: 'assistant-1',
  conversationId: conversation.id,
  role: 'assistant',
  content: '',
  status: 'streaming',
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe('ChatPlatform', () => {
  it('renders optimistic messages and applies streaming events', async () => {
    let eventListener: ((event: GenerationEvent) => void) | undefined;
    const send = vi.fn(() =>
      Promise.resolve({
        generationId: 'generation-1',
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
      }),
    );
    const conversationApi: JarvisBridge['conversation'] = {
      list: () => Promise.resolve([conversation]),
      create: () => Promise.resolve(conversation),
      get: () => Promise.resolve(conversation),
      rename: () => Promise.resolve(conversation),
      delete: () => Promise.resolve(),
      search: () => Promise.resolve([conversation]),
      send,
      edit: send,
      regenerate: send,
      cancel: () => Promise.resolve(true),
      export: () =>
        Promise.resolve({ filename: 'chat.md', mimeType: 'text/markdown', content: '# Chat' }),
      onGenerationEvent: (listener) => {
        eventListener = listener;
        return () => {
          eventListener = undefined;
        };
      },
    };
    Object.defineProperty(window, 'jarvis', {
      configurable: true,
      value: { runtime: window.jarvis.runtime, conversation: conversationApi },
    });

    render(<ChatPlatform />);
    const input = await screen.findByPlaceholderText('Ask JARVIS anything…');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello JARVIS' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledWith({ conversationId: conversation.id, content: 'Hello JARVIS' });
    expect(await screen.findByText('Hello JARVIS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'STOP' })).toBeInTheDocument();

    await act(async () => {
      eventListener?.({
        type: 'delta',
        generationId: 'generation-1',
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        delta: '**Online**',
      });
      await Promise.resolve();
    });
    expect(await screen.findByText('Online')).toBeInTheDocument();

    await act(async () => {
      eventListener?.({
        type: 'complete',
        generationId: 'generation-1',
        conversationId: conversation.id,
        message: { ...assistantMessage, content: '**Online**', status: 'complete' },
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'STOP' })).toBeNull());
  });
});
