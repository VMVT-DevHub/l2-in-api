const schema = process.env.DB_SCHEMA || 'public';
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.integer('district').index('district_idx').nullable();
    table.string('action').index('requests_action_idx').nullable();
    table.string('action_place').index('requests_action_place_idx').nullable();
  });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION "${schema}".vko_sort_trg()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."action" := NEW."data"->'veiklos'->>'veikla';
      NEW."action_place" := NEW."data"->'veiklaviete'->'pavadinimas'->>'pavadinimas';
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS vko_sort_trigger ON "${schema}".requests;

    CREATE TRIGGER vko_sort_trigger
    BEFORE INSERT OR UPDATE ON "${schema}".requests
    FOR EACH ROW
    EXECUTE FUNCTION "${schema}".vko_sort_trg();
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."district_idx"`);
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."requests_action_idx"`);
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."requests_action_place_idx"`);

  await knex.raw(`DROP TRIGGER IF EXISTS vko_sort_trigger ON "${schema}".requests;`);

  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('district');
    table.dropColumn('action');
    table.dropColumn('action_place');
  });
};
