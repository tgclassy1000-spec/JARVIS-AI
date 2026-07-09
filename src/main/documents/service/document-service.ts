import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename } from 'node:path';

import type {
  DocumentAnalysisRequest,
  DocumentAnalysisResult,
  DocumentDashboard,
  DocumentDetail,
  DocumentFormat,
  DocumentMetadata,
  DocumentOcrStatus,
  DocumentSearchRequest,
  DocumentSearchResult,
} from '../../../shared/documents/contracts';
import { DOCUMENT_FORMATS } from '../../../shared/documents/contracts';
import { ERROR_CODES } from '../../../shared/platform/errors';
import type { AIProvider } from '../../conversation/provider/contracts';
import { PlatformError } from '../../platform/errors/platform-error';
import { ChunkBuilder } from '../chunking/chunk-builder';
import { DocumentIndexer } from '../indexing/document-indexer';
import { UnavailableOcrProvider } from '../ocr/ocr-provider';
import type { OcrProvider } from '../parser/contracts';
import { DocumentParserRegistry } from '../parser/document-parser-registry';
import { FORMAT_MIME, MAX_DOCUMENT_BYTES, formatFromPath } from '../parser/format';
import type { DocumentRepository } from '../persistence/document-repository';
import { DocumentSession } from '../session/document-session';

export interface DocumentServiceOptions {
  readonly repository: DocumentRepository;
  readonly parserRegistry?: DocumentParserRegistry;
  readonly chunkBuilder?: ChunkBuilder;
  readonly indexer?: DocumentIndexer;
  readonly ocrProvider?: OcrProvider;
  readonly aiProvider?: () => AIProvider;
  readonly clock?: () => Date;
  readonly idFactory?: () => string;
  readonly maxBytes?: number;
}

function checksum(buffer: Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function preview(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 1_000);
}

function requireDocumentText(document: DocumentDetail): string {
  return document.chunks.map((chunk) => chunk.content).join('\n\n') || document.preview;
}

function regexList(text: string, pattern: RegExp): readonly string[] {
  return Object.freeze([...new Set([...text.matchAll(pattern)].map((match) => match[0]))]);
}

function deterministicAnalysis(request: DocumentAnalysisRequest, document: DocumentDetail): string {
  const text = requireDocumentText(document);
  if (request.action === 'emails')
    return (
      regexList(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi).join('\n') ||
      'No email addresses found.'
    );
  if (request.action === 'phone-numbers')
    return regexList(text, /\+?\d[\d\s().-]{7,}\d/g).join('\n') || 'No phone numbers found.';
  if (request.action === 'dates')
    return (
      regexList(
        text,
        /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
      ).join('\n') || 'No dates found.'
    );
  if (request.action === 'names')
    return (
      regexList(text, /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g)
        .slice(0, 30)
        .join('\n') || 'No names found.'
    );
  if (request.action === 'tables')
    return (
      document.tables
        .map((table) => table.rows.map((row) => row.join(' | ')).join('\n'))
        .join('\n\n') || 'No tables found.'
    );
  if (request.action === 'action-items') {
    const lines = text
      .split(/\n|\. /)
      .filter((line) => /\b(todo|action|required|must|should|follow up|next step)\b/i.test(line));
    return lines.length
      ? lines.map((line) => `- ${line.trim()}`).join('\n')
      : 'No action items found.';
  }
  if (request.action === 'key-points') {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter((line) => line.length > 30)
      .slice(0, 6)
      .map((line) => `- ${line.trim()}`)
      .join('\n');
  }
  if (request.action === 'question') {
    return `Based on ${document.title}: ${preview(text) || 'No readable text was available.'}`;
  }
  if (request.action === 'translate') {
    return `Translation to ${request.targetLanguage ?? 'the requested language'} requires a configured AI provider.`;
  }
  if (request.action === 'meeting-summary') {
    return `Meeting summary\n\nKey discussion:\n${preview(text)}\n\nNext steps:\n${deterministicAnalysis({ ...request, action: 'action-items' }, document)}`;
  }
  if (request.action === 'report') {
    return `# Report: ${document.title}\n\n## Overview\n${preview(text)}\n\n## Key points\n${deterministicAnalysis({ ...request, action: 'key-points' }, document)}`;
  }
  if (request.action === 'explain') return `Plain-language explanation:\n\n${preview(text)}`;
  return `Summary:\n\n${preview(text)}`;
}

async function collectProviderText(provider: AIProvider, prompt: string): Promise<string> {
  const session = provider.createSession();
  const stream = session.stream({
    systemInstruction:
      'You are J.A.R.V.I.S. document intelligence. Use only the provided document context. Be precise and structured.',
    messages: [{ role: 'user', content: prompt }],
  });
  let content = '';
  for await (const chunk of stream) content += chunk.text;
  return content.trim();
}

export class DocumentService {
  readonly #repository: DocumentRepository;
  readonly #parserRegistry: DocumentParserRegistry;
  readonly #chunkBuilder: ChunkBuilder;
  readonly #indexer: DocumentIndexer;
  readonly #ocrProvider: OcrProvider;
  readonly #aiProvider: (() => AIProvider) | undefined;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #maxBytes: number;

  public constructor(options: DocumentServiceOptions) {
    this.#repository = options.repository;
    this.#parserRegistry = options.parserRegistry ?? new DocumentParserRegistry();
    this.#chunkBuilder = options.chunkBuilder ?? new ChunkBuilder();
    this.#indexer = options.indexer ?? new DocumentIndexer();
    this.#ocrProvider = options.ocrProvider ?? new UnavailableOcrProvider();
    this.#aiProvider = options.aiProvider;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#maxBytes = options.maxBytes ?? MAX_DOCUMENT_BYTES;
  }

  public async importDocument(filePath: string, pin = false): Promise<DocumentDetail> {
    const realPath = realpathSync(filePath);
    const stat = statSync(realPath);
    if (!stat.isFile()) {
      throw new PlatformError(ERROR_CODES.validationFailed, 'Selected path is not a file.');
    }
    if (stat.size > this.#maxBytes) {
      throw new PlatformError(
        ERROR_CODES.documentTooLarge,
        'Document exceeds the configured size limit.',
        {
          metadata: { maxBytes: this.#maxBytes, size: stat.size },
        },
      );
    }
    const format = formatFromPath(realPath);
    if (!format || !DOCUMENT_FORMATS.includes(format)) {
      throw new PlatformError(ERROR_CODES.documentUnsupported, 'Document format is not supported.');
    }
    const buffer = readFileSync(realPath);
    return await this.importBuffer(realPath, new Uint8Array(buffer), format, pin);
  }

  public async importBuffer(
    sourcePath: string,
    buffer: Uint8Array,
    format: DocumentFormat,
    pin = false,
  ): Promise<DocumentDetail> {
    const digest = checksum(buffer);
    const existing = this.#repository.getByChecksum(digest);
    if (existing) {
      const touched = this.#repository.touch(existing.id, this.#clock().toISOString());
      return { ...existing, ...(touched ?? {}) };
    }
    const parsed = this.#parserRegistry.parse({ buffer, fileName: basename(sourcePath), format });
    let text = parsed.text.trim();
    let ocrStatus: DocumentOcrStatus = 'not-required';
    if (parsed.needsOcr) {
      const ocrText = (
        await this.#ocrProvider.extractText({ buffer, fileName: basename(sourcePath), format })
      ).trim();
      if (ocrText) {
        text = text ? `${text}\n\n${ocrText}` : ocrText;
        ocrStatus = 'completed';
      } else {
        ocrStatus = 'unavailable';
      }
    }
    const id = this.#idFactory();
    const timestamp = this.#clock().toISOString();
    const chunks = this.#chunkBuilder.build(id, text);
    return this.#repository.save({
      id,
      title: parsed.title,
      format,
      sourcePath,
      byteSize: buffer.byteLength,
      mimeType: FORMAT_MIME[format],
      checksum: digest,
      pageCount: parsed.pageCount,
      wordCount: wordCount(text),
      characterCount: text.length,
      tableCount: parsed.tables.length,
      ocrStatus,
      pinned: pin,
      importedAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      preview: preview(text) || `[${format.toUpperCase()} document has no readable text.]`,
      chunks,
      tables: parsed.tables,
    });
  }

  public list(): readonly DocumentMetadata[] {
    return this.#repository.list();
  }

  public get(documentId: string): DocumentDetail {
    const document = this.#repository.get(documentId);
    if (!document) throw this.notFound(documentId);
    this.#repository.touch(documentId, this.#clock().toISOString());
    return document;
  }

  public pin(documentId: string, pinned: boolean): DocumentMetadata {
    const metadata = this.#repository.pin(documentId, pinned);
    if (!metadata) throw this.notFound(documentId);
    return metadata;
  }

  public delete(documentId: string): void {
    if (!this.#repository.delete(documentId)) throw this.notFound(documentId);
  }

  public dashboard(): DocumentDashboard {
    const documents = this.#repository.list();
    const details = documents
      .map((document) => this.#repository.get(document.id))
      .filter((document): document is DocumentDetail => Boolean(document));
    return Object.freeze({
      recent: Object.freeze(documents.slice(0, 8)),
      pinned: Object.freeze(documents.filter((document) => document.pinned).slice(0, 8)),
      totalDocuments: documents.length,
      totalChunks: details.reduce((total, document) => total + document.chunks.length, 0),
      supportedFormats: DOCUMENT_FORMATS,
    });
  }

  public search(request: DocumentSearchRequest): readonly DocumentSearchResult[] {
    const documents = this.#repository
      .list()
      .map((document) => this.#repository.get(document.id))
      .filter((document): document is DocumentDetail => Boolean(document));
    return this.#indexer.search(
      documents,
      request.query,
      request.mode ?? 'hybrid',
      { formats: request.formats, pinnedOnly: request.pinnedOnly },
      request.limit ?? 20,
    );
  }

  public async analyze(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResult> {
    const document = this.get(request.documentId);
    const session = new DocumentSession(document);
    let content: string | undefined;
    try {
      const provider = this.#aiProvider?.();
      if (provider) content = await collectProviderText(provider, session.prompt(request));
    } catch {
      content = undefined;
    }
    const result: DocumentAnalysisResult = Object.freeze({
      documentId: request.documentId,
      action: request.action,
      content: content || deterministicAnalysis(request, document),
      generatedAt: this.#clock().toISOString(),
    });
    this.#repository.saveAnalysis(result);
    return result;
  }

  public close(): void {
    this.#repository.close();
  }

  private notFound(documentId: string): PlatformError {
    return new PlatformError(ERROR_CODES.documentNotFound, 'Document was not found.', {
      metadata: { documentId },
    });
  }
}
