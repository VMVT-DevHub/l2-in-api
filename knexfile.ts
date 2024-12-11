const { knexSnakeCaseMappers } = require('objection');
require('dotenv').config();

// Update with your config settings.
if (!process.env.DB_CONNECTION) {
  throw new Error('No DB_CONNECTION env variable!');
}

const dirs = ['./database/migrations'];

if (process.env.NODE_ENV === 'local') {
  dirs.push('./database/migrations-local');
}

export const config = {
  client: 'pg',
  connection: process.env.DB_CONNECTION,
  migrations: {
    tableName: 'migrations',
    schemaName: process.env.DB_SCHEMA,
    directory: dirs,
  },
  pool: { min: 0, max: 7 },
  ...knexSnakeCaseMappers(),
};

export default config;
