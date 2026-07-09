export const MEMORY_KINDS = [
  'user-profile',
  'preference',
  'fact',
  'conversation',
  'semantic',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface MemoryRecord {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly content: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly sourceConversationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemorySettings {
  readonly enabled: boolean;
}

export interface MemorySearchRequest {
  readonly query: string;
  readonly kind?: MemoryKind;
  readonly tags?: readonly string[];
  readonly mode?: 'keyword' | 'semantic' | 'hybrid';
  readonly limit?: number;
}

export interface MemorySearchResult {
  readonly memory: MemoryRecord;
  readonly score: number;
}

export interface SaveMemoryRequest {
  readonly kind: MemoryKind;
  readonly content: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly pinned?: boolean;
  readonly sourceConversationId?: string;
}

export interface UpdateMemoryRequest {
  readonly id: string;
  readonly content?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly pinned?: boolean;
}

export interface MemoryArchive {
  readonly schemaVersion: 1;
  readonly exportedAt: string;
  readonly settings: MemorySettings;
  readonly memories: readonly MemoryRecord[];
}

export interface MemoryExport {
  readonly filename: string;
  readonly mimeType: 'application/json';
  readonly content: string;
}

export interface MemoryIdRequest {
  readonly id: string;
}

export interface MemoryRestoreRequest {
  readonly archive: MemoryArchive;
  readonly replace: boolean;
}

export interface MemoryEnabledRequest {
  readonly enabled: boolean;
}
