const { commonFields, schema } = require('../common');

exports.up = function (knex) {
  return knex.schema
    .withSchema(schema)
    .alterTable('users', (table) => {
      table.string('code', 255);
      table.string('email', 255);
      table.string('phone', 255);
    })
    .createTable('tenants', (table) => {
      table.increments('id');
      table.string('name', 255);
      table.string('email', 255);
      table.string('phone', 255);
      table.string('code', 255);
      table.string('address', 255);
      commonFields(table);
    })
    .createTable('tenantUsers', (table) => {
      table.increments('id');
      table.integer('tenantId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table
        .enu('role', ['USER', 'ADMIN'], {
          useNative: true,
          enumName: 'tenant_user_role',
        })
        .defaultTo('USER');
      commonFields(table);
    });
};

exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('tenants').dropTable('tenantUsers');
};
