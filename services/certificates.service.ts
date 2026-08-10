'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

const schema = 'export';

interface Fields extends CommonFields {
  id: string;
  name: string;
  actionId: string;
  actionTitle: string;
  date: Date;
}

interface Populates extends CommonPopulates {}

export type TransportType<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'certificates',
  mixins: [
    DbConnection({
      collection: 'sertifikatai',
      schema: schema,
      createActions: {
        create: false,
        update: false,
        remove: false,
        createMany: false,
        removeAllEntities: false,
      },
      rest: null,
    }),
  ],
  settings: {
    fields: {
      id: {
        type: 'number',
        primaryKey: true,
        secure: true,
        columnName: 'id',
      },
      certNr: {
        type: 'string',
      },
      certBlankas: {
        type: 'string',
      },
      certTikrinimas: {
        type: 'boolean',
      },
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'POST /batch',
    params: {
      certNrs: { type: 'array', items: 'string' },
    },
  })
  async getCerts(ctx: Context<{ certNrs: string[] }>) {
    const rows = await this.findEntities(ctx, {
      query: {
        certNr: ctx?.params?.certNrs,
      },
    });

    const result: Record<string, boolean> = {};
    for (const row of rows) {
      result[row.certNr] = row.certTikrinimas;
    }

    return result;
  }
}
