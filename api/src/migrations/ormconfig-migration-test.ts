import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import * as config from "../ormconfig";

var ormConfig = { 
  ...config, 
  schema: '', // Use default (public) schema for migration table to avoid bootstrapping error where the app_fom schema doesn't exist yet to check the migration table.
  migrations: [
    // OpenShift
    '/app/dist/api/src/migrations/test/*.js',
    // Docker
    '/app/dist/api/src/migrations/test/*.js',
    // Local post-build migration files
    './migrations/test/*.js',
    // Source migration files used in development    
    './src/migrations/test/*{.ts,.js}'
  ],
  migrationsTableName: 'migration_test', 
  cli: {
      'migrationsDir': './src/migrations/test'
    }      
} as TypeOrmModuleOptions;

module.exports = ormConfig;

