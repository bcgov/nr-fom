/**
 * Role handling for tokens issued by BC Gov SSO (Keycloak) to a FAM-managed CSS
 * integration. Ported from FAM's `CssRoleNaming` and nr-fsp's `FamRoles`.
 *
 * Where roles arrive: CSS emits `client_roles`; stock Keycloak mappers use
 * `resource_access.<azp>.roles`. Which one a realm populates depends on its
 * mappers, so both are read.
 *
 * FAM sidecars: per-grant expiry is assigned as `FAM:EXPIRES:<date>:<ROLE>`.
 * Those are bookkeeping, not grants, and are dropped.
 *
 * Scoped roles: a CSS role has no attributes, so FAM writes the scope into the
 * name - `<CODE>_FOREST_CLIENT-<value>`, `<CODE>_DISTRICT-<value>`,
 * `<CODE>_REGION-<value>`, chained (district, region, forest client) when a
 * grant has several. A scoped holder never carries the bare code.
 */

export const FAM_SIDECAR_PREFIX = 'FAM:';

export const SCOPE_DISTRICT = 'DISTRICT';
export const SCOPE_REGION = 'REGION';
export const SCOPE_FOREST_CLIENT = 'FOREST_CLIENT';

/** Longest first, so `_FOREST_CLIENT` is never read as a shorter type. */
const SCOPE_TYPES = [SCOPE_FOREST_CLIENT, SCOPE_DISTRICT, SCOPE_REGION];

export interface RoleScope {
  type: string;
  value: string;
}

export interface ParsedRole {
  baseRole: string;
  scopes: RoleScope[];
}

/** The caller's roles for this integration, with FAM's `FAM:` sidecars removed. */
export function rolesFromClaims(claims: Record<string, unknown> | null | undefined): string[] {
  if (!claims) {
    return [];
  }
  let roles = stringList(claims['client_roles']);
  if (roles.length === 0) {
    roles = rolesFromResourceAccess(claims);
  }
  return roles.filter((role) => !role.startsWith(FAM_SIDECAR_PREFIX));
}

function rolesFromResourceAccess(claims: Record<string, unknown>): string[] {
  const resourceAccess = claims['resource_access'];
  const azp = claims['azp'];
  if (!isRecord(resourceAccess) || typeof azp !== 'string') {
    return [];
  }
  const entry = resourceAccess[azp];
  return isRecord(entry) ? stringList(entry['roles']) : [];
}

/**
 * Splits a role name into its base role and scopes.
 *
 * Parses from the right: the value is everything after the last `-`, and what
 * precedes it must end in a known scope type or the hyphen is not a scope
 * separator. Never splits on underscores - region values (`KOOTENAY_BOUNDARY`)
 * and the `FOREST_CLIENT` type itself contain them.
 */
export function parseRole(roleName: string): ParsedRole {
  const scopes: RoleScope[] = [];
  let remaining = roleName;
  for (;;) {
    const hyphen = remaining.lastIndexOf('-');
    if (hyphen < 0) {
      break;
    }
    const head = remaining.substring(0, hyphen);
    const value = remaining.substring(hyphen + 1);
    const type = SCOPE_TYPES.find((t) => head.endsWith(`_${t}`) && head.length > t.length + 1);
    if (!type) {
      break;
    }
    scopes.push({ type, value });
    remaining = head.substring(0, head.length - type.length - 1);
  }
  scopes.reverse();
  return { baseRole: remaining, scopes };
}

/** The value of the given scope type on a parsed role, or undefined. */
export function scopeValue(parsed: ParsedRole, type: string): string | undefined {
  return parsed.scopes.find((s) => s.type === type)?.value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
