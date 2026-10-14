const schema = 'vks';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).createTable('sgp_veiklos', (table) => {
    table.increments('id').primary();
    table.string('code').nullable();
    table.text('title').nullable();
    table.text('display').nullable();
    table.text('activity_codes').nullable();
    table.text('allowed_categories').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).dropTable('sgp_veiklos');
};
