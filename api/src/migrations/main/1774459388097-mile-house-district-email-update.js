
const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class MileHouseDistrictEmailUpdate1774459388097 {

    async up(queryRunner) {
        console.log('Starting district (update email - FLNR.100MileHouseDistrict to dmhtenures) migration for 100 Mile House District');
        await queryRunner.query(`
            UPDATE app_fom.district set email = 'dmhtenures', update_timestamp = now(), update_user = 'migration', revision_count = revision_count+1 where email = 'FLNR.100MileHouseDistrict';
        `);
    }

    async down(queryRunner) {
        // No reversion of this change
    }

}
