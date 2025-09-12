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
  UserRoles,
  ViispUserRaw,
} from '../types';
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
    auth: RestrictionType.PUBLIC,
  })
  async sign(ctx: Context<{}, ResponseHeadersMeta>) {
    try {
      const response: {
        ticket: string;
        host: string;
        url: string;
      } = await ctx.call('http.get', {
        url: `${process.env.VIISP_HOST}`,
        opt: {
          responseType: 'json',
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
    },
    auth: RestrictionType.PUBLIC,
  })
  async login(ctx: Context<{ ticket: string }, ResponseHeadersMeta>) {
    try {
      const { ticket } = ctx.params;

      const res: ViispUserRaw = await ctx.call('http.get', {
        url: `${process.env.VIISP_HOST}/${ticket}`,
        opt: { responseType: 'json' },
      });

      let firstName = res.firstName;
      let lastName = res.lastName;
      if (!firstName && !lastName && typeof res.name === 'string') {
        const [ln, fn] = res.name.split(',').map((s) => s.trim());
        lastName = ln || undefined;
        firstName = fn || undefined;
      }

      const authUser: UserEvartai = {
        uuid: res.id,
        firstName,
        lastName,
        personalCode: String(res.ak ?? res.personalCode ?? '').trim(),
        companyCode: (res.company?.code ?? res.companyCode)?.toString(),
        email: res.email,
        phone: res.phone,
        companyName: res.companyName ?? res.company?.name,
        companyEmail: res.companyEmail ?? res.company?.email,
        companyPhone: res.companyPhone ?? res.company?.phone,
      };

      if (!authUser.personalCode) {
        throwUnauthorizedError('Missing personalCode from identity provider');
      }

      const userRoles: UserRoles = await ctx.call('http.get', {
        url: `${process.env.VIISP_HOST}/roles/${authUser.uuid}`,
        opt: { responseType: 'json' },
      });

      const user: User = await ctx.call('users.findOrCreate', { authUser });
      await this.startSession(ctx, user, authUser.companyCode, userRoles);
    } catch (err) {
      throwBadRequestError('Cannot login', err);
    }
  }

  @Action({
    rest: 'GET /me',
  })
  async me(ctx: Context<unknown, MetaSession>) {
    const session = ctx.meta.session;
    if (!session) return null;

    return {
      ...session.user,
      companyCode: session.companyCode ?? null,
      roles: session.roles ?? { orgs: [] },
    };
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
    ctx: Context<{}, ResponseHeadersMeta & MetaSession>,
    user: User,
    companyCode?: string,
    userRoles?: UserRoles,
  ) {
    const sid = crypto.randomUUID();

    await this.broker.cacher?.set(
      `sess:${sid}`,
      {
        userId: user.id,
        companyCode: companyCode ?? null,
        roles: userRoles ?? null,
      },
      60 * 60 * 24,
    );

    const token = generateToken({ sub: String(user.id), sid }, process.env.ACCESS_JWT_SECRET);

    ctx.meta.$responseHeaders = {
      'Set-Cookie': cookie.serialize('vmvt-auth-token', token, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24, // 1 day
      }),
    };
    ctx.meta.$statusCode = 302;
    ctx.meta.$location = process.env.FRONTEND_URL;
  }
}
