import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  GenerationEvent,
  GenerationStarted,
} from '../../../../shared/conversation/contracts';
import { CoreReactor } from '../CoreReactor';
import { HudPanel } from '../HudPanel';
import { ChatWorkspace } from './ChatWorkspace';
import { ConversationSidebar } from './ConversationSidebar';

function replaceMessage(
  conversation: ConversationDetail,
  message: ConversationMessage,
): ConversationDetail {
  const exists = conversation.messages.some((candidate) => candidate.id === message.id);
  const messages = exists
    ? conversation.messages.map((candidate) => (candidate.id === message.id ? message : candidate))
    : [...conversation.messages, message];
  return { ...conversation, messages, messageCount: messages.length, updatedAt: message.updatedAt };
}

export function ChatPlatform() {
  const [conversations, setConversations] = useState<readonly ConversationSummary[]>([]);
  const [conversation, setConversation] = useState<ConversationDetail>();
  const [loading, setLoading] = useState(true);
  const [generationId, setGenerationId] = useState<string>();
  const [error, setError] = useState<string>();
  const [editingMessage, setEditingMessage] = useState<ConversationMessage>();
  const initialized = useRef(false);
  const searchSequence = useRef(0);

  const refreshList = useCallback(async () => {
    setConversations(await window.jarvis.conversation.list());
  }, []);

  const selectConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(undefined);
    try {
      setConversation(await window.jarvis.conversation.get(conversationId));
      setEditingMessage(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const items = await window.jarvis.conversation.list();
        const selected = items[0] ?? (await window.jarvis.conversation.create());
        setConversations(items.length > 0 ? items : [selected]);
        setConversation(await window.jarvis.conversation.get(selected.id));
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Conversation platform failed to initialize.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(
    () =>
      window.jarvis.conversation.onGenerationEvent((event: GenerationEvent) => {
        setConversation((current) => {
          if (!current || current.id !== event.conversationId) return current;
          if (event.type === 'delta') {
            const target = current.messages.find((message) => message.id === event.messageId);
            if (!target) return current;
            return replaceMessage(current, { ...target, content: target.content + event.delta });
          }
          return replaceMessage(current, event.message);
        });

        if (event.type === 'error') setError(event.error.message);
        if (event.type !== 'delta') {
          setGenerationId((active) => (active === event.generationId ? undefined : active));
          void refreshList();
        }
      }),
    [refreshList],
  );

  const begin = (started: GenerationStarted, mode: 'send' | 'edit' | 'regenerate') => {
    setGenerationId(started.generationId);
    setError(undefined);
    setConversation((current) => {
      if (!current || current.id !== started.conversationId) return current;
      if (mode === 'send') {
        return replaceMessage(
          replaceMessage(current, started.userMessage),
          started.assistantMessage,
        );
      }
      const userIndex = current.messages.findIndex(
        (message) => message.id === started.userMessage.id,
      );
      const messages = [
        ...current.messages.slice(0, userIndex),
        started.userMessage,
        started.assistantMessage,
      ];
      return { ...current, messages, messageCount: messages.length };
    });
    setEditingMessage(undefined);
    void refreshList();
  };

  const createConversation = async () => {
    try {
      const created = await window.jarvis.conversation.create();
      setConversation(created);
      setConversations((current) => [created, ...current]);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be created.');
    }
  };

  const submit = async (content: string) => {
    if (!conversation) return;
    try {
      const started = editingMessage
        ? await window.jarvis.conversation.edit({
            conversationId: conversation.id,
            messageId: editingMessage.id,
            content,
          })
        : await window.jarvis.conversation.send({ conversationId: conversation.id, content });
      begin(started, editingMessage ? 'edit' : 'send');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    }
  };

  const regenerate = async (message: ConversationMessage) => {
    if (!conversation || generationId) return;
    try {
      const started = await window.jarvis.conversation.regenerate({
        conversationId: conversation.id,
        assistantMessageId: message.id,
      });
      begin(started, 'regenerate');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Response could not be regenerated.');
    }
  };

  const stop = async () => {
    if (!generationId) return;
    try {
      await window.jarvis.conversation.cancel(generationId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Generation could not be stopped.');
    }
  };

  const rename = async (id: string, title: string) => {
    try {
      const renamed = await window.jarvis.conversation.rename({ conversationId: id, title });
      setConversations((current) => current.map((item) => (item.id === id ? renamed : item)));
      setConversation((current) => (current?.id === id ? { ...current, title } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be renamed.');
    }
  };

  const remove = async (id: string) => {
    try {
      await window.jarvis.conversation.delete(id);
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (conversation?.id === id) {
        const next = remaining[0] ?? (await window.jarvis.conversation.create());
        if (remaining.length === 0) setConversations([next]);
        setConversation(await window.jarvis.conversation.get(next.id));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be deleted.');
    }
  };

  const search = async (query: string) => {
    const sequence = ++searchSequence.current;
    try {
      const results = await window.jarvis.conversation.search(query);
      if (sequence === searchSequence.current) setConversations(results);
    } catch (cause) {
      if (sequence === searchSequence.current) {
        setError(cause instanceof Error ? cause.message : 'Conversation search failed.');
      }
    }
  };

  const exportConversation = async (format: 'markdown' | 'json') => {
    if (!conversation) return;
    try {
      const exported = await window.jarvis.conversation.export({
        conversationId: conversation.id,
        format,
      });
      const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = exported.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversation could not be exported.');
    }
  };

  return (
    <Fragment>
      <HudPanel title="Conversation Archive" eyebrow="SESSION MATRIX">
        <ConversationSidebar
          conversations={conversations}
          selectedId={conversation?.id}
          onSelect={(id) => void selectConversation(id)}
          onCreate={() => void createConversation()}
          onRename={(id, title) => void rename(id, title)}
          onDelete={(id) => void remove(id)}
          onSearch={(query) => void search(query)}
        />
      </HudPanel>
      <section className="command-center" aria-label="AI conversation center">
        <CoreReactor state={generationId ? 'online' : 'standby'} />
        <HudPanel title="AI Conversation" eyebrow="GEMINI SECURE CHANNEL" className="chat-panel">
          <ChatWorkspace
            conversation={conversation}
            loading={loading}
            streaming={Boolean(generationId)}
            error={error}
            editingMessage={editingMessage}
            onSubmit={(content) => void submit(content)}
            onStop={() => void stop()}
            onEdit={setEditingMessage}
            onCancelEdit={() => setEditingMessage(undefined)}
            onRegenerate={(message) => void regenerate(message)}
            onExport={(format) => void exportConversation(format)}
            onDismissError={() => setError(undefined)}
          />
        </HudPanel>
      </section>
    </Fragment>
  );
}
