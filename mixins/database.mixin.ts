'use strict';

import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';
import { set } from 'lodash';
import { config } from '../knexfile';

export default function (opts: any = {}) {
  set(opts, 'adapter.options.schema', process.env.DB_SCHEMA);

  const schema = {
    mixins: [DatabaseMixin(opts.config || config, opts)],
  };

  return schema;
}
