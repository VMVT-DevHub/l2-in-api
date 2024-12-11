const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .withSchema(schema)
    .createTable('vLkpCargoType', (table) => {
      table.string('id');
      table.string('title');
      table.integer('sort');
    })
    .createTable('vLkpTransportType', (table) => {
      table.string('id');
      table.string('title');
      table.integer('sort');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('vLkpCargoType').dropTable('vLkpTransportType');
};
