const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  await knex.schema.withSchema(schema).alterTable('users', (table) => {
    table.uuid('uuid').nullable();
  });

  // 2) Add a partial unique index for non-null uuids (zero-downtime)
  await knex.raw(
    `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "users_uuid_unique_idx"
     ON "${schema}"."users" (uuid)
     WHERE uuid IS NOT NULL`,
  );
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS "${schema}"."users_uuid_unique_idx"`);

  await knex.schema.withSchema(schema).alterTable('users', (table) => {
    table.dropColumn('uuid');
  });
};

// Required because CREATE INDEX CONCURRENTLY cannot run inside a transaction
exports.config = { transaction: false };
