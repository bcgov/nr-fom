import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService, KeycloakConfig } from './auth.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private authService: AuthService) {
  }

  @Get('/keycloakConfig')
  @ApiResponse({ status: HttpStatus.OK, type: KeycloakConfig })
  getKeycloakConfig(): KeycloakConfig {
      return this.authService.getKeycloakConfig();
  }

}
