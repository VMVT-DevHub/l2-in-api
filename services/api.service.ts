'use strict';

import { verifyToken } from '@aplinkosministerija/moleculer-accounts';
import cookie from 'cookie';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import ApiGateway, { IncomingRequest, Route } from 'moleculer-web';
import { MetaSession, RestrictionType, SessionBlob } from '../types';
import { User } from './users.service';

const API_WHITELIST = [
  'api.ping',

  'auth.sign',
  'auth.login',
  'auth.me',
  'auth.setActiveOrg',
  'auth.clearActiveOrg',
  'auth.listDelegatedUsers',
  'auth.delegateUserToOrg',
  'auth.removeDelegatedUser',
  'auth.cancel',

  'addresses.findGyv',
  'addresses.findAdr',
  'addresses.findDist',
  'addresses.findDistFromCoord',

  'decisions.getAll',
  'decisions.get',
  'decisions.getAddress',

  'formTypes.formTypes',
  'formTypes.formType',
  'formTypes.form',

  'options.activities.getActivities',
  'options.activities.getIDs',
  'options.animals.getRoot',
  'options.animals.getGroup',
  'options.animals.getGroupBySearch',
  'options.countries.find',
  'options.countries.getCountryIds',
  'options.countries.getEsIds',
  'options.kpn.getTree',
  'options.kpn.getAnimalsTree',
  'options.kpn.getLeafIds',
  'options.packageTypes.find',
  'options.packageTypes.findIds',
  'options.pkp.find',
  'options.pkp.findIds',
  'options.selfControl.getTree',
  'options.selfControl.getLeafIds',
  'options.transportParts.find',
  'options.transportParts.findIds',
  'options.transportTypes.find',
  'options.transportTypes.findIds',

  'reports.animal.list',
  'reports.certificate.list',
  'reports.food.list',

  'requests.list',
  'requests.get',
  'requests.create',
  'requests.update',
  'requests.remove',
  'requests.getHistory',

  'sharepoint.createFiles',
  'sharepoint.uploadFiles',
  'sharepoint.getDownloadUrlAction',
  'sharepoint.getDecisionDownloadUrlAction',
];

@Service({
  name: 'api',
  mixins: [ApiGateway],
  // More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
  // TODO: helmet
  settings: {
    port: process.env.PORT || 3000,

    // Global CORS settings for all routes
    cors: {
      // Configures the Access-Control-Allow-Origin CORS header.
      origin: '*',
      // Configures the Access-Control-Allow-Methods CORS header.
      methods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
      // Configures the Access-Control-Allow-Headers CORS header.
      allowedHeaders: '*',
      // Configures the Access-Control-Max-Age CORS header.
      maxAge: 3600,
    },

    routes: [
      {
        path: '',
        whitelist: API_WHITELIST,

        // Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
        use: [],

        // Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
        mergeParams: true,

        // Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
        authentication: true,

        // Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
        authorization: true,

        // The auto-alias feature allows you to declare your route alias directly in your services.
        // The gateway will dynamically build the full routes from service schema.
        autoAliases: true,

        aliases: {
          'GET /api/ping': 'api.ping',
        },

        // Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
        callingOptions: {},

        bodyParsers: {
          json: {
            strict: false,
            limit: '1MB',
          },
          urlencoded: {
            extended: true,
            limit: '1MB',
          },
        },

        // Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
        mappingPolicy: 'restrict', // Available values: "all", "restrict"

        // Enable/disable logging
        logging: true,

        onError: (req: any, res: any, err: any): void => {
          const status =
            typeof err?.code === 'number' && err.code >= 400 && err.code < 600 ? err.code : 500;

          const isClientError = status >= 400 && status < 500;

          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              name: 'error',
              message: isClientError ? 'Invalid request' : 'Internal server error',
              code: isClientError ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
            }),
          );
        },
      },
      {
        path: '/vks/api',
        whitelist: API_WHITELIST,
        use: [],
        mergeParams: true,
        authentication: true,
        authorization: true,
        autoAliases: true,
        aliases: {
          'GET /ping': 'api.ping',
        },
        callingOptions: {},
        bodyParsers: {
          json: {
            strict: false,
            limit: '1MB',
          },
          urlencoded: {
            extended: true,
            limit: '1MB',
          },
        },
        mappingPolicy: 'restrict',
        logging: true,
        onError: (req: any, res: any, err: any): void => {
          const status =
            typeof err?.code === 'number' && err.code >= 400 && err.code < 600 ? err.code : 500;

          const isClientError = status >= 400 && status < 500;

          res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              name: 'error',
              message: isClientError ? 'Invalid request' : 'Internal server error',
              code: isClientError ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
            }),
          );
        },
      },
    ],
    // Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
    log4XXResponses: false,
    // Logging the request parameters. Set to any log level to enable it. E.g. "info"
    logRequestParams: null,
    // Logging the response data. Set to any log level to enable it. E.g. "info"
    logResponseData: null,
    // Serve assets from "public" folder
    assets: {
      folder: 'public',
      // Options to `server-static` module
      options: {},
    },
  },
})
export default class ApiService extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
  })
  ping() {
    return {
      timestamp: Date.now(),
    };
  }

  @Method
  async authenticate(ctx: Context<unknown, MetaSession>, route: Route, req: IncomingRequest) {
    const reqUrl = req.url || '';
    const routePath = (route as any)?.path;
    const host = req.headers.host?.split(':')[0]?.toLowerCase();

    ctx.meta.appVariant =
      routePath === '/vks/api' ||
      host === 'eportalas.test.vmvt.lt' ||
      host === 'eportalas.vmvt.lt' ||
      reqUrl === '/vks' ||
      reqUrl.startsWith('/vks/') ||
      reqUrl === '/vks/api' ||
      reqUrl.startsWith('/vks/api/')
        ? 'vks'
        : 'default';

    this.logger.info('Gateway request', {
      host: req.headers.host,
      url: reqUrl,
      routePath,
      appVariant: ctx.meta.appVariant,
      method: req.method,
    });

    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['vmvt-auth-token'];
    ctx.meta.session = {} as any;
    if (!token) {
      return;
    }

    const data: any = await verifyToken(token, process.env.ACCESS_JWT_SECRET!);
    const userId = Number(data?.sub);
    const sid = data?.sid;
    if (!userId || !sid) {
      await ctx.call('auth.finish', { token });
      return;
    }

    const user: User = await ctx.call('users.resolve', { id: userId });
    if (!user) {
      await ctx.call('auth.finish', { token });
      return;
    }

    const session = (await this.broker.cacher?.get(`sess:${sid}`)) as SessionBlob | null;
    if (!session) {
      await ctx.call('auth.finish', { token });
      return;
    }

    ctx.meta.session = {
      token,
      sid,
      user,
      companyCode: session?.companyCode ?? null,
      companyName: session?.companyName ?? null,
      activeOrgCode: session?.activeOrgCode,
      roles: session?.roles ?? null,
      ak: session?.ak ? session?.ak.toString() : null,
    };
    return;
  }

  @Method
  async authorize(
    ctx: Context<unknown, MetaSession>,
    _route: Route,
    req: IncomingRequest,
  ): Promise<unknown> {
    const restrictionType = this.getRestrictionType(req);

    if (restrictionType === RestrictionType.PUBLIC) {
      return;
    }

    if (!ctx.meta.session?.user) {
      throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN, null);
    }
  }

  @Method
  getRestrictionType(req: IncomingRequest) {
    return req.$action.auth || req.$action.service?.settings?.auth || RestrictionType.SESSION;
  }
}
