import { ERROR_CODES } from '../../src/shared/platform/errors';
import {
  PERMISSIONS,
  type Permission,
  type PermissionDecision,
} from '../../src/shared/platform/permissions';
import { PermissionManager } from '../../src/main/platform/permissions/permission-manager';

const request = (permission: Permission) => ({
  permission,
  reason: 'Unit test',
  resource: 'resource',
});

describe('PermissionManager', () => {
  it('defines every required desktop capability', () => {
    expect(new Set(Object.values(PERMISSIONS))).toEqual(
      new Set([
        'app-launch',
        'clipboard',
        'desktop-automation',
        'file-access',
        'network',
        'notifications',
        'office-automation',
        'plugin-tools',
        'plugins',
        'screenshot',
        'system-information',
      ]),
    );
  });

  it('denies by default and honors static allow policy', async () => {
    const denied = new PermissionManager();
    await expect(denied.assertAllowed(request(PERMISSIONS.fileAccess))).rejects.toMatchObject({
      code: ERROR_CODES.permissionDenied,
    });

    const policy = new Map<Permission, PermissionDecision>([[PERMISSIONS.notifications, 'allow']]);
    await expect(
      new PermissionManager(policy).assertAllowed(request(PERMISSIONS.notifications)),
    ).resolves.toBeUndefined();
  });

  it('supports once and session grants plus revocation', async () => {
    const manager = new PermissionManager();
    manager.grant(PERMISSIONS.clipboard, 'once');
    await expect(manager.assertAllowed(request(PERMISSIONS.clipboard))).resolves.toBeUndefined();
    await expect(manager.assertAllowed(request(PERMISSIONS.clipboard))).rejects.toBeDefined();

    manager.grant(PERMISSIONS.appLaunch, 'session');
    await manager.assertAllowed(request(PERMISSIONS.appLaunch));
    await manager.assertAllowed(request(PERMISSIONS.appLaunch));
    manager.revoke(PERMISSIONS.appLaunch);
    await expect(manager.assertAllowed(request(PERMISSIONS.appLaunch))).rejects.toBeDefined();
  });

  it('uses an explicit prompt only for ask policies', async () => {
    const prompt = vi
      .fn()
      .mockResolvedValueOnce({ granted: true, scope: 'session' })
      .mockResolvedValueOnce({ granted: false });
    const policy = new Map<Permission, PermissionDecision>([
      [PERMISSIONS.officeAutomation, 'ask'],
      [PERMISSIONS.network, 'ask'],
    ]);
    const manager = new PermissionManager(policy, prompt);

    await manager.assertAllowed(request(PERMISSIONS.officeAutomation));
    await manager.assertAllowed(request(PERMISSIONS.officeAutomation));
    await expect(manager.assertAllowed(request(PERMISSIONS.network))).rejects.toBeDefined();
    expect(prompt).toHaveBeenCalledTimes(2);

    await expect(
      new PermissionManager(policy).assertAllowed(request(PERMISSIONS.network)),
    ).rejects.toBeDefined();
  });

  it('accepts a one-time prompt approval without persisting a grant', async () => {
    const policy = new Map<Permission, PermissionDecision>([[PERMISSIONS.network, 'ask']]);
    const prompt = vi.fn().mockResolvedValue({ granted: true });
    const manager = new PermissionManager(policy, prompt);
    await manager.assertAllowed(request(PERMISSIONS.network));
    await manager.assertAllowed(request(PERMISSIONS.network));
    expect(prompt).toHaveBeenCalledTimes(2);
  });
});
// @vitest-environment node
