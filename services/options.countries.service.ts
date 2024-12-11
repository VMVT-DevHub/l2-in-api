'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

interface Fields extends CommonFields {
  id: string;
  name: string;
  iso: string;
  search: string;
  es: boolean;
  elpa: boolean;
}

interface Populates extends CommonPopulates {}

export type Country<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'options.countries',
  mixins: [
    DbConnection({
      collection: 'salys',
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
        columnName: 'salPavad',
      },
      iso: {
        type: 'string',
        columnName: 'salIso2',
      },
      search: {
        type: 'string',
        columnName: 'salSearch',
      },
      es: {
        type: 'boolean',
        columnName: 'salEs',
      },
      elpa: {
        type: 'boolean',
        columnName: 'salElpa',
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
  async getCountryIds(ctx: Context<any>) {
    return (await this.findEntities(ctx, { fields: ['id'] })).map((item: Country) => item.id);
  }

  @Action({
    rest: 'GET /es',
    auth: RestrictionType.PUBLIC,
  })
  async getEsIds(ctx: Context<any>) {
    return (await this.findEntities(ctx, { fields: ['id'], query: { es: true } })).map(
      (item: Country) => item.id,
    );
  }

  @Action()
  async seedDB() {
    await this.seedCsv('salys', ['id', 'name', 'iso', 'search', 'es', 'elpa']);
  }
}
