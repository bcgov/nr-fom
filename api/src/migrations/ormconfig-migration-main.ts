import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as config from "../ormconfig";

var ormConfig = { 
  ...config, 
  schema: 'public', // Migration tracking table lives in public; app data uses app_fom.
  migrations: [
    // Dockerfile image (e.g. in OpenShift)
    '/app/dist/api/src/migrations/main/*.js',
    // Local post-build migration files (unsure if still needed)
    './migrations/main/*.js',
    // Source migration files used in development
    './src/migrations/main/*{.ts,.js}',
  ],
  migrationsTableName: 'migration_main', 
  cli: {
      'migrationsDir': './src/migrations/main'
    }      
} as TypeOrmModuleOptions;

module.exports = ormConfig;

