export const PERMISSIONS = {
  appLaunch: 'app-launch',
  clipboard: 'clipboard',
  desktopAutomation: 'desktop-automation',
  fileAccess: 'file-access',
  network: 'network',
  notifications: 'notifications',
  officeAutomation: 'office-automation',
  plugins: 'plugins',
  pluginTools: 'plugin-tools',
  screenshot: 'screenshot',
  systemInformation: 'system-information',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type PermissionDecision = 'allow' | 'deny' | 'ask';
export type PermissionGrantScope = 'once' | 'session';

export interface PermissionRequest {
  readonly permission: Permission;
  readonly reason: string;
  readonly resource?: string;
}

export interface PermissionResolution {
  readonly granted: boolean;
  readonly scope?: PermissionGrantScope;
}
