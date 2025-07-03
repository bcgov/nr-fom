// Represents a user's information extracted from Keycloak JWT.
export class User {
    userName: string; 
    displayName: string;
    isMinistry: boolean = false;
    isForestClient: boolean = false;
    isAdmin: boolean = false;
    clientIds: string[] = [];
  
    isAuthorizedForAdminOperation():boolean {
      return this.isAdmin;
    }

    isAuthorizedForAdminSite():boolean {
      return this.isMinistry || this.isForestClient;
    }
    
    isAuthorizedForClientId(clientId:string):boolean {
      return (this.clientIds.findIndex(x => x == clientId) != -1);
    }
  
    static convertJsonToUser(json: string): User {
      const user = new User();
      Object.assign(user, JSON.parse(json)); // Use this syntax to start with a User object so its methods are available.
      return user;
    }

    // This function is reserved for Keycloak.
    static convertJwtToUser(jwt: any): User {
      const user = new User();
      user.userName = jwt['username'];
      user.displayName = jwt['displayName'];
      let roles: string[];
      if (jwt['resource_access'] && jwt['resource_access']['fom']) {
        roles = jwt['resource_access']['fom']['roles'];
      }
      if (roles) {
        roles.forEach(role => {
          if (role == 'fom_ministry') {
            user.isMinistry = true;
          }
          if (role.startsWith('fom_forest_client')) {
            user.isForestClient = true;
            const clientStartIndex = 'fom_forest_client_'.length;
            if (role.length > clientStartIndex) {
              const clientId = role.substring(clientStartIndex);
              user.clientIds.push(clientId);
            }
          }
        });
      }
  
      return user;
    }

    static convertAwsCognitoDecodedTokenToUser(decodedToken: any): User {
        const user = new User();
        const idToken = decodedToken['id_token'];
        const accessToken = decodedToken['access_token']
        user.userName = idToken['custom:idp_username'];
        user.displayName = idToken['custom:idp_display_name'];
        let roles: string[];
        roles = accessToken['cognito:groups'];

        if (roles) {
            const FOM_REVIEWER_ROLE = 'FOM_REVIEWER';
            const FOM_SUBMITTER_ROLE = 'FOM_SUBMITTER';
            const FOM_ADMIN_ROLE = 'FOM_ADMIN';
            roles.forEach(role => {
                if (role == FOM_REVIEWER_ROLE) {
                    user.isMinistry = true;
                }
                if (role == FOM_ADMIN_ROLE) {
                    user.isAdmin = true;
                }
                if (role.startsWith(FOM_SUBMITTER_ROLE)) {
                    user.isForestClient = true;
                    const clientStartIndex = `${FOM_SUBMITTER_ROLE}_`.length;
                    if (role.length > clientStartIndex) {
                        const clientId = role.substring(clientStartIndex);
                        user.clientIds.push(clientId);
                    }
                }
		        });
		    }
        return user;
    }
}