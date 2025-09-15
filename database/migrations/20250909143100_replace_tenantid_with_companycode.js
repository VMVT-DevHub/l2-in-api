const schema = process.env.DB_SCHEMA || 'public';
const tableName = 'requests';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.withSchema(schema).alterTable(tableName, (table) => {
    table.bigInteger('company_code').nullable();
  });
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.schema.withSchema(schema).alterTable(tableName, (table) => {
    table.dropColumn('company_code');
  });
};

exports.config = { transaction: false };
