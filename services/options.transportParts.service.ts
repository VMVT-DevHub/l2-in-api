'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

interface Fields extends CommonFields {
  id: string;
  name: string;
  sort: number;
}

interface Populates extends CommonPopulates {}

export type TransportPart<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'options.transportParts',
  mixins: [
    DbConnection({
      collection: 'vLkpCargoType',
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
        type: 'string',
        columnType: 'string',
        primaryKey: true,
        secure: true,
      },
      name: {
        type: 'string',
        columnName: 'title',
      },
      sort: {
        type: 'number',
        columnName: 'sort',
      },
    },
  },
  actions: {
    find: {
      auth: RestrictionType.PUBLIC,
      rest: 'GET /all',
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /ids',
    auth: RestrictionType.PUBLIC,
  })
  async findIds(ctx: Context<any>) {
    return (await this.findEntities(ctx, { fields: ['id'] })).map((item: TransportPart) => item.id);
  }

  @Action()
  async seedDB() {
    await this.seedCsv('transporto-dalys', ['id', 'name', 'sort']);
  }
}
