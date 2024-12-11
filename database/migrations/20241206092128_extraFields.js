const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .withSchema(schema)
    .alterTable('requests', (table) => {
      table.string('inspectorEmail');
      table.string('assignedId');
    })
    .raw(`ALTER TYPE "${schema}"."request_status" ADD VALUE 'COMPLETED'`)
    .raw(`ALTER TYPE "${schema}"."request_history_type" ADD VALUE 'COMPLETED'`);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('inspectorEmail');
    table.dropColumn('assignedId');
  });
};
