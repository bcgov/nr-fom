import { KeycloakService } from '@admin-core/services/keycloak.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const adminGuard = () => {
  const keycloakService = inject(KeycloakService);
  const router = inject(Router);
  const user = keycloakService.getUser();
  const isAdmin = user && user.isAdmin === true;
  if (!isAdmin) {
    router.navigate(['/not-authorized']);
    return false;
  }
  return true;
};
