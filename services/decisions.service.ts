'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

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
  name: 'decisions',
  mixins: [
    DbConnection({
      collection: 'sprendimai',
      schema: 'vko',
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
      name: {
        type: 'string',
        columnName: 'sprenParentPavad',
      },
      actionId: {
        type: 'string',
        columnName: 'sprenVklVeiklaId',
      },
      actionTitle: {
        type: 'string',
        columnName: 'sprenVklPavad',
      },
      date: {
        type: 'date',
        columnName: 'sprenDokData',
      },
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /all',
  })
  async list(ctx: Context) {
    const rows = await this.findEntities(ctx);

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      action: {
        id: r.actionId,
        title: r.actionTitle,
      },
    }));
  }

  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /:id',
  })
  async get(ctx: Context) {
    const rows = await this.findEntities(ctx, {
      query: {
        // id: ctx.params.id;
      },
    });

    const r = rows[0];

    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      date: r.date,
      action: {
        id: r.actionId,
        title: r.actionTitle,
      },
    };
  }
}
