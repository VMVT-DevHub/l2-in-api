'use strict';

import { DatabaseMixin } from '@aplinkosministerija/moleculer-accounts';
import { parse } from 'csv-parse';
import { set } from 'lodash';
import fs from 'node:fs';
import { config } from '../knexfile';

export default function (opts: any = {}) {
  set(opts, 'adapter.options.schema', process.env.DB_SCHEMA);

  const schema = {
    mixins: [DatabaseMixin(opts.config || config, opts)],
    methods: {
      async seedCsv(fileName: string, columns: string[]) {
        if (process.env.NODE_ENV !== 'local') return;

        const records = [];

        const path = `${__dirname}/../database/seed/${fileName}.csv`;

        if (!fs.existsSync(path)) {
          return;
        }

        const parser = fs.createReadStream(path).pipe(parse());

        for await (const record of parser) {
          const obj: any = {};

          const values = record.map((c: string) => {
            if (c === 'NULL') return null;
            if (c === 'True') return true;
            if (c === 'False') return false;
            return c;
          });

          for (const key in values) {
            const value = values[key?.trim()];
            const column = columns[key?.trim() as any];
            obj[column] = value?.trim();
          }

          records.push(obj);
        }

        await this.createEntities(null, records.splice(1));
      },
    },
  };

  return schema;
}
