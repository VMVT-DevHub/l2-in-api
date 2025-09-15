'use strict';

import { generateToken } from '@aplinkosministerija/moleculer-accounts';
import cookie from 'cookie';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';

import {
  ActiveOrgResponse,
  DelegatedOrgs,
  MetaSession,
  ResponseHeadersMeta,
  RestrictionType,
  UserEvartai,
  ViispUserRaw,
  throwBadRequestError,
  throwUnauthorizedError,
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
      let userRoles: DelegatedOrgs = null;

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

      if (authUser.companyCode && !authUser.companyName) {
        authUser.companyName = await this.getOrgName(ctx, Number(authUser.companyCode));
      }

      if (!authUser.companyCode) {
        const rawRoles: DelegatedOrgs = await ctx.call('http.get', {
          url: `${process.env.VIISP_HOST}/roles/${authUser.uuid}`,
          opt: { responseType: 'json' },
        });

        const eligible = (rawRoles?.orgs ?? []).filter(
          (o) => Array.isArray(o.roles) && o.roles.includes('user'),
        );

        if (eligible.length > 0) {
          const orgsWithNames = await this.resolveDelegatedOrgs(ctx, eligible);
          userRoles = orgsWithNames;
        }
      }

      const user: User = await ctx.call('users.findOrCreate', { authUser });
      await this.startSession(ctx, user, authUser.companyCode, authUser.companyName, userRoles);
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
      companyName: session.companyName ?? null,
      activeOrgCode: session.activeOrgCode ?? null,
      roles: session.roles ?? { orgs: [] },
    };
  }

  @Action({
    rest: 'POST /session/active-org',
    params: { orgCode: { type: 'string', empty: false, trim: true, pattern: '^[0-9]+$' } },
  })
  async setActiveOrg(ctx: Context<{ orgCode: string }, MetaSession>): Promise<ActiveOrgResponse> {
    const session = ctx.meta.session!;
    const delegatedIds: string[] = (session.roles?.orgs ?? []).map((o) => String(o.id));

    if (!delegatedIds.includes(ctx.params.orgCode)) {
      throwBadRequestError('You do not have access to this organisation');
    }

    const key = `sess:${session.sid}`;
    const blob = (await this.broker.cacher?.get(key)) || {};
    await this.broker.cacher?.set(
      key,
      { ...blob, activeOrgCode: ctx.params.orgCode },
      60 * 60 * 24,
    );

    session.activeOrgCode = ctx.params.orgCode;
    return { activeOrgCode: session.activeOrgCode };
  }

  @Action({ rest: 'DELETE /session/active-org' })
  async clearActiveOrg(ctx: Context<unknown, MetaSession>): Promise<ActiveOrgResponse> {
    const session = ctx.meta.session;
    if (!session?.user?.id) return { activeOrgCode: null };

    const key = `sess:${session.sid}`;
    const blob = (await this.broker.cacher?.get(key)) || {};
    await this.broker.cacher?.set(key, { ...blob, activeOrgCode: null }, 60 * 60 * 24);

    session.activeOrgCode = null;
    return { activeOrgCode: null };
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
    companyName?: string,
    userRoles?: DelegatedOrgs,
  ) {
    const sid = crypto.randomUUID();

    await this.broker.cacher?.set(
      `sess:${sid}`,
      {
        userId: user.id,
        companyCode: companyCode ?? null,
        companyName: companyName ?? null,
        roles: userRoles ?? null,
        activeOrgCode: companyCode ?? null,
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

  @Method
  async getOrgName(ctx: Context, id: number): Promise<string> {
    try {
      const details = await ctx.call('http.get', {
        url: `https://registrai.vmvt.lt/jar/details?id=${id}`,
        opt: { responseType: 'json' },
      });

      const d = details as any;
      return typeof d?.pavad === 'string' && d.pavad.trim() ? d.pavad.trim() : 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }

  @Method
  async resolveDelegatedOrgs(
    ctx: Context,
    eligible: DelegatedOrgs['orgs'],
  ): Promise<DelegatedOrgs> {
    const resolved: DelegatedOrgs = { orgs: [] };

    for (const org of eligible) {
      const orgName = await this.getOrgName(ctx, org.id);
      resolved.orgs.push({ ...org, orgName });
    }

    return resolved;
  }
}
