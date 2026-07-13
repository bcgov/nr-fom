
const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class EnablePgcrypto1783965894193 {

    async up(queryRunner) {
        console.log('Starting enable pgcrypto extension migration');
        // pgcrypto is a runtime dependency of the application: public-comment PII
        // (name, location, email, phone) is encrypted/decrypted via
        // pgp_sym_encrypt/pgp_sym_decrypt (see public-comment.service.ts); the
        // test-data migrations use it as well.
        // Installed into the default (public) schema - main migrations run with an
        // empty schema, and that is where the runtime resolves the pgp_sym_* functions.
        // pgcrypto is a trusted extension (PostgreSQL 13+), so the FOM DB owner can
        // create it without superuser. Idempotent, so it is a no-op on databases that
        // already have it (e.g. existing TEST/PROD volumes).
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    }

    async down(queryRunner) {
        // Not dropped on revert: other objects/data may depend on pgcrypto, and it may
        // have pre-existed this migration.
    }

}
