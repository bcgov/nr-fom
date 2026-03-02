import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '@utility/security/user';

@Injectable()
export class AdminOperationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.headers['user'];

    if (!user?.isAdmin) {
      throw new ForbiddenException();
    }
    return true;
  }
}
