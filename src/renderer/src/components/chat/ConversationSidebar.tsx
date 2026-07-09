import { useState } from 'react';

import type { ConversationSummary } from '../../../../shared/conversation/contracts';

interface ConversationSidebarProps {
  readonly conversations: readonly ConversationSummary[];
  readonly selectedId?: string;
  readonly onSelect: (id: string) => void;
  readonly onCreate: () => void;
  readonly onRename: (id: string, title: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onSearch: (query: string) => void;
}

export function ConversationSidebar({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSearch,
}: ConversationSidebarProps) {
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string>();

  return (
    <div className="conversation-sidebar">
      <button type="button" className="new-chat-button" onClick={onCreate}>
        + NEW CHAT
      </button>
      <label className="conversation-search">
        <span>Search conversations</span>
        <input placeholder="SEARCH ARCHIVE…" onChange={(event) => onSearch(event.target.value)} />
      </label>
      <div className="conversation-list">
        {conversations.map((conversation) => (
          <div
            className={`conversation-item ${conversation.id === selectedId ? 'conversation-item--active' : ''}`}
            key={conversation.id}
          >
            {renamingId === conversation.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (renameValue.trim()) onRename(conversation.id, renameValue);
                  setRenamingId(undefined);
                }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  maxLength={200}
                />
              </form>
            ) : (
              <button
                type="button"
                className="conversation-item__main"
                onClick={() => onSelect(conversation.id)}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.preview || 'No messages yet'}</span>
              </button>
            )}
            <div className="conversation-item__actions">
              <button
                type="button"
                aria-label={`Rename ${conversation.title}`}
                onClick={() => {
                  setRenamingId(conversation.id);
                  setRenameValue(conversation.title);
                }}
              >
                RENAME
              </button>
              {deletingId === conversation.id ? (
                <>
                  <button type="button" onClick={() => onDelete(conversation.id)}>
                    CONFIRM
                  </button>
                  <button type="button" onClick={() => setDeletingId(undefined)}>
                    CANCEL
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setDeletingId(conversation.id)}>
                  DELETE
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
