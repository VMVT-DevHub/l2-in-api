const schema = 'vko';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createSchemaIfNotExists('vko');

  await knex.schema.withSchema(schema).createTable('sprendimai', (table) => {
    table.increments('id').primary();

    table.integer('spren_req_id').nullable();
    table.integer('spren_vko_id').nullable();
    table.integer('spren_parent_id').nullable();

    table.string('spren_prasymo_pavad').nullable();
    table.string('spren_parent_pavad').nullable();

    table.string('spren_vkl_pavad').nullable();
    table.string('spren_vkl_adr').nullable();
    table.integer('spren_vkl_adr_aob').nullable();
    table.string('spren_vkl_adr_swg').nullable();

    table.integer('spren_vkl_veikla_id').nullable();
    table.string('spren_vkl_veikla_pavad').nullable();

    table.date('spren_dok_data').nullable();
    table.string('spren_dok_nr').nullable();
    table.string('spren_reg_nr').nullable();

    table.string('spren_created_user').nullable();
    table.string('spren_created_dep').nullable();

    table.string('spren_nusprende_user').nullable();
    table.string('spren_nusprende_dep').nullable();

    table.string('spren_status').nullable();
    table.text('spren_reason').nullable();

    table.timestamp('spren_created_at').defaultTo(knex.fn.now());
    table.timestamp('spren_updated_at').defaultTo(knex.fn.now());

    table.string('spren_modif_user').nullable();

    table.boolean('spren_delete').defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).dropTable('sprendimai');
};
