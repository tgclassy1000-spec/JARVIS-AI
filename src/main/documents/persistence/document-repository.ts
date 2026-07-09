import type {
  DocumentAnalysisAction,
  DocumentAnalysisResult,
  DocumentChunk,
  DocumentDetail,
  DocumentMetadata,
  ExtractedTable,
} from '../../../shared/documents/contracts';

export interface DocumentSaveInput extends DocumentMetadata {
  readonly preview: string;
  readonly chunks: readonly DocumentChunk[];
  readonly tables: readonly ExtractedTable[];
}

export interface DocumentRepository {
  schemaVersion(): number;
  save(input: DocumentSaveInput): DocumentDetail;
  list(): readonly DocumentMetadata[];
  get(documentId: string): DocumentDetail | undefined;
  getByChecksum(checksum: string): DocumentDetail | undefined;
  pin(documentId: string, pinned: boolean): DocumentMetadata | undefined;
  touch(documentId: string, timestamp: string): DocumentMetadata | undefined;
  delete(documentId: string): boolean;
  saveAnalysis(result: DocumentAnalysisResult): void;
  history(documentId: string, action?: DocumentAnalysisAction): readonly DocumentAnalysisResult[];
  close(): void;
}
