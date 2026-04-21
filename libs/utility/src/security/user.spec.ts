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

    describe('convertJwtToUser', () => {
        it('should fail if no roles', async() => {
            const jwt = '{"scope":"openid profile email","idir_userid":"E1234","email_verified":false,"displayName":"Last, First IIT:EX","name":"First Last","preferred_username":"firstlast@idir","given_name":"First","family_name":"Last","email":"first.last@gov.bc.ca","username":"firstlast@idir"}​​​​​​​';
            user = User.convertJwtToUser(jwt);
            expect(user.clientIds.length).toBe(0);
            expect(user.isAuthorizedForAdminSite()).toBeFalsy();
        });
    });

    describe('convertAwsCognitoDecodedTokenToUser', () => {
        it('should fail if decoded token contains no expected id_token or access_token', async() => {
            const invalid_noId_decodedToken = {access_token: {}};
            const invalid_noAccess_decodedToken = {id_token: {}};

            expect(() => User.convertAwsCognitoDecodedTokenToUser(invalid_noId_decodedToken))
                .toThrow(TypeError)
            expect(() => User.convertAwsCognitoDecodedTokenToUser(invalid_noAccess_decodedToken))
                .toThrow(TypeError)
        });

        it('should pass for valid FOM_REVIEWER role decoded token', async() => {
            const decodedToken = validFOMReviewerDecodedCognitoToken;
            const user = User.convertAwsCognitoDecodedTokenToUser(decodedToken)
            expect(user).toBeDefined();
            expect(user.userName).toBe(decodedToken.decodedIdToken["custom:idp_username"]);
            expect(user.displayName).toBe(decodedToken.decodedIdToken["custom:idp_display_name"]);
            expect(user.isMinistry).toBe(true);
            expect(user.isForestClient).toBe(false);
            expect(user.clientIds).toStrictEqual([]);
        });

        it('should pass for valid FOM_SUBMITTER role decoded token', async() => {
            const decodedToken = validFOMSubmitterDecodedCognitoToken;
            const user = User.convertAwsCognitoDecodedTokenToUser(decodedToken)
            expect(user).toBeDefined();
            expect(user.userName).toBe(decodedToken.decodedIdToken["custom:idp_username"]);
            expect(user.displayName).toBe(decodedToken.decodedIdToken["custom:idp_display_name"]);
            expect(user.isMinistry).toBe(false);
            expect(user.isForestClient).toBe(true);
            expect(user.clientIds).toStrictEqual(['0001011','0001012']);
        });
    });


    // Ignore other OIDC fields in token.
    const validFOMReviewerDecodedCognitoToken = {
        decodedIdToken: {
          'custom:idp_username': 'IANLIU',
          'custom:idp_display_name': 'Liu, Ian WLRS:EX',
          email: 'ian.liu@gov.bc.ca'
        },
        decodedAccessToken: {
          'cognito:groups': [ 'FOM_REVIEWER' ],
          token_use: 'access',
          scope: 'openid',
          username: 'dev-idir_e72a12c916a44a9581cf39e5dcdffae7@idir'
        }
    }

    const validFOMSubmitterDecodedCognitoToken = {
        decodedIdToken: {
          'custom:idp_username': 'IANLIU',
          'custom:idp_display_name': 'Liu, Ian WLRS:EX',
          email: 'ian.liu@gov.bc.ca'
        },
        decodedAccessToken: {
          'cognito:groups': [ 'FOM_SUBMITTER_0001011','FOM_SUBMITTER_0001012' ],
          token_use: 'access',
          scope: 'openid',
          username: 'dev-idir_e72a12c916a44a9581cf39e5dcdffae7@idir'
        }
    }
});