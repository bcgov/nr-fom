import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminOperationGuard } from './admin.guard';

describe('AdminOperationGuard', () => {
  let guard: AdminOperationGuard;
  let mockContext: Partial<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    guard = new AdminOperationGuard();
    mockRequest = { headers: { user: { isAdmin: false } } };
    mockContext = {
      switchToHttp: () => ({ getRequest: () => mockRequest })
    } as Partial<ExecutionContext>;
  });

  it('should allow access if user is authorized', () => {
    mockRequest.headers.user.isAdmin = true;
    expect(guard.canActivate(mockContext as ExecutionContext)).toBe(true);
  });

  it('should throw ForbiddenException if user is not authorized', () => {
    mockRequest.headers.user.isAdmin = false;
    expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is missing', () => {
    mockRequest.headers.user = undefined;
    expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user object is missing isAdmin', () => {
    mockRequest.headers.user = {};
    expect(() => guard.canActivate(mockContext as ExecutionContext)).toThrow(ForbiddenException);
  });
});
