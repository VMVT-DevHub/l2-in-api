'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  CommonFields,
  CommonPopulates,
  RestrictionType,
  SCOPE_VKO_DECISIONS,
  Table,
} from '../types';
import { VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE } from '../utils/scopes';

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
    scopes: {
      ...SCOPE_VKO_DECISIONS,
      ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE.scopes,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES, ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE.names],
  },
})
export default class extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /:id',
  })
  async get(ctx: Context<{ id: number }>) {
    const rows = await this.findEntities(ctx, {
      query: {
        id: ctx?.params?.id,
      },
    });

    const r = rows[0];

    if (!r) return null;

    return {
      id: r.id,
      cert: r.certNr,
      certBlankas: r.certBlankas,
      certTikrinimas: r.certTikrinimas,
    };
  }
}
