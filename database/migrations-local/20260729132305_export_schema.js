const schema = 'export';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.createSchemaIfNotExists('export');

  await knex.schema.withSchema(schema).createTable('sertifikatai', (table) => {
    table.increments('id').primary();

    table.string('cert_nr').nullable();
    table.string('cert_blankas').nullable();
    table.boolean('cert_tikrinimas').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.withSchema(schema).dropTable('sertifikatai');
};
