const schema = 'vks';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createSchemaIfNotExists('vks');

  await knex.schema.withSchema(schema).createTable('sprendimai', (table) => {
    table.increments('id').primary();

    table.integer('spren_req_id').nullable();
    table.integer('spren_vko_id').nullable();
    table.integer('spren_vks_id').nullable();
    table.bigint('spren_parent_id').nullable();

    table.string('spren_prasymo_pavad').nullable();
    table.string('spren_parent_pavad').nullable();

    table.string('spren_vkl_pavad').nullable();
    table.string('spren_vkl_adr').nullable();
    table.integer('spren_vkl_adr_aob').nullable();
    table.string('spren_vkl_adr_wgs').nullable();
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

    table.timestamp('spren_created_at').defaultTo(knex.fn.now());
    table.timestamp('spren_updated_at').defaultTo(knex.fn.now());

    table.string('spren_modif_user').nullable();
    table.boolean('spren_delete').defaultTo(false);

    table.integer('spren_tipas_id').nullable();
    table.string('spren_tipas').nullable();

    table.integer('spren_status_id').nullable();
    table.string('spren_sub_tipas').nullable();
    table.integer('spren_sub_tipas_id').nullable();
    table.string('spren_manager');

    table.integer('spren_prasymo_pavad_id').nullable();
    table.string('spren_modif_user_name').nullable();
    table.string('spren_created_user_name').nullable();
    table.string('spren_manager_name').nullable();

    table.integer('spren_in_created_by').nullable();
    table.date('spren_req_date').nullable();
    table.text('spren_legal').nullable();
    table.text('spren_refusal').nullable();

    table.string('spren_manager_dep').nullable();
    table.string('spren_susijes_reg_nr').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).dropTable('sprendimai');
};
