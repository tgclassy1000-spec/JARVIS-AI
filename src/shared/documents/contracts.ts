export const DOCUMENT_FORMATS = [
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'markdown',
  'csv',
  'json',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;

export const DOCUMENT_ANALYSIS_ACTIONS = [
  'summarize',
  'explain',
  'translate',
  'question',
  'action-items',
  'key-points',
  'tables',
  'dates',
  'names',
  'emails',
  'phone-numbers',
  'meeting-summary',
  'report',
] as const;

export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];
export type DocumentAnalysisAction = (typeof DOCUMENT_ANALYSIS_ACTIONS)[number];
export type DocumentOcrStatus = 'not-required' | 'completed' | 'unavailable';
export type DocumentSearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface DocumentMetadata {
  readonly id: string;
  readonly title: string;
  readonly format: DocumentFormat;
  readonly sourcePath: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly checksum: string;
  readonly pageCount?: number;
  readonly wordCount: number;
  readonly characterCount: number;
  readonly tableCount: number;
  readonly ocrStatus: DocumentOcrStatus;
  readonly pinned: boolean;
  readonly importedAt: string;
  readonly updatedAt: string;
  readonly lastOpenedAt?: string;
}

export interface DocumentChunk {
  readonly id: string;
  readonly documentId: string;
  readonly index: number;
  readonly content: string;
  readonly tokenEstimate: number;
}

export interface ExtractedTable {
  readonly title?: string;
  readonly rows: readonly (readonly string[])[];
}

export interface DocumentDetail extends DocumentMetadata {
  readonly preview: string;
  readonly chunks: readonly DocumentChunk[];
  readonly tables: readonly ExtractedTable[];
}

export interface DocumentImportRequest {
  readonly filePath: string;
  readonly pin?: boolean;
}

export interface DocumentIdRequest {
  readonly documentId: string;
}

export interface DocumentPinRequest {
  readonly documentId: string;
  readonly pinned: boolean;
}

export interface DocumentSearchRequest {
  readonly query: string;
  readonly mode?: DocumentSearchMode;
  readonly formats?: readonly DocumentFormat[];
  readonly pinnedOnly?: boolean;
  readonly limit?: number;
}

export interface DocumentSearchResult {
  readonly document: DocumentMetadata;
  readonly chunk?: DocumentChunk;
  readonly score: number;
  readonly match: string;
}

export interface DocumentAnalysisRequest {
  readonly documentId: string;
  readonly action: DocumentAnalysisAction;
  readonly question?: string;
  readonly targetLanguage?: string;
}

export interface DocumentAnalysisResult {
  readonly documentId: string;
  readonly action: DocumentAnalysisAction;
  readonly content: string;
  readonly generatedAt: string;
}

export interface DocumentDashboard {
  readonly recent: readonly DocumentMetadata[];
  readonly pinned: readonly DocumentMetadata[];
  readonly totalDocuments: number;
  readonly totalChunks: number;
  readonly supportedFormats: readonly DocumentFormat[];
}
