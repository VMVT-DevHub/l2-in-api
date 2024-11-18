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
  @Action({
    params: {
      authUser: 'object',
    },
  })
  async findOrCreate(
    ctx: Context<{
      authUser: UserEvartai;
    }>,
  ) {
    const { authUser } = ctx.params;
    if (!authUser) return;

    const scope = COMMON_DEFAULT_SCOPES;

    const user: User = await ctx.call(`users.findOne`, {
      query: {
        code: authUser.personalCode,
      },
      scope,
    });

    const dataToSave = {
      code: authUser.personalCode,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      email: authUser.email,
      phone: authUser.phone,
    };

    // let user to customize his phone and email
    if (user?.email) {
      delete dataToSave.email;
    }
    if (user?.phone) {
      delete dataToSave.phone;
    }

    if (user?.id) {
      return this.updateEntity(
        ctx,
        {
          id: user.id,
          ...dataToSave,
        },
        { scope },
      );
    }

    return this.createEntity(ctx, {
      ...dataToSave,
    });
  }
}
