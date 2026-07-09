import type { ConversationMessage } from '../../../../shared/conversation/contracts';
import { MarkdownMessage } from './MarkdownMessage';

interface ChatMessageBubbleProps {
  readonly message: ConversationMessage;
  readonly onEdit: (message: ConversationMessage) => void;
  readonly onRegenerate: (message: ConversationMessage) => void;
}

export function ChatMessageBubble({ message, onEdit, onRegenerate }: ChatMessageBubbleProps) {
  const assistant = message.role === 'assistant';
  return (
    <article className={`chat-message chat-message--${message.role}`} data-status={message.status}>
      <header>
        <span>{assistant ? 'JARVIS' : 'YOU'}</span>
        <time dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </header>
      <div className="chat-message__content">
        {assistant ? <MarkdownMessage content={message.content} /> : <p>{message.content}</p>}
        {message.status === 'streaming' ? (
          <span className="typing-cursor" aria-label="Streaming" />
        ) : null}
      </div>
      <footer>
        {message.role === 'user' && message.status === 'complete' ? (
          <button type="button" onClick={() => onEdit(message)}>
            EDIT PROMPT
          </button>
        ) : null}
        {assistant && message.status !== 'streaming' ? (
          <button type="button" onClick={() => onRegenerate(message)}>
            REGENERATE
          </button>
        ) : null}
        <span>{message.status.toUpperCase()}</span>
      </footer>
    </article>
  );
}
