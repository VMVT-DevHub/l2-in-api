const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .withSchema(schema)
    .createTable('salys', (table) => {
      table.string('id');
      table.string('salPavad');
      table.string('salIso2');
    })
    .createTable('kpnKodai', (table) => {
      table.integer('id');
      table.string('l1');
      table.text('l1Name');
      table.string('l2');
      table.text('l2Name');
      table.string('l3');
      table.text('l3Name');
      table.string('l4');
      table.text('l4Name');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('salys').dropTable('kpnKodai');
};
