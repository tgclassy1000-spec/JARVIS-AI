import type { PermissionRequest } from '../../shared/platform/permissions';

export interface PersistenceService {
  healthCheck(): Promise<boolean>;
}

export interface VoiceService {
  isAvailable(): Promise<boolean>;
}

export interface FileAccessService {
  requestAccess(request: PermissionRequest): Promise<boolean>;
}

export interface OfficeAutomationService {
  isAvailable(): Promise<boolean>;
}

export interface NotificationService {
  isAvailable(): Promise<boolean>;
}

export interface PluginService {
  listPluginIds(): Promise<readonly string[]>;
}
