const { commonFields, schema } = require('../common');

exports.up = function (knex) {
  return knex.schema.withSchema(schema).createTable('users', (table) => {
    table.increments('id');
    table.string('firstName', 255);
    table.string('lastName', 255);
    commonFields(table);
  });
};

exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('users');
};
