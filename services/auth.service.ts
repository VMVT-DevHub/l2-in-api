'use strict';

import { generateToken } from '@aplinkosministerija/moleculer-accounts';
import cookie from 'cookie';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';

import {
  MetaSession,
  ResponseHeadersMeta,
  RestrictionType,
  throwBadRequestError,
  throwUnauthorizedError,
  UserEvartai,
} from '../types';
import { Tenant } from './tenants.service';
import { TenantUserRole } from './tenantUsers.service';
import { User } from './users.service';

@Service({
  name: 'auth',
})
export default class AuthService extends moleculer.Service {
  @Action({
    rest: 'GET /current',
  })
  async current(ctx: Context<unknown, MetaSession>) {
    return ctx.meta.session;
  }

  @Action({
    rest: 'POST /sign',
    params: {
      appHost: 'string',
    },
    auth: RestrictionType.PUBLIC,
  })
  async sign(ctx: Context<{ appHost: string }, ResponseHeadersMeta>) {
    try {
      const response: {
        ticket: string;
        host: string;
        url: string;
      } = await ctx.call('http.post', {
        url: `${process.env.VIISP_HOST}/auth/sign`,
        opt: {
          responseType: 'json',
          json: ctx.params,
        },
      });
      ctx.meta.$statusCode = 302;
      ctx.meta.$location = response?.url;
    } catch (err) {
      throwBadRequestError('Cannot sign ticket', err);
    }
  }

  @Action({
    rest: 'POST /login',
    params: {
      ticket: 'string',
      customData: 'string',
    },
    auth: RestrictionType.PUBLIC,
  })
  async login(ctx: Context<{ ticket: string; customData: string }, ResponseHeadersMeta>) {
    try {
      const { ticket } = ctx.params;

      const authUser: UserEvartai = await ctx.call('http.get', {
        url: `${process.env.VIISP_HOST}/auth/data?ticket=${ticket}`,
        opt: {
          responseType: 'json',
        },
      });

      if (!authUser) throwUnauthorizedError('Login unsuccessful');

      const user: User = await ctx.call('users.findOrCreate', { authUser });
      const tenant: Tenant = await ctx.call('tenants.findOrCreate', { authUser });

      if (user?.id && tenant?.id) {
        await ctx.call('tenantUsers.findOrCreate', {
          user: user.id,
          tenant: tenant.id,
          role: TenantUserRole.ADMIN,
        });
      }

      await this.startSession(ctx, user);
    } catch (err) {
      throwBadRequestError('Cannot login', err);
    }
  }

  @Action({
    rest: 'GET /me',
  })
  async me(ctx: Context<unknown, MetaSession>) {
    return ctx.meta.session?.user;
  }

  @Action({
    params: {
      token: 'string',
    },
  })
  async finish(ctx: Context<{ token: string }, ResponseHeadersMeta>) {
    this.removeCookie(ctx);
  }

  @Action({
    rest: 'POST /cancel',
  })
  async cancel(ctx: Context<unknown, MetaSession & ResponseHeadersMeta>) {
    this.removeCookie(ctx);
  }

  @Method
  removeCookie(ctx: Context<unknown, ResponseHeadersMeta>) {
    ctx.meta.$responseHeaders = {
      'Set-Cookie': cookie.serialize('vmvt-auth-token', '', {
        path: '/',
        httpOnly: true,
        maxAge: 0,
      }),
    };
  }

  @Method
  async startSession(
    ctx: Context<{ customData: string }, ResponseHeadersMeta & MetaSession>,
    user: User,
  ) {
    const token = generateToken(user, process.env.ACCESS_JWT_SECRET);
    ctx.meta.$responseHeaders = {
      'Set-Cookie': cookie.serialize('vmvt-auth-token', token, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24, // 1 day
      }),
    };
    const customData = JSON.parse(ctx.params.customData);
    ctx.meta.$statusCode = 302;
    ctx.meta.$location = customData?.appHost;
  }
}
