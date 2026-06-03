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
    const session = ctx.meta.session;
    if (!session?.user) return null;

    return {
      user: session.user,
      companyCode: session.companyCode ?? null,
      companyName: session.companyName ?? null,
      activeOrgCode: session.activeOrgCode ?? null,
      roles: session.roles ?? { orgs: [] },
      ak: session.ak ?? null,
    };
  }

  @Action({
    rest: 'POST /sign',
    auth: RestrictionType.PUBLIC,
    params: {
      appHost: { type: 'string', optional: true },
    },
  })
  async sign(ctx: Context<{ appHost?: string }, ResponseHeadersMeta>) {
    try {
      const { appHost } = ctx.params;
      const response: {
        ticket: string;
        host: string;
        url: string;
      } = await ctx.call('http.get', {
        url: `${this.getViispHost(ctx)}`,
        opt: {
          responseType: 'json',
          headers: this.getViispHeaders(ctx),
        },
      });

      if (!response?.ticket || !response?.url) {
        throwBadRequestError('Invalid VIISP sign response');
      }

      if (appHost && response?.ticket && this.isAllowedAppHost(appHost)) {
        await this.broker.cacher?.set(`viisp:ticket:${response.ticket}:appHost`, appHost, 60 * 15);
      }

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
      let userRoles: DelegatedOrgs | null = null;
      const viispHost = this.getViispHost(ctx);
      const viispHeaders = this.getViispHeaders(ctx);
      const appHostFromCache = (await this.broker.cacher?.get(
        `viisp:ticket:${ticket}:appHost`,
      )) as unknown;
      const appHost = typeof appHostFromCache === 'string' ? appHostFromCache : null;

      const res: ViispUserRaw = await ctx.call('http.get', {
        url: `${viispHost}/${ticket}`,
        opt: { responseType: 'json', headers: viispHeaders },
      });

      let firstName = res.firstName;
      let lastName = res.lastName;
      if (!firstName && !lastName && typeof res.name === 'string') {
        const [ln, fn] = res.name.split(',').map((s) => s.trim());
        lastName = ln || undefined;
        firstName = fn || undefined;
      }

      const authUser: UserEvartai = {
        uuid: String(res.id),
        firstName,
        lastName,
        personalCode: String(res.ak ?? res.personalCode ?? '').trim(),
        ak: String(res.ak ?? ''),
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
        authUser.companyName =
          (await this.getOrgName(ctx, Number(authUser.companyCode))) ?? undefined;
      }

      if (!authUser.companyCode) {
        const rawRoles = (await ctx.call('http.get', {
          url: `${viispHost}/roles/${authUser.uuid}`,
          opt: { responseType: 'json', headers: viispHeaders },
        })) as unknown;

        const roles: DelegatedOrgs = {
          orgs:
            (rawRoles as any)?.orgs?.map((o: any) => ({
              ...o,
              id: String(o.id),
              roles: Array.isArray(o.roles) ? o.roles.map(String) : [],
            })) ?? [],
        };

        const eligible = (roles?.orgs ?? []).filter(
          (o) => Array.isArray(o.roles) && o.roles.includes('user'),
        );

        if (eligible.length > 0) {
          const orgsWithNames = await this.resolveDelegatedOrgs(ctx, eligible);
          userRoles = orgsWithNames;
        }
      }
      const user: User = await ctx.call('users.findOrCreate', { authUser });
      await this.startSession(
        ctx,
        user,
        authUser.companyCode,
        authUser.companyName,
        authUser.ak,
        userRoles,
        appHost || undefined,
      );
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

    const details = await this.getOrgDetails(
      ctx,
      Number(session.companyCode || session.activeOrgCode),
    );

    return {
      ...session.user,
      companyCode: session.companyCode ?? null,
      companyName: session.companyName || details?.pavad || null,
      activeOrgCode: session.activeOrgCode ?? null,
      roles: session.roles ?? { orgs: [] },
      form: details?.forma ?? null,
      address: details?.adresas ?? null,
      aob: details?.aobKodas,
      name: details?.pavad,
      ak: session.ak ?? null,
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
    await this.broker.cacher?.set(key, { ...blob, activeOrgCode: ctx.params.orgCode }, 60 * 60 * 1);

    session.activeOrgCode = ctx.params.orgCode;
    return { activeOrgCode: session.activeOrgCode };
  }

  @Action({ rest: 'DELETE /session/active-org' })
  async clearActiveOrg(ctx: Context<unknown, MetaSession>): Promise<ActiveOrgResponse> {
    const session = ctx.meta.session;
    if (!session?.user?.id) return { activeOrgCode: null };

    const key = `sess:${session.sid}`;
    const blob = (await this.broker.cacher?.get(key)) || {};
    await this.broker.cacher?.set(key, { ...blob, activeOrgCode: null }, 60 * 60 * 1);

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
    rest: 'GET /delegate/org/users',
  })
  async listDelegatedUsers(ctx: Context<unknown, MetaSession>) {
    const session = ctx.meta.session;
    if (!session?.user?.id) throwUnauthorizedError('Not authenticated');
    if (!session?.companyCode) throwUnauthorizedError('Only company users can view delegates');

    const orgId = String(session?.companyCode);

    try {
      const viispHeaders = this.getViispHeaders(ctx);
      const viispHost = this.getViispHost(ctx);
      const url = `${viispHost}/roles/org/${orgId}`;
      const res = await ctx.call('http.get', {
        url,
        opt: { responseType: 'json', headers: viispHeaders },
      });
      return res;
    } catch (err) {
      throwBadRequestError('Cannot fetch delegated users', err);
    }
  }

  @Action({
    rest: 'POST /delegate/org',
    params: {
      ak: { type: 'string', empty: false, trim: true, pattern: '^[0-9]{6,20}$' },
      firstName: { type: 'string', empty: false, trim: true },
      lastName: { type: 'string', empty: false, trim: true },
    },
  })
  async delegateUserToOrg(
    ctx: Context<{ ak: string; firstName: string; lastName: string }, MetaSession>,
  ) {
    const session = ctx.meta.session;
    if (!session?.user?.id) throwUnauthorizedError('Not authenticated');
    if (!session?.companyCode) throwUnauthorizedError('Only company users can delegate');

    const { ak, firstName, lastName } = ctx.params;

    try {
      const viispHeaders = this.getViispHeaders(ctx);
      const viispHost = this.getViispHost(ctx);
      const createUrl = `${viispHost}/user`;

      const createRes: any = await ctx.call('http.post', {
        url: createUrl,
        opt: {
          json: { ak, firstName, lastName },
          responseType: 'json',
          headers: viispHeaders,
        },
      });

      const userGuid: string = String(createRes?.id ?? '');
      if (!userGuid) throwBadRequestError('Upstream did not return user GUID');

      const roleUrl = `${viispHost}/roles/org/${session?.companyCode}/${userGuid}/user`;
      await ctx.call('http.post', {
        url: roleUrl,
        opt: { responseType: 'json', headers: viispHeaders },
      });

      return { orgId: String(session?.companyCode), userGuid, role: 'user' };
    } catch (err) {
      throwBadRequestError('Cannot delegate user to organisation', err);
    }
  }

  @Action({
    rest: 'DELETE /delegate/org/:userGuid',
    params: {
      userGuid: { type: 'string', empty: false, trim: true },
    },
  })
  async removeDelegatedUser(ctx: Context<{ userGuid: string }, MetaSession>) {
    const session = ctx.meta.session;
    if (!session?.user?.id) throwUnauthorizedError('Not authenticated');
    if (!session?.companyCode) throwUnauthorizedError('Only company users can remove delegates');

    const orgId = String(session?.companyCode);
    const { userGuid } = ctx.params;

    try {
      const viispHeaders = this.getViispHeaders(ctx);
      const viispHost = this.getViispHost(ctx);
      const url = `${viispHost}/roles/org/${orgId}/${userGuid}/user`;
      await ctx.call('http.delete', {
        url,
        opt: { responseType: 'json', headers: viispHeaders },
      });
      return { orgId, userGuid, removed: true };
    } catch (err) {
      throwBadRequestError('Cannot remove delegated user', err);
    }
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
    ak?: string,
    userRoles?: DelegatedOrgs | null,
    redirectUrl?: string,
  ) {
    const sid = crypto.randomUUID();

    await this.broker.cacher?.set(
      `sess:${sid}`,
      {
        userId: user.id,
        companyCode: companyCode ?? null,
        companyName: companyName ?? null,
        ak: ak ?? null,
        roles: userRoles ?? null,
        activeOrgCode: companyCode ?? null,
      },
      60 * 60 * 1,
    );

    const token = generateToken({ sub: String(user.id), sid }, process.env.ACCESS_JWT_SECRET!);

    ctx.meta.$responseHeaders = {
      'Set-Cookie': cookie.serialize('vmvt-auth-token', token, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 1, // 1 hour
      }),
    };
    ctx.meta.$statusCode = 302;
    ctx.meta.$location = redirectUrl || this.getFrontendUrl(ctx);
  }

  @Method
  async getOrgName(ctx: Context, id: number): Promise<string | null> {
    try {
      const details = await ctx.call('http.get', {
        url: `https://registrai.vmvt.lt/jar/details?id=${id}`,
        opt: { responseType: 'json' },
      });

      const d = details as any;
      return typeof d?.pavad === 'string' && d.pavad.trim() ? d.pavad.trim() : null;
    } catch {
      return null;
    }
  }

  @Method
  async getOrgDetails(
    ctx: Context,
    id: number,
  ): Promise<{
    pavad: string | null;
    forma: string | null;
    aobKodas: number | null;
    adresas: string | null;
  } | null> {
    try {
      const details = await ctx.call('http.get', {
        url: `https://registrai.vmvt.lt/jar/details?id=${id}`,
        opt: { responseType: 'json' },
      });
      const d = details as any;

      const { pavad, forma, aobKodas, adresas } = d;
      return { pavad, forma, aobKodas: aobKodas != null ? String(aobKodas) : aobKodas, adresas };
    } catch {
      return null;
    }
  }

  @Method
  async resolveDelegatedOrgs(
    ctx: Context,
    eligible: DelegatedOrgs['orgs'],
  ): Promise<DelegatedOrgs> {
    const resolved: DelegatedOrgs = { orgs: [] };

    for (const org of eligible) {
      const orgName = await this.getOrgName(ctx, Number(org.id));
      resolved.orgs.push({ ...org, orgName: orgName ?? undefined });
    }

    return resolved;
  }

  @Method
  isAllowedAppHost(appHost: string) {
    try {
      const url = new URL(appHost);
      return [
        'localhost',
        'sertifikatai.test.vmvt.lt',
        'sertifikatai.vmvt.lt',
        'eportalas.vmvt.lt',
        'eportalas.test.vmvt.lt',
      ].includes(url.hostname);
    } catch {
      return false;
    }
  }

  @Method
  getViispHost(ctx: Context<any, any>) {
    const isVks = ctx?.meta?.appVariant === 'vks';
    if (isVks) {
      return process.env.VKS_VIISP_HOST || process.env.VIISP_HOST;
    }
    return process.env.VIISP_HOST;
  }

  @Method
  getViispApiKey(ctx: Context<any, any>) {
    const isVks = ctx?.meta?.appVariant === 'vks';
    this.logger.info('Using VIISP API key source', {
      appVariant: ctx?.meta?.appVariant,
      source: isVks && process.env.VKS_VIISP_API_KEY ? 'VKS_VIISP_API_KEY' : 'VIISP_API_KEY',
      hasVksKey: !!process.env.VKS_VIISP_API_KEY,
      hasDefaultKey: !!process.env.VIISP_API_KEY,
    });

    if (isVks) {
      return process.env.VKS_VIISP_API_KEY || process.env.VIISP_API_KEY;
    }
    return process.env.VIISP_API_KEY;
  }

  @Method
  getViispHeaders(ctx: Context<any, any>) {
    return { 'x-api-Key': this.getViispApiKey(ctx), Accept: 'application/json' };
  }

  @Method
  getFrontendUrl(ctx: Context<any, any>) {
    const isVks = ctx?.meta?.appVariant === 'vks';
    if (isVks) {
      return process.env.VKS_FRONTEND_URL || process.env.FRONTEND_URL;
    }
    return process.env.FRONTEND_URL;
  }
}
