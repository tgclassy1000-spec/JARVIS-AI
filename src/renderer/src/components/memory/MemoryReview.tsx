import { useCallback, useEffect, useState } from 'react';

import {
  MEMORY_KINDS,
  type MemoryKind,
  type MemoryRecord,
} from '../../../../shared/memory/contracts';
import { HudPanel } from '../HudPanel';

function download(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MemoryReview() {
  const [memories, setMemories] = useState<readonly MemoryRecord[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MemoryKind>();
  const [editing, setEditing] = useState<MemoryRecord>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [items, settings] = await Promise.all([
        query
          ? window.jarvis.memory
              .search({ query, kind, mode: 'hybrid' })
              .then((results) => results.map((result) => result.memory))
          : window.jarvis.memory.list(kind),
        window.jarvis.memory.settings(),
      ]);
      setMemories(items);
      setEnabled(settings.enabled);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory vault could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = async (memory: MemoryRecord, changes: { content?: string; pinned?: boolean }) => {
    try {
      await window.jarvis.memory.update({ id: memory.id, ...changes });
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory could not be updated.');
    }
  };

  const remove = async (memory: MemoryRecord) => {
    if (!window.confirm(`Forget “${memory.summary}”?`)) return;
    try {
      await window.jarvis.memory.delete(memory.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory could not be deleted.');
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Permanently delete every JARVIS memory?')) return;
    try {
      await window.jarvis.memory.deleteAll();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory vault could not be cleared.');
    }
  };

  const exportAll = async () => {
    try {
      const result = await window.jarvis.memory.export();
      download(result.filename, result.content, result.mimeType);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory export failed.');
    }
  };

  return (
    <section className="memory-page" aria-label="Personal memory review">
      <HudPanel title="Memory Controls" eyebrow="PRIVACY CORE">
        <div className="memory-controls">
          <label className="memory-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                void window.jarvis.memory
                  .setEnabled(event.target.checked)
                  .then((settings) => setEnabled(settings.enabled))
                  .catch((cause: unknown) =>
                    setError(cause instanceof Error ? cause.message : 'Setting failed.'),
                  )
              }
            />
            <span>{enabled ? 'Memory enabled' : 'Memory disabled'}</span>
          </label>
          <p>
            Every saved memory is visible here. Disabling memory stops recall and automatic saving.
          </p>
          <button className="hud-button" type="button" onClick={() => void exportAll()}>
            Export JSON
          </button>
          <button
            className="hud-button hud-button--danger"
            type="button"
            onClick={() => void deleteAll()}
          >
            Delete everything
          </button>
        </div>
      </HudPanel>

      <HudPanel
        title="Personal Memory Vault"
        eyebrow={`${memories.length} VISIBLE RECORDS`}
        className="memory-vault"
      >
        <div className="memory-toolbar">
          <input
            aria-label="Search memories"
            placeholder="Search memories…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Memory category"
            value={kind ?? ''}
            onChange={(event) =>
              setKind((event.target.value || undefined) as MemoryKind | undefined)
            }
          >
            <option value="">All categories</option>
            {MEMORY_KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="chat-error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <p className="memory-empty">Scanning memory vault…</p>
        ) : memories.length === 0 ? (
          <p className="memory-empty">No visible memories match this view.</p>
        ) : (
          <div className="memory-grid">
            {memories.map((memory) => (
              <article
                className={`memory-card${memory.pinned ? ' memory-card--pinned' : ''}`}
                key={memory.id}
              >
                <div className="memory-card__meta">
                  <span>{memory.kind}</span>
                  <time>{new Date(memory.updatedAt).toLocaleDateString()}</time>
                </div>
                {editing?.id === memory.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get('content');
                      void update(memory, { content: typeof value === 'string' ? value : '' });
                    }}
                  >
                    <textarea
                      name="content"
                      defaultValue={memory.content}
                      aria-label="Edit memory"
                      required
                    />
                    <button className="hud-button" type="submit">
                      Save
                    </button>
                    <button
                      className="hud-button"
                      type="button"
                      onClick={() => setEditing(undefined)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p>{memory.content}</p>
                )}
                <div className="memory-tags">
                  {memory.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <div className="memory-card__actions">
                  <button
                    type="button"
                    onClick={() => void update(memory, { pinned: !memory.pinned })}
                  >
                    {memory.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button type="button" onClick={() => setEditing(memory)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void remove(memory)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </HudPanel>
    </section>
  );
}
