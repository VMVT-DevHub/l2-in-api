const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.schema
    .withSchema(schema)

    .alterTable('requests', (table) => {
      table
        .specificType('product_names', 'varchar[]')
        .index('requests_productNames_idx', 'GIN')
        .nullable();
      table.string('import_country').index('requests_importCountry_idx').nullable();
      table
        .specificType('import_amount', 'varchar[]')
        .index('requests_importAmount_idx', 'GIN')
        .nullable();
    });

  await knex.raw(`
    CREATE OR REPLACE FUNCTION "${schema}".update_for_sort()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."product_names" := (
        SELECT array_agg(trim(both '"' from value::text))
        FROM jsonb_path_query(NEW."data"::jsonb, '$.prekes[*].pavadinimas') AS t(value)
      );

      NEW."import_country" := NEW."data"->'marsrutas'->'importuojanti-salis'->>'salis';

      NEW."import_amount" := (
        SELECT array_agg(
        trim(
          both '"' from ((elem->'kiekis-matas'->>'kiekis') || ' ' || (elem->'kiekis-matas'->>'matas'))
          )
        )
       FROM jsonb_array_elements(NEW."data"->'prekes') AS item(elem)
      );

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS info_for_sort_trigger ON "${schema}".requests;

    CREATE TRIGGER info_for_sort_trigger
    BEFORE INSERT OR UPDATE ON "${schema}".requests
    FOR EACH ROW
    EXECUTE FUNCTION "${schema}".update_for_sort();
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."requests_productNames_idx"`);
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."requests_importCountry_idx"`);
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."requests_importAmount_idx"`);

  await knex.raw(`DROP TRIGGER IF EXISTS info_for_sort_trigger ON "${schema}".requests;`);
  await knex.raw(`DROP FUNCTION IF EXISTS "${schema}".update_for_sort();`);

  await knex.schema.withSchema(schema).alterTable('requests', (table) => {
    table.dropColumn('product_names');
    table.dropColumn('import_country');
    table.dropColumn('import_amount');
  });
};
