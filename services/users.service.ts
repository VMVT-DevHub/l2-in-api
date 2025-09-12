'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { COMMON_DEFAULT_SCOPES, COMMON_FIELDS, COMMON_SCOPES, UserEvartai } from '../types';

import DbConnection from '../mixins/database.mixin';

export enum UserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

@Service({
  name: 'users',
  mixins: [
    DbConnection({
      collection: 'users',
      entityChangedOldEntity: true,
      createActions: {
        createMany: false,
      },
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
        hidden: 'byDefault',
      },
      uuid: 'string',
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
      ...COMMON_FIELDS,
    },
    scopes: {
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
})
export default class UsersService extends moleculer.Service {
  @Action({ params: { authUser: 'object' } })
  async findOrCreate(ctx: Context<{ authUser: UserEvartai }>) {
    const { authUser } = ctx.params;
    if (!authUser) return;

    const scope = COMMON_DEFAULT_SCOPES;

    const data: any = {
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      phone: authUser.phone,
    };

    if (authUser.uuid) {
      const byUuid: User = await ctx.call('users.findOne', {
        query: { uuid: authUser.uuid },
        scope,
      });

      if (byUuid?.id) {
        if (byUuid.email) delete data.email;
        if (byUuid.phone) delete data.phone;

        return this.updateEntity(ctx, { id: byUuid.id, ...data }, { scope });
      }
    }

    const byAk: User = await ctx.call('users.findOne', {
      query: { code: authUser.personalCode },
      scope,
    });

    if (byAk?.id) {
      if (byAk.email) delete data.email;
      if (byAk.phone) delete data.phone;

      return this.updateEntity(
        ctx,
        {
          id: byAk.id,
          uuid: authUser.uuid || null,
          code: null, // remove AK
          ...data,
        },
        { scope },
      );
    }

    return this.createEntity(ctx, {
      uuid: authUser.uuid || null,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      phone: authUser.phone,
    });
  }
}
