import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminOperationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.headers['user'];

    if (!user?.isAuthorizedForAdminOperation?.()) {
      throw new ForbiddenException();
    }
    return true;
  }
}
