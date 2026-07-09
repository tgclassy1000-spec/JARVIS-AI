import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  DocumentAnalysisAction,
  DocumentDashboard as DocumentDashboardData,
  DocumentDetail,
  DocumentMetadata,
  DocumentSearchResult,
} from '../../../../shared/documents/contracts';
import { HudPanel } from '../HudPanel';
import { MarkdownMessage } from '../chat/MarkdownMessage';

const analysisActions: readonly DocumentAnalysisAction[] = [
  'summarize',
  'key-points',
  'action-items',
  'dates',
  'emails',
  'tables',
  'report',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortDate(value?: string): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function DocumentsDashboard() {
  const [dashboard, setDashboard] = useState<DocumentDashboardData | null>(null);
  const [documents, setDocuments] = useState<readonly DocumentMetadata[]>([]);
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [filePath, setFilePath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly DocumentSearchResult[]>([]);
  const [analysisAction, setAnalysisAction] = useState<DocumentAnalysisAction>('summarize');
  const [question, setQuestion] = useState('');
  const [analysis, setAnalysis] = useState('Import a document, then ask JARVIS to inspect it.');
  const [status, setStatus] = useState('Document intelligence ready.');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    const [nextDashboard, nextDocuments] = await Promise.all([
      window.jarvis.documents.dashboard(),
      window.jarvis.documents.list(),
    ]);
    setDashboard(nextDashboard);
    setDocuments(nextDocuments);
    if (!selected && nextDocuments[0]) {
      setSelected(await window.jarvis.documents.get(nextDocuments[0].id));
    }
  }, [selected]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Document refresh failed.');
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const query = searchQuery.trim();
    const timer = window.setTimeout(() => {
      if (!query) {
        setSearchResults([]);
        return;
      }
      void window.jarvis.documents
        .search({ query, mode: 'hybrid', limit: 20 })
        .then(setSearchResults)
        .catch((error: unknown) => {
          setStatus(error instanceof Error ? error.message : 'Document search failed.');
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const selectedMetadata = useMemo(
    () => (selected ? documents.find((document) => document.id === selected.id) : undefined),
    [documents, selected],
  );

  const run = async (action: () => Promise<void>, message: string): Promise<void> => {
    setLoading(true);
    try {
      await action();
      await refresh();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Document action failed.');
    } finally {
      setLoading(false);
    }
  };

  const importDocument = () =>
    run(async () => {
      if (!filePath.trim()) return;
      const detail = await window.jarvis.documents.import({ filePath, pin: false });
      setSelected(detail);
      setFilePath('');
    }, 'Document imported and indexed.');

  const selectDocument = (documentId: string) =>
    run(async () => {
      setSelected(await window.jarvis.documents.get(documentId));
    }, 'Document loaded.');

  const analyze = () =>
    run(async () => {
      if (!selected) return;
      const result = await window.jarvis.documents.analyze({
        documentId: selected.id,
        action: analysisAction,
        question: analysisAction === 'question' ? question : undefined,
      });
      setAnalysis(result.content);
    }, 'Document analysis complete.');

  return (
    <main className="documents-shell">
      <HudPanel title="Document Intelligence" eyebrow="MODULE 07">
        <div className="documents-import">
          <input
            aria-label="Document file path"
            placeholder="Paste a secure local file path: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, JSON, PNG, JPG, WEBP"
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void importDocument();
            }}
          />
          <button type="button" disabled={loading} onClick={() => void importDocument()}>
            Import
          </button>
        </div>
        <p className="documents-status" role="status">
          {loading ? 'Indexing document matrix…' : status}
        </p>
      </HudPanel>

      <section className="documents-grid">
        <HudPanel title="Recent Documents" eyebrow="INDEX">
          <div className="documents-stats">
            <span>{dashboard?.totalDocuments ?? 0} documents</span>
            <span>{dashboard?.totalChunks ?? 0} chunks</span>
            <span>{dashboard?.supportedFormats.length ?? 0} formats</span>
          </div>
          <DocumentList documents={documents} selectedId={selected?.id} onSelect={selectDocument} />
        </HudPanel>

        <HudPanel title="Preview" eyebrow={selected?.format.toUpperCase() ?? 'NO FILE'}>
          {selected ? (
            <article className="document-preview">
              <h3>{selected.title}</h3>
              <p>{selected.preview}</p>
              <div className="document-metadata">
                <span>{formatBytes(selected.byteSize)}</span>
                <span>{selected.wordCount} words</span>
                <span>{selected.tableCount} tables</span>
                <span>OCR {selected.ocrStatus}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    const metadata = await window.jarvis.documents.pin({
                      documentId: selected.id,
                      pinned: !(selectedMetadata?.pinned ?? selected.pinned),
                    });
                    setDocuments((current) =>
                      current.map((document) =>
                        document.id === metadata.id ? metadata : document,
                      ),
                    );
                  }, 'Pinned state updated.')
                }
              >
                {(selectedMetadata?.pinned ?? selected.pinned) ? 'Unpin' : 'Pin'}
              </button>
            </article>
          ) : (
            <p className="documents-empty">No document selected.</p>
          )}
        </HudPanel>

        <HudPanel title="AI Summary" eyebrow="GEMINI + LOCAL FALLBACK">
          <div className="documents-ai-controls">
            <select
              aria-label="Document analysis action"
              value={analysisAction}
              onChange={(event) => setAnalysisAction(event.target.value as DocumentAnalysisAction)}
            >
              {analysisActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
              <option value="question">question</option>
            </select>
            <input
              aria-label="Ask document"
              placeholder="Ask this document a question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="button" disabled={!selected || loading} onClick={() => void analyze()}>
              Analyze
            </button>
          </div>
          <MarkdownMessage content={analysis} />
        </HudPanel>

        <HudPanel title="Global Document Search" eyebrow="KEYWORD + SEMANTIC">
          <input
            className="documents-search"
            aria-label="Document search"
            placeholder="Search indexed documents"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <ul className="documents-results">
            {searchResults.map((result) => (
              <li key={`${result.document.id}-${result.chunk?.id ?? 'doc'}`}>
                <button type="button" onClick={() => void selectDocument(result.document.id)}>
                  <strong>{result.document.title}</strong>
                  <span>{result.match || result.document.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </HudPanel>
      </section>
    </main>
  );
}

function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  readonly documents: readonly DocumentMetadata[];
  readonly selectedId?: string;
  readonly onSelect: (documentId: string) => Promise<void>;
}) {
  if (documents.length === 0) return <p className="documents-empty">No documents indexed yet.</p>;
  return (
    <ul className="documents-list">
      {documents.map((document) => (
        <li key={document.id}>
          <button
            className={selectedId === document.id ? 'active' : ''}
            type="button"
            onClick={() => void onSelect(document.id)}
          >
            <strong>
              {document.pinned ? '★ ' : ''}
              {document.title}
            </strong>
            <span>
              {document.format.toUpperCase()} ·{' '}
              {shortDate(document.lastOpenedAt ?? document.updatedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
