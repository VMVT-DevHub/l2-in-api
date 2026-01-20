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

const VIISP_BASE_URL = process.env.VIISP_HOST;
const VIISP_API_KEY = process.env.VIISP_API_KEY!;
const viispHeaders = () => ({ 'x-api-Key': VIISP_API_KEY, Accept: 'application/json' });

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
        url: `${VIISP_BASE_URL}`,
        opt: {
          responseType: 'json',
          headers: viispHeaders(),
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
        url: `${VIISP_BASE_URL}/${ticket}`,
        opt: { responseType: 'json', headers: viispHeaders() },
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
        const rawRoles = (await ctx.call('http.get', {
          url: `${VIISP_BASE_URL}/roles/${authUser.uuid}`,
          opt: { responseType: 'json', headers: viispHeaders() },
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
    rest: 'GET /delegate/org/users',
  })
  async listDelegatedUsers(ctx: Context<unknown, MetaSession>) {
    const session = ctx.meta.session;
    if (!session?.user?.id) throwUnauthorizedError('Not authenticated');
    if (!session.companyCode) throwUnauthorizedError('Only company users can view delegates');

    const orgId = String(session.companyCode);

    try {
      const url = `${VIISP_BASE_URL}/roles/org/${orgId}`;
      const res = await ctx.call('http.get', {
        url,
        opt: { responseType: 'json', headers: viispHeaders() },
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
    if (!session.companyCode) throwUnauthorizedError('Only company users can delegate');

    const { ak, firstName, lastName } = ctx.params;

    try {
      const createUrl = `${VIISP_BASE_URL}/user`;

      const createRes: any = await ctx.call('http.post', {
        url: createUrl,
        opt: {
          json: { ak, firstName, lastName },
          responseType: 'json',
          headers: viispHeaders(),
        },
      });

      const userGuid: string = String(createRes?.id ?? '');
      if (!userGuid) throwBadRequestError('Upstream did not return user GUID');

      const roleUrl = `${VIISP_BASE_URL}/roles/org/${session.companyCode}/${userGuid}/user`;
      await ctx.call('http.post', {
        url: roleUrl,
        opt: { responseType: 'json', headers: viispHeaders() },
      });

      return { orgId: String(session.companyCode), userGuid, role: 'user' };
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
    if (!session.companyCode) throwUnauthorizedError('Only company users can remove delegates');

    const orgId = String(session.companyCode);
    const { userGuid } = ctx.params;

    try {
      const url = `${VIISP_BASE_URL}/roles/org/${orgId}/${userGuid}/user`;
      await ctx.call('http.delete', {
        url,
        opt: { responseType: 'json', headers: viispHeaders() },
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
      resolved.orgs.push({ ...org, orgName });
    }

    return resolved;
  }
}
