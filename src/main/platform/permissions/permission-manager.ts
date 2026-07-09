import { ERROR_CODES } from '../../../shared/platform/errors';
import type {
  Permission,
  PermissionDecision,
  PermissionRequest,
  PermissionResolution,
} from '../../../shared/platform/permissions';
import { PlatformError } from '../errors/platform-error';

export type PermissionPrompt = (request: PermissionRequest) => Promise<PermissionResolution>;

export class PermissionManager {
  readonly #policy: ReadonlyMap<Permission, PermissionDecision>;
  readonly #sessionGrants = new Set<Permission>();
  readonly #onceGrants = new Set<Permission>();

  public constructor(
    policy: ReadonlyMap<Permission, PermissionDecision> = new Map(),
    private readonly prompt?: PermissionPrompt,
  ) {
    this.#policy = new Map(policy);
  }

  public grant(permission: Permission, scope: 'once' | 'session'): void {
    (scope === 'once' ? this.#onceGrants : this.#sessionGrants).add(permission);
  }

  public revoke(permission: Permission): void {
    this.#onceGrants.delete(permission);
    this.#sessionGrants.delete(permission);
  }

  public async assertAllowed(request: PermissionRequest): Promise<void> {
    if (this.#onceGrants.delete(request.permission) || this.#sessionGrants.has(request.permission))
      return;

    const decision = this.#policy.get(request.permission) ?? 'deny';
    if (decision === 'allow') return;

    if (decision === 'ask' && this.prompt) {
      const resolution = await this.prompt(request);
      if (resolution.granted) {
        if (resolution.scope) this.grant(request.permission, resolution.scope);
        return;
      }
    }

    throw new PlatformError(
      ERROR_CODES.permissionDenied,
      `Permission denied: ${request.permission}`,
      {
        metadata: { permission: request.permission, resource: request.resource },
      },
    );
  }
}
