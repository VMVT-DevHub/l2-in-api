require('dotenv').config();

const commonFields = (table) => {
  table.timestamp('createdAt');
  table.timestamp('updatedAt');
  table.timestamp('deletedAt');
  table.integer('createdBy').unsigned();
  table.integer('updatedBy').unsigned();
  table.integer('deletedBy').unsigned();
};

const schema = process.env.DB_SCHEMA || 'public';

exports.commonFields = commonFields;
exports.schema = schema;
