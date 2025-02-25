const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.withSchema(schema).createTable('postai', (table) => {
    table.string('id');
    table.string('post_pavad');
    table.string('post_kodas');
    table.string('post_trump');
    table.string('post_salis', 3);
    table.string('post_adresas');
    table.boolean('post_aktyvus');
    table.string('post_search');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('postai');
};
