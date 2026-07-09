import type {
  MemoryArchive,
  MemoryKind,
  MemoryRecord,
  MemorySettings,
  SaveMemoryRequest,
  UpdateMemoryRequest,
} from '../../../shared/memory/contracts';

export interface MemoryRepository {
  list(kind?: MemoryKind): readonly MemoryRecord[];
  get(id: string): MemoryRecord | undefined;
  save(memory: SaveMemoryRequest): MemoryRecord;
  update(changes: UpdateMemoryRequest): MemoryRecord | undefined;
  delete(id: string): boolean;
  deleteAll(): number;
  settings(): MemorySettings;
  setEnabled(enabled: boolean): MemorySettings;
  archive(): MemoryArchive;
  restore(archive: MemoryArchive, replace: boolean): number;
  schemaVersion(): number;
  close(): void;
}
