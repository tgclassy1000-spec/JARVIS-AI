import { useEffect, useRef } from 'react';

import type {
  ConversationDetail,
  ConversationMessage,
} from '../../../../shared/conversation/contracts';
import { ChatComposer } from './ChatComposer';
import { ChatMessageBubble } from './ChatMessageBubble';

interface ChatWorkspaceProps {
  readonly conversation?: ConversationDetail;
  readonly loading: boolean;
  readonly streaming: boolean;
  readonly error?: string;
  readonly editingMessage?: ConversationMessage;
  readonly onSubmit: (content: string) => void;
  readonly onStop: () => void;
  readonly onEdit: (message: ConversationMessage) => void;
  readonly onCancelEdit: () => void;
  readonly onRegenerate: (message: ConversationMessage) => void;
  readonly onExport: (format: 'markdown' | 'json') => void;
  readonly onDismissError: () => void;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [props.conversation?.messages]);

  return (
    <div className="chat-workspace">
      <header className="chat-workspace__header">
        <div>
          <strong>{props.conversation?.title ?? 'INITIALIZING SESSION'}</strong>
          <span>{props.conversation?.messageCount ?? 0} MESSAGES · GEMINI 2.5 FLASH</span>
        </div>
        <div>
          <button
            type="button"
            disabled={!props.conversation}
            onClick={() => props.onExport('markdown')}
          >
            EXPORT MD
          </button>
          <button
            type="button"
            disabled={!props.conversation}
            onClick={() => props.onExport('json')}
          >
            EXPORT JSON
          </button>
        </div>
      </header>
      {props.error ? (
        <div className="chat-error" role="alert">
          <span>{props.error}</span>
          <button type="button" onClick={props.onDismissError}>
            DISMISS
          </button>
        </div>
      ) : null}
      <div className="chat-timeline" ref={scrollRef}>
        {props.loading ? <div className="chat-loading">SYNCHRONIZING CONVERSATION…</div> : null}
        {!props.loading && props.conversation?.messages.length === 0 ? (
          <div className="chat-empty">
            <strong>J.A.R.V.I.S. ONLINE</strong>
            <p>Secure conversation channel ready. What shall we work on?</p>
          </div>
        ) : null}
        {props.conversation?.messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            onEdit={props.onEdit}
            onRegenerate={props.onRegenerate}
          />
        ))}
        {props.streaming ? (
          <div className="generation-loader">
            <i />
            <i />
            <i /> JARVIS IS THINKING
          </div>
        ) : null}
      </div>
      <ChatComposer
        key={props.editingMessage?.id ?? 'new-message'}
        disabled={!props.conversation || props.loading}
        streaming={props.streaming}
        editingContent={props.editingMessage?.content}
        onSubmit={props.onSubmit}
        onStop={props.onStop}
        onCancelEdit={props.onCancelEdit}
      />
    </div>
  );
}
