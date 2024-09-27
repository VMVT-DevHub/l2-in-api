require('dotenv').config();

const commonFields = (table) => {
  table.timestamp('createdAt');
  table.timestamp('updatedAt');
  table.timestamp('deletedAt');
  table.timestamp('createdBy');
  table.timestamp('updatedBy');
  table.timestamp('deletedBy');
};

const schema = process.env.DB_SCHEMA || 'public';

exports.commonFields = commonFields;
exports.schema = schema;
