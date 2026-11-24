import { User } from "./user";

describe('User', () => {
    let user: User;

    beforeEach(()=> {
        user = new User();
    });

    describe('isAuthorizedForAdminSite', () => {
        it('false for default user', async () => {
            expect(user.isAuthorizedForAdminSite()).toBe(false);
        });
    });

    describe('isAuthorizedForClientId', () => {
        it('true on match', async () => {
            user.clientIds.push('1011');
            expect(user.isAuthorizedForClientId('1011')).toBe(true);
        });
        it ('false when no match', () => {
            expect(user.isAuthorizedForClientId('1011')).toBe(false);
        });
    });

    describe('convertJsonToUser', () => {
        it('should have client ids', async() => {
            const json = `{"isMinistry":true,"isForestClient":true,"clientIds":[1011, 1012],"userName":"fakeuser@idir","displayName":"Longlastname, Firstname"}`;
            user = User.convertJsonToUser(json);
            expect(user.clientIds.length).toBe(2);            
        });
        it('should have methods', async() => {
            const json = `{"isMinistry":true,"isForestClient":true,"clientIds":[1011, 1012],"userName":"fakeuser@idir","displayName":"Longlastname, Firstname"}`;
            user = User.convertJsonToUser(json);
            expect(user.isAuthorizedForClientId('1011')).toBe(true);            
        });
    });

    describe('convertKeycloakClaimsToUser', () => {
        // Shape of a BC Gov SSO standard-realm access token for an IDIR - MFA sign-in.
        const idirClaims = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
            azp: 'fom-1234',
            identity_provider: 'azureidir',
            idir_username: 'IANLIU',
            idir_user_guid: 'E72A12C916A44A9581CF39E5DCDFFAE7',
            preferred_username: 'e72a12c916a44a9581cf39e5dcdffae7@azureidir',
            display_name: 'Liu, Ian WLRS:EX',
            client_roles: ['FOM_REVIEWER'],
            ...o,
        });

        it('maps FOM_REVIEWER to a ministry user', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims());
            expect(user.userName).toBe('IANLIU');
            expect(user.displayName).toBe('Liu, Ian WLRS:EX');
            expect(user.isMinistry).toBe(true);
            expect(user.isForestClient).toBe(false);
            expect(user.isAdmin).toBe(false);
            expect(user.clientIds).toStrictEqual([]);
        });

        it('maps FOM_ADMIN to an admin user', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({ client_roles: ['FOM_ADMIN'] }));
            expect(user.isAdmin).toBe(true);
            expect(user.isMinistry).toBe(false);
            expect(user.isAuthorizedForAdminSite()).toBe(true);
        });

        it('maps forest-client-scoped submitter roles to client ids, ignoring FAM sidecars', () => {
            const user = User.convertKeycloakClaimsToUser({
                azp: 'fom-1234',
                identity_provider: 'bceidbusiness',
                bceid_username: 'acme-planner',
                display_name: 'Acme Planner',
                client_roles: [
                    'FOM_SUBMITTER_FOREST_CLIENT-00001018',
                    'FOM_SUBMITTER_FOREST_CLIENT-00001012',
                    'FAM:EXPIRES:2026-09-30:FOM_SUBMITTER_FOREST_CLIENT-00001012',
                ],
            });
            expect(user.userName).toBe('acme-planner');
            expect(user.isForestClient).toBe(true);
            expect(user.isMinistry).toBe(false);
            expect(user.clientIds).toStrictEqual(['00001018', '00001012']);
            expect(user.isAuthorizedForClientId('00001012')).toBe(true);
            expect(user.isAuthorizedForClientId('FOREST_CLIENT-00001012')).toBe(false);
        });

        it('reads the client id from a submitter role that also carries a district', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({
                client_roles: ['FOM_SUBMITTER_DISTRICT-DCC_FOREST_CLIENT-00001012'],
            }));
            expect(user.isForestClient).toBe(true);
            expect(user.clientIds).toStrictEqual(['00001012']);
        });

        it('does not treat the legacy Cognito group shape as a client id', () => {
            // FOM_SUBMITTER_<n> was the Cognito group form; FAM never issues it to CSS.
            const user = User.convertKeycloakClaimsToUser(idirClaims({ client_roles: ['FOM_SUBMITTER_00001011'] }));
            expect(user.isForestClient).toBe(false);
            expect(user.clientIds).toStrictEqual([]);
        });

        it('falls back to resource_access.<azp>.roles when client_roles is absent', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({
                client_roles: undefined,
                resource_access: { 'fom-1234': { roles: ['FOM_REVIEWER'] }, other: { roles: ['FOM_ADMIN'] } },
            }));
            expect(user.isMinistry).toBe(true);
            // Roles granted to some other client are not ours.
            expect(user.isAdmin).toBe(false);
        });

        it('has no access when there are no roles at all', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({ client_roles: [] }));
            expect(user.isAuthorizedForAdminSite()).toBe(false);
            expect(user.clientIds).toStrictEqual([]);
        });

        it('keeps the username exactly as issued', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({ idir_username: 'IanLiu' }));
            expect(user.userName).toBe('IanLiu');
        });

        it('falls back to an upper-cased GUID when no username claim is mapped', () => {
            // Lower-case on purpose: the realm can send the same GUID in either case.
            const user = User.convertKeycloakClaimsToUser(idirClaims({
                idir_username: undefined,
                idir_user_guid: 'e72a12c916a44a9581cf39e5dcdffae7',
            }));
            expect(user.userName).toBe('E72A12C916A44A9581CF39E5DCDFFAE7');
        });

        it('uses the username as display name when display_name is missing', () => {
            const user = User.convertKeycloakClaimsToUser(idirClaims({ display_name: undefined }));
            expect(user.displayName).toBe('IANLIU');
        });

        it('yields an empty identity for empty claims', () => {
            const user = User.convertKeycloakClaimsToUser({});
            expect(user.userName).toBe('');
            expect(user.isAuthorizedForAdminSite()).toBe(false);
        });
    });
});
