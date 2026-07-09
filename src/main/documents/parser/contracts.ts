import type { DocumentFormat, ExtractedTable } from '../../../shared/documents/contracts';

export interface ParsedDocument {
  readonly title: string;
  readonly format: DocumentFormat;
  readonly text: string;
  readonly pageCount?: number;
  readonly tables: readonly ExtractedTable[];
  readonly needsOcr: boolean;
}

export interface DocumentParser {
  readonly formats: readonly DocumentFormat[];
  parse(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): ParsedDocument;
}

export interface OcrProvider {
  extractText(input: {
    readonly buffer: Uint8Array;
    readonly fileName: string;
    readonly format: DocumentFormat;
  }): Promise<string>;
}
