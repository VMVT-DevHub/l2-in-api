'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  Table,
  UserEvartai,
} from '../types';
import DbConnection from './../mixins/database.mixin';

import { TenantUserRole } from './tenantUsers.service';

interface Fields extends CommonFields {
  id: number;
  name: string;
  role: undefined;
  authGroup: number;
}

interface Populates extends CommonPopulates {
  role: TenantUserRole;
  authGroup: any;
}

export type Tenant<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'tenants',
  mixins: [
    DbConnection({
      collection: 'tenants',
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
      name: 'string',
      email: 'string',
      phone: 'string',
      code: 'string',
      address: 'string',
      ...COMMON_FIELDS,
    },
    scopes: {
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },

  actions: {
    create: {
      rest: null,
    },
    remove: {
      rest: null,
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    params: {
      email: 'string|optional',
      phone: 'string|optional',
      name: 'string|optional',
    },
  })
  async findOrCreate(
    ctx: Context<{
      authUser?: UserEvartai;
    }>,
  ) {
    const { authUser } = ctx.params;

    if (!authUser?.companyCode) return;

    const tenant: Tenant = await ctx.call('tenants.findOne', {
      query: {
        code: authUser.companyCode,
      },
    });

    if (tenant && tenant.id) return tenant;

    const dataToSave = {
      name: authUser.companyName,
      email: authUser.companyEmail,
      phone: authUser.companyPhone,
      code: authUser.companyCode,
    };

    if (tenant?.id) {
      return ctx.call('tenants.update', {
        ...dataToSave,
        id: tenant.id,
      });
    }

    return ctx.call('tenants.create', {
      ...dataToSave,
    });
  }
}
