const schema = process.env.DB_SCHEMA || 'public';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TYPE "${schema}"."request_status" ADD VALUE IF NOT EXISTS 'REVIEW' BEFORE 'APPROVED';
  `);

  await knex.raw(`
    ALTER TYPE "${schema}"."request_history_type" ADD VALUE IF NOT EXISTS 'REVIEW' BEFORE 'APPROVED';
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function () {
  // PostgreSQL enum values cannot be safely removed without recreating the type.
};

exports.config = { transaction: false };
