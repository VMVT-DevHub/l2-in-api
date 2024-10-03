'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

interface Fields extends CommonFields {
  id: string;
  name: string;
  iso: string;
}

interface Populates extends CommonPopulates {}

export type Country<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'countries',
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
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /',
    auth: RestrictionType.PUBLIC,
  })
  async getCountries(ctx: Context<any>) {
    return this.findEntities(ctx);
  }

  @Action({
    rest: 'GET /ids',
    auth: RestrictionType.PUBLIC,
  })
  async getCountryIds(ctx: Context<any>) {
    return (await this.findEntities(ctx, { fields: ['id'] })).map((item: Country) => item.id);
  }

  @Action()
  async seedDB() {
    await this.seedCsv('salys', ['id', 'name', 'iso']);
  }
}
