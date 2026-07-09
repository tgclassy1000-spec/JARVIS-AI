// @vitest-environment node

import { SqliteConversationRepository } from '../../src/main/conversation/persistence/sqlite-conversation-repository';

describe('SqliteConversationRepository', () => {
  function repository() {
    let id = 0;
    let tick = 0;
    return new SqliteConversationRepository(
      ':memory:',
      () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
      () => `id-${++id}`,
    );
  }

  it('persists, lists, renames, searches, and deletes conversations', () => {
    const repo = repository();
    const first = repo.create('Alpha');
    const second = repo.create('Beta');
    expect(repo.list().map((item) => item.title)).toEqual(['Beta', 'Alpha']);

    const renamed = repo.rename(first.id, 'Renamed');
    expect(renamed?.title).toBe('Renamed');
    expect(repo.rename('missing', 'Nope')).toBeUndefined();

    repo.addMessage({
      conversationId: first.id,
      role: 'user',
      content: 'searchable phrase',
      status: 'complete',
    });
    expect(repo.search('searchable')).toHaveLength(1);
    expect(repo.search('Beta')[0]?.id).toBe(second.id);
    expect(repo.delete(second.id)).toBe(true);
    expect(repo.delete(second.id)).toBe(false);
    repo.close();
  });

  it('auto-saves messages, updates status, and maintains summaries', () => {
    const repo = repository();
    const conversation = repo.create('Chat');
    const user = repo.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello',
      status: 'complete',
    });
    const assistant = repo.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
    });
    const updated = repo.updateMessage(assistant.id, { content: 'Hi', status: 'complete' });

    expect(updated?.content).toBe('Hi');
    expect(repo.getMessage(user.id)?.role).toBe('user');
    expect(repo.updateMessage(assistant.id, { content: 'Hello again' })?.status).toBe('complete');
    expect(repo.updateMessage(assistant.id, { status: 'error' })?.content).toBe('Hello again');
    expect(repo.updateMessage('missing', { content: 'none' })).toBeUndefined();
    expect(repo.get(conversation.id)?.messages).toHaveLength(2);
    expect(repo.get('missing')).toBeUndefined();

    repo.setSummary(conversation.id, 'Summary');
    expect(repo.getSummary(conversation.id)).toBe('Summary');
    repo.setSummary(conversation.id, undefined);
    expect(repo.getSummary(conversation.id)).toBeUndefined();
    repo.close();
  });

  it('truncates later history inclusively and exclusively', () => {
    const repo = repository();
    const conversation = repo.create('Chat');
    const first = repo.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'First',
      status: 'complete',
    });
    const second = repo.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Second',
      status: 'complete',
    });
    expect(second.content).toBe('Second');
    repo.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Third',
      status: 'complete',
    });

    repo.deleteFromMessage(conversation.id, first.id, false);
    expect(repo.get(conversation.id)?.messages.map((item) => item.content)).toEqual(['First']);
    const replacement = repo.addMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Replacement',
      status: 'complete',
    });
    repo.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Later',
      status: 'complete',
    });
    repo.deleteFromMessage(conversation.id, replacement.id, true);
    expect(repo.get(conversation.id)?.messages).toHaveLength(1);
    repo.deleteFromMessage(conversation.id, 'missing', true);
    repo.close();
  });
});
