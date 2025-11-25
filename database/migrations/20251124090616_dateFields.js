const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dateTime('submitted_at');
    table.dateTime('completed_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('submitted_at');
    table.dropColumn('completed_at');
  });
};
