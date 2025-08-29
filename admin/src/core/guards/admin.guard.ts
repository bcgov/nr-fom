import { CognitoService } from '@admin-core/services/cognito.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const adminGuard = () => {
  const cognitoService = inject(CognitoService);
  const router = inject(Router);
  const user = cognitoService.getUser();
  const isAdmin = user && user.isAdmin === true;
  if (!isAdmin) {
    router.navigate(['/not-authorized']);
    return false;
  }
  return true;
};
