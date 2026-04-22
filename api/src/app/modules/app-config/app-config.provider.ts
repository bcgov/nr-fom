import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration from './configuration';
import databaseConfiguration from './database.configuration';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get(key: string) {
    return this.configService.get('app.' + key);
  }

  db(key: keyof ReturnType<typeof databaseConfiguration>) {
    return this.configService.get('db.' + key);
  }

  get isDev() {
    return this.get('env') === 'development';
  }

  getPort() {
    return this.get('port') || 3333;
  }

  getGlobalPrefix() {
    const instanceUrlPrefix = process.env.INSTANCE_URL_PREFIX;
    if (instanceUrlPrefix && instanceUrlPrefix.length > 0) {
      return instanceUrlPrefix.substring(1) + '/api'; // Remove leading slash '/'.
    } else {
      return 'api';
    }
  }
}
