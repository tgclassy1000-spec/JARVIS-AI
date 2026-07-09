import type {
  WebBookmark,
  WebBookmarkRequest,
  WebHistoryEntry,
  WebToolKind,
} from '../../../shared/web/contracts';

export interface WebHistoryInput {
  readonly id: string;
  readonly kind: WebToolKind;
  readonly title: string;
  readonly query: string;
  readonly createdAt: string;
}

export interface WebBookmarkInput extends WebBookmarkRequest {
  readonly id: string;
  readonly createdAt: string;
}

export interface WebRepository {
  schemaVersion(): number;
  addHistory(input: WebHistoryInput): WebHistoryEntry;
  history(limit?: number): readonly WebHistoryEntry[];
  saveBookmark(input: WebBookmarkInput): WebBookmark;
  bookmarks(): readonly WebBookmark[];
  deleteBookmark(id: string): boolean;
  close(): void;
}
