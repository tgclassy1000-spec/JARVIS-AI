import { useEffect, useRef, useState } from 'react';

interface ChatComposerProps {
  readonly disabled: boolean;
  readonly streaming: boolean;
  readonly editingContent?: string;
  readonly onSubmit: (content: string) => void;
  readonly onStop: () => void;
  readonly onCancelEdit: () => void;
}

export function ChatComposer({
  disabled,
  streaming,
  editingContent,
  onSubmit,
  onStop,
  onCancelEdit,
}: ChatComposerProps) {
  const [value, setValue] = useState(editingContent ?? '');
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingContent !== undefined) textarea.current?.focus();
  }, [editingContent]);

  const submit = () => {
    const content = value.trim();
    if (!content || disabled || streaming) return;
    onSubmit(content);
    setValue('');
  };

  return (
    <div className="chat-composer">
      {editingContent !== undefined ? (
        <div className="edit-banner">
          EDITING PROMPT
          <button type="button" onClick={onCancelEdit}>
            CANCEL
          </button>
        </div>
      ) : null}
      <div className="chat-composer__input">
        <textarea
          ref={textarea}
          value={value}
          disabled={disabled}
          rows={3}
          maxLength={100_000}
          placeholder="Ask JARVIS anything…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        {streaming ? (
          <button type="button" className="stop-button" onClick={onStop}>
            STOP
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={disabled || !value.trim()}>
            SEND
          </button>
        )}
      </div>
      <span className="composer-hint">ENTER TO SEND · SHIFT+ENTER FOR NEW LINE</span>
    </div>
  );
}
