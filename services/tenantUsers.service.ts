'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

import DbConnection from '../mixins/database.mixin';
import { COMMON_DEFAULT_SCOPES, COMMON_FIELDS, COMMON_SCOPES, CommonFields } from '../types';
import { Tenant } from './tenants.service';
import { User } from './users.service';

export enum TenantUserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export interface TenantUser extends CommonFields {
  id: number;
  tenant: number | Tenant;
  user: number | User;
  role: TenantUserRole;
}

@Service({
  name: 'tenantUsers',
  mixins: [
    DbConnection({
      rest: false,
      collection: 'tenantUsers',
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
      tenant: {
        type: 'number',
        columnName: 'tenantId',
        immutable: true,
        required: true,
        populate: 'tenants.resolve',
      },
      user: {
        type: 'number',
        columnName: 'userId',
        immutable: true,
        required: true,
        populate: `users.resolve`,
      },
      role: {
        type: 'string',
        enum: Object.values(TenantUserRole),
        default: TenantUserRole.USER,
      },
      ...COMMON_FIELDS,
    },
    scopes: {
      ...COMMON_SCOPES,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES],
  },
})
export default class extends moleculer.Service {
  @Action({
    params: {
      user: 'number|convert',
      tenant: 'number|convert',
      role: 'string',
    },
  })
  async findOrCreate(
    ctx: Context<{
      user: number;
      tenant: number;
      role: TenantUserRole;
    }>,
  ) {
    const { user, tenant, role } = ctx.params;

    if (!user || !tenant) return;

    const tenantUser: Tenant = await ctx.call('tenantUsers.findOne', {
      query: ctx.params,
    });

    if (tenantUser) return tenantUser;

    return this.createEntity(ctx, { user, tenant, role });
  }
}
