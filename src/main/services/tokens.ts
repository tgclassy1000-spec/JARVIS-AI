import { createServiceToken } from '../platform/di/service-container';
import type { AIProvider } from '../conversation/provider/contracts';
import type { DesktopAutomationService } from '../desktop/service/desktop-automation-service';
import type { DocumentService } from '../documents/service/document-service';
import type { MemoryManager } from '../memory/manager/memory-manager';
import type { OfficeManager } from '../office/manager/office-manager';
import type { PluginManager } from '../plugins/service/plugin-manager';
import type { ProductionHardeningService } from '../production/service/production-hardening-service';
import type { ReleaseEngineeringService } from '../release/service/release-engineering-service';
import type { WebIntelligenceService } from '../web/service/web-intelligence-service';
import type {
  FileAccessService,
  NotificationService,
  OfficeAutomationService,
  PersistenceService,
  VoiceService,
} from './contracts';

export const SERVICE_TOKENS = Object.freeze({
  aiProvider: createServiceToken<AIProvider>('AIProvider'),
  documents: createServiceToken<DocumentService>('DocumentService'),
  desktopAutomation: createServiceToken<DesktopAutomationService>('DesktopAutomationService'),
  memory: createServiceToken<MemoryManager>('MemoryManager'),
  office: createServiceToken<OfficeManager>('OfficeManager'),
  web: createServiceToken<WebIntelligenceService>('WebIntelligenceService'),
  fileAccess: createServiceToken<FileAccessService>('FileAccessService'),
  notifications: createServiceToken<NotificationService>('NotificationService'),
  officeAutomation: createServiceToken<OfficeAutomationService>('OfficeAutomationService'),
  persistence: createServiceToken<PersistenceService>('PersistenceService'),
  plugins: createServiceToken<PluginManager>('PluginService'),
  production: createServiceToken<ProductionHardeningService>('ProductionHardeningService'),
  release: createServiceToken<ReleaseEngineeringService>('ReleaseEngineeringService'),
  voice: createServiceToken<VoiceService>('VoiceService'),
});
