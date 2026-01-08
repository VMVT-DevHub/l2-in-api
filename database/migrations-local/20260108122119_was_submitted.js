const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.boolean('has_changes').notNullable().defaultTo(false);
  });

  await knex('requests').withSchema(schema).whereNull('has_changes').update({ has_changes: false });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('has_changes');
  });
};
