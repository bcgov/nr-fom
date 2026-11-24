import { parseRole, rolesFromClaims, SCOPE_FOREST_CLIENT, scopeValue } from './fam-roles';

export const FOM_REVIEWER_ROLE = 'FOM_REVIEWER';
export const FOM_SUBMITTER_ROLE = 'FOM_SUBMITTER';
export const FOM_ADMIN_ROLE = 'FOM_ADMIN';

// Represents a user's information extracted from a BC Gov SSO (Keycloak) access token.
export class User {
    userName!: string; 
    displayName!: string;
    isMinistry: boolean = false;
    isForestClient: boolean = false;
    isAdmin: boolean = false;
    clientIds: string[] = [];

    isAuthorizedForAdminSite():boolean {
      // A user is authorized for FOM admin site if it has any of the roles (ministry, forest client, or admin).
      // However, curently for admin role the user can only access Analytics Dashboard.
      return this.isMinistry || this.isForestClient || this.isAdmin;
    }
    
    isAuthorizedForClientId(clientId:string):boolean {
      return (this.clientIds.findIndex(x => x == clientId) != -1);
    }
  
    static convertJsonToUser(json: string): User {
      const user = new User();
      Object.assign(user, JSON.parse(json)); // Use this syntax to start with a User object so its methods are available.
      return user;
    }

    /**
     * Builds the user from a verified BC Gov SSO (Keycloak) ACCESS token.
     *
     * Profile claims must be mapped onto the access token in the CSS console;
     * without them `idir_username` is absent and the user falls back to the GUID.
     *
     * Roles (see fam-roles.ts):
     *   FOM_REVIEWER                         -> ministry
     *   FOM_ADMIN                            -> admin
     *   FOM_SUBMITTER_FOREST_CLIENT-<number> -> forest client for <number>
     */
    static convertKeycloakClaimsToUser(claims: Record<string, unknown>): User {
        const user = new User();
        user.userName = User.usernameFromClaims(claims);
        const displayName = claims['display_name'];
        user.displayName = typeof displayName === 'string' && displayName.trim() ? displayName : user.userName;

        rolesFromClaims(claims).forEach(role => {
            if (role === FOM_REVIEWER_ROLE) {
                user.isMinistry = true;
                return;
            }
            if (role === FOM_ADMIN_ROLE) {
                user.isAdmin = true;
                return;
            }
            const parsed = parseRole(role);
            if (parsed.baseRole === FOM_SUBMITTER_ROLE) {
                user.isForestClient = true;
                const clientId = scopeValue(parsed, SCOPE_FOREST_CLIENT);
                if (clientId && !user.clientIds.includes(clientId)) {
                    user.clientIds.push(clientId);
                }
            }
        });
        return user;
    }

    /**
     * The identity written to the create_user / update_user audit columns.
     *
     * The username exactly as issued (it is a name; case is left alone). Only
     * when no username claim is present does it fall back to the GUID, which is
     * upper-cased: the realm can send one GUID in different cases across claims,
     * and a GUID's hex spelling carries no meaning.
     */
    static usernameFromClaims(claims: Record<string, unknown>): string {
        for (const name of ['idir_username', 'bceid_username']) {
            const value = claims[name];
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        for (const name of ['idir_user_guid', 'bceid_user_guid']) {
            const value = claims[name];
            if (typeof value === 'string' && value.trim()) {
                return value.trim().toUpperCase();
            }
        }
        return '';
    }
}