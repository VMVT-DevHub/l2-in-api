const { commonFields, schema } = require('../common');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .withSchema(schema)
    .createTable('requests', (table) => {
      table.increments('id');
      table
        .enu('status', ['DRAFT', 'CREATED', 'RETURNED', 'REJECTED', 'APPROVED', 'SUBMITTED'], {
          useNative: true,
          enumName: 'request_status',
        })
        .defaultTo('DRAFT');
      table.string('formType');
      table.string('form');
      table.integer('tenantId').unsigned();
      table.jsonb('data');
      commonFields(table);
    })
    .createTable('requestHistories', (table) => {
      table.increments('id');
      table.integer('requestId').unsigned().notNullable();
      table.enu('type', ['CREATED', 'SUBMITTED', 'REJECTED', 'RETURNED', 'APPROVED', 'DELETED'], {
        useNative: true,
        enumName: 'request_history_type',
      });
      table.text('comment');
      table.jsonb('data');
      commonFields(table);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.withSchema(schema).dropTable('requestHistories').dropTable('requests');
};
