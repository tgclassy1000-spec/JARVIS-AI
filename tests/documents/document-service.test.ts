// @vitest-environment node

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  AIProvider,
  ChatSession,
  StreamChunk,
  StreamResponse,
} from '../../src/main/conversation/provider/contracts';
import type { OcrProvider } from '../../src/main/documents/parser/contracts';
import { SqliteDocumentRepository } from '../../src/main/documents/persistence/sqlite-document-repository';
import { DocumentService } from '../../src/main/documents/service/document-service';

class MockStream implements StreamResponse {
  public constructor(private readonly text: string) {}
  public cancel(): void {
    return undefined;
  }
  public [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    let emitted = false;
    return {
      next: () => {
        if (emitted) return Promise.resolve({ done: true, value: undefined });
        emitted = true;
        return Promise.resolve({ done: false, value: { text: this.text } });
      },
    };
  }
}

function providerReturning(text: string): AIProvider {
  const session: ChatSession = { stream: () => new MockStream(text) };
  return {
    id: 'mock',
    model: 'mock',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

function providerThrowing(): AIProvider {
  const session: ChatSession = {
    stream: () => {
      throw new Error('provider unavailable');
    },
  };
  return {
    id: 'mock',
    model: 'mock',
    tokenEstimator: { estimate: () => Promise.resolve(1) },
    createSession: () => session,
  };
}

function createService(
  options: {
    readonly ocr?: OcrProvider;
    readonly provider?: AIProvider;
    readonly maxBytes?: number;
  } = {},
) {
  const directory = join(tmpdir(), `jarvis-documents-${Date.now()}-${Math.random()}`);
  mkdirSync(directory, { recursive: true });
  const repository = new SqliteDocumentRepository(join(directory, 'documents.sqlite'));
  let tick = 0;
  const service = new DocumentService({
    repository,
    ocrProvider: options.ocr,
    aiProvider: options.provider ? () => options.provider! : undefined,
    clock: () => new Date(`2026-01-0${Math.min(++tick, 9)}T00:00:00.000Z`),
    idFactory: () => `document-${tick}`,
    maxBytes: options.maxBytes ?? 1024 * 1024,
  });
  return {
    directory,
    service,
    write: (name: string, content: string | Uint8Array) => {
      const path = join(directory, name);
      writeFileSync(path, content);
      return path;
    },
    cleanup: () => {
      service.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

describe('DocumentService', () => {
  it('imports, deduplicates, pins, searches, analyzes and deletes documents', async () => {
    const { service, write, cleanup } = createService();
    try {
      const path = write(
        'brief.md',
        '# Brief\n\nTony Stark must email pepper@example.com by 2026-01-05. Call +1 555 123 4567.\n\n| Owner | Task |\n| --- | --- |\n| Tony Stark | Follow up |',
      );
      const detail = await service.importDocument(path, true);
      expect(detail).toMatchObject({
        title: 'brief.md',
        format: 'markdown',
        pinned: true,
        tableCount: 1,
      });
      expect(service.dashboard()).toMatchObject({ totalDocuments: 1, totalChunks: 1 });
      expect((await service.importDocument(path)).id).toBe(detail.id);
      expect(service.pin(detail.id, false)).toMatchObject({ pinned: false });
      expect(service.search({ query: 'pepper', mode: 'keyword' })[0]?.document.id).toBe(detail.id);
      expect(service.search({ query: 'follow up', mode: 'semantic' })[0]?.document.id).toBe(
        detail.id,
      );
      expect(
        (await service.analyze({ documentId: detail.id, action: 'summarize' })).content,
      ).toContain('Summary:');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'emails' })).content,
      ).toContain('pepper@example.com');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'phone-numbers' })).content,
      ).toContain('+1 555 123 4567');
      expect((await service.analyze({ documentId: detail.id, action: 'dates' })).content).toContain(
        '2026-01-05',
      );
      expect((await service.analyze({ documentId: detail.id, action: 'names' })).content).toContain(
        'Tony Stark',
      );
      expect(
        (await service.analyze({ documentId: detail.id, action: 'tables' })).content,
      ).toContain('Owner | Task');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'action-items' })).content,
      ).toContain('must email');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'report' })).content,
      ).toContain('# Report');
      expect(
        (
          await service.analyze({
            documentId: detail.id,
            action: 'translate',
            targetLanguage: 'Hindi',
          })
        ).content,
      ).toContain('requires a configured AI provider');
      service.delete(detail.id);
      expect(() => service.get(detail.id)).toThrow('Document was not found.');
    } finally {
      cleanup();
    }
  });

  it('uses Gemini provider output when available', async () => {
    const { service, write, cleanup } = createService({
      provider: providerReturning('Gemini document answer'),
    });
    try {
      const detail = await service.importDocument(
        write('brief.txt', 'Ask me about the arc reactor.'),
      );
      expect(
        (
          await service.analyze({
            documentId: detail.id,
            action: 'question',
            question: 'What is this?',
          })
        ).content,
      ).toBe('Gemini document answer');
    } finally {
      cleanup();
    }
  });

  it('supports OCR for images and scanned PDFs through a provider', async () => {
    const ocr: OcrProvider = {
      extractText: () => Promise.resolve('Scanned invoice for Pepper Potts'),
    };
    const { service, write, cleanup } = createService({ ocr });
    try {
      const imagePath = write('scan.png', new Uint8Array([137, 80, 78, 71]));
      const image = await service.importDocument(imagePath);
      expect(image.ocrStatus).toBe('completed');
      expect(image.preview).toContain('Scanned invoice');
      const pdfPath = write('scan.pdf', '%PDF-1.4 /Type /Page /XObject /Image');
      const pdf = await service.importDocument(pdfPath);
      expect(pdf.ocrStatus).toBe('completed');
      const mixedPdfPath = write('mixed.pdf', '%PDF-1.4 /Type /Page BT (Tiny) Tj ET');
      const mixedPdf = await service.importDocument(mixedPdfPath);
      expect(mixedPdf.preview).toContain('Tiny');
      expect(mixedPdf.preview).toContain('Scanned invoice');
    } finally {
      cleanup();
    }
  });

  it('handles local analysis fallbacks and not-found mutations', async () => {
    const { service, write, cleanup } = createService({ provider: providerThrowing() });
    try {
      const detail = await service.importDocument(write('blank.txt', ''));
      expect(service.list()).toHaveLength(1);
      expect(service.search({ query: 'blank' })[0]?.document.id).toBe(detail.id);
      await expect(service.analyze({ documentId: 'missing', action: 'summarize' })).rejects.toThrow(
        'Document was not found.',
      );
      expect(() => service.pin('missing', true)).toThrow('Document was not found.');
      expect(() => service.delete('missing')).toThrow('Document was not found.');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'question' })).content,
      ).toContain('Based on blank.txt');
      expect((await service.analyze({ documentId: detail.id, action: 'emails' })).content).toBe(
        'No email addresses found.',
      );
      expect(
        (await service.analyze({ documentId: detail.id, action: 'phone-numbers' })).content,
      ).toBe('No phone numbers found.');
      expect((await service.analyze({ documentId: detail.id, action: 'dates' })).content).toBe(
        'No dates found.',
      );
      expect((await service.analyze({ documentId: detail.id, action: 'names' })).content).toBe(
        'No names found.',
      );
      expect((await service.analyze({ documentId: detail.id, action: 'tables' })).content).toBe(
        'No tables found.',
      );
      expect(
        (await service.analyze({ documentId: detail.id, action: 'action-items' })).content,
      ).toBe('No action items found.');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'translate' })).content,
      ).toContain('the requested language');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'meeting-summary' })).content,
      ).toContain('Meeting summary');
      expect(
        (await service.analyze({ documentId: detail.id, action: 'explain' })).content,
      ).toContain('Plain-language explanation');
    } finally {
      cleanup();
    }
  });

  it('uses default factories when no optional service dependencies are supplied', async () => {
    const directory = join(tmpdir(), `jarvis-documents-default-${Date.now()}-${Math.random()}`);
    mkdirSync(directory, { recursive: true });
    const service = new DocumentService({
      repository: new SqliteDocumentRepository(join(directory, 'documents.sqlite')),
    });
    try {
      const detail = await service.importBuffer(
        join(directory, 'default.txt'),
        new TextEncoder().encode('Default factory document content.'),
        'txt',
      );
      expect(detail.id).toHaveLength(36);
      expect(detail.importedAt).toContain('T');
    } finally {
      service.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('handles unavailable OCR and security validation failures', async () => {
    const { service, write, cleanup, directory } = createService();
    try {
      const imagePath = write('scan.webp', new Uint8Array([1, 2, 3]));
      expect((await service.importDocument(imagePath)).ocrStatus).toBe('unavailable');
      const unsupported = write('archive.exe', 'nope');
      await expect(service.importDocument(unsupported)).rejects.toThrow(
        'Document format is not supported.',
      );
      const tinyService = new DocumentService({
        repository: new SqliteDocumentRepository(join(directory, 'tiny.sqlite')),
        maxBytes: 2,
      });
      try {
        await expect(tinyService.importDocument(write('large.txt', 'too large'))).rejects.toThrow(
          'Document exceeds the configured size limit.',
        );
      } finally {
        tinyService.close();
      }
      await expect(service.importDocument(directory)).rejects.toThrow(
        'Selected path is not a file.',
      );
    } finally {
      cleanup();
    }
  });
});
