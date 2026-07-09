import { SERVICE_TOKENS } from '../../src/main/services/tokens';

describe('future service contracts', () => {
  it('provide distinct tokens without runtime implementations', () => {
    const tokens = Object.values(SERVICE_TOKENS);
    expect(new Set(tokens.map((token) => token.key)).size).toBe(tokens.length);
    expect(tokens.map((token) => token.description)).toEqual([
      'AIProvider',
      'DocumentService',
      'DesktopAutomationService',
      'MemoryManager',
      'OfficeManager',
      'WebIntelligenceService',
      'FileAccessService',
      'NotificationService',
      'OfficeAutomationService',
      'PersistenceService',
      'PluginService',
      'ProductionHardeningService',
      'ReleaseEngineeringService',
      'VoiceService',
    ]);
  });
});
// @vitest-environment node
