'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

const schema = process.env.VKS_DB_SCHEMA || 'vks';

interface Fields extends CommonFields {
  id: string;
  code: string;
  name: string;
  display: string;
  activityCodes: string;
  allowedCategories: string;
}

interface Populates extends CommonPopulates {}

export type SGP<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'options.sgp',
  mixins: [
    DbConnection({
      collection: 'sgp_veiklos',
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
        type: 'string',
        columnType: 'integer',
        primaryKey: true,
        secure: true,
      },
      code: {
        type: 'string',
        columnName: 'code',
      },
      name: {
        type: 'string',
        columnName: 'title',
      },
      display: {
        type: 'string',
        columnName: 'display',
      },
      activityCodes: {
        type: 'string',
        columnName: 'activityCodes',
      },
      allowedCategories: {
        type: 'string',
        columnName: 'allowedCategories',
      },
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /all',
    auth: RestrictionType.PUBLIC,
  })
  async find(ctx: Context<any>) {
    const entities = (await this.findEntities(ctx)) as SGP[];
    return entities.map((item) => ({ ...item, id: String(item.id) }));
  }

  @Action({
    rest: 'GET /ids',
    auth: RestrictionType.PUBLIC,
  })
  async findIds(ctx: Context<any>) {
    return (await this.findEntities(ctx, { fields: ['id'] })).map((item: SGP) => String(item.id));
  }

  @Action()
  async seedDB() {
    await this.seedCsv('sgp_veiklos', [
      'id',
      'code',
      'name',
      'display',
      'activityCodes',
      'allowedCategories',
    ]);
  }
}
