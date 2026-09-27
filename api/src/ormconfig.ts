import { TypeOrmModuleOptions } from "@nestjs/typeorm";

// Duplicated with database.configuration.ts. Partly deliberately to allow different credentials to be used (if desired).
const config: TypeOrmModuleOptions = {
  type: 'postgres',
  database: process.env.DB_NAME || 'fom',
  schema: 'app_fom',
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  ssl: false, 

  autoLoadEntities: false,
  synchronize: false, // This changes the DB schema to match changes to entities, which we do NOT want even in development.
  logging: [ "error", "warn", "info", "log", "migration"],
};

module.exports = config;
