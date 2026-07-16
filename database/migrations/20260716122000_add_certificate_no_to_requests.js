const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.string('export_certificate_no').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('export_certificate_no');
  });
};
