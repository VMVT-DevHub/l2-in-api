'use strict';

import moleculer, { Context } from 'moleculer';
import { Action, Event, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';

import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  EntityChangedParams,
  Table,
} from '../types';
import { Request, RequestStatus } from './requests.service';

export enum RequestHistoryTypes {
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  APPROVED = 'APPROVED',
  DELETED = 'DELETED',
  COMPLETED = 'COMPLETED',
}

interface Fields extends CommonFields {
  id: number;
  request: Request['id'];
  type: RequestHistoryTypes;
  comment: string;
  data: any;
}

interface Populates extends CommonPopulates {
  request: Request;
}

export type RequestHistory<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'requests.histories',

  mixins: [
    DbConnection({
      collection: 'requestHistories',
      createActions: false,
      rest: false,
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

      type: {
        type: 'string',
        enum: Object.values(RequestHistoryTypes),
      },

      request: {
        type: 'number',
        columnName: 'requestId',
        required: true,
        immutable: true,
        populate: 'requests.resolve',
      },

      data: 'object',
      comment: 'string',

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
      request: {
        type: 'number',
        convert: true,
      },
      page: {
        type: 'number',
        optional: true,
        convert: true,
      },
      pageSize: {
        type: 'number',
        optional: true,
        convert: true,
      },
      sort: {
        type: 'array',
        optional: true,
        items: 'string',
      },
    },
  })
  async listForRequest(
    ctx: Context<{
      request: number;
      page?: number;
      pageSize?: number;
      sort?: string[];
    }>,
  ) {
    const params = {
      sort: ctx.params.sort,
      query: {
        request: ctx.params.request,
      },
      page: ctx.params.page,
      pageSize: ctx.params.pageSize,
      populate: 'createdBy',
    };

    const rows = await this.findEntities(ctx, params);
    const total = await this.countEntities(ctx, params);
    const page = Number(ctx.params.page ?? 1) || 1;
    const pageSize = Number(ctx.params.pageSize ?? 10) || 10;

    return {
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.floor((total + pageSize - 1) / pageSize),
    };
  }

  @Event()
  async 'requests.created'(ctx: Context<EntityChangedParams<Request>>) {
    const request = ctx.params.data as Request;

    if (request.status === RequestStatus.CREATED) {
      await this.createRequestHistory(ctx, request, RequestHistoryTypes.CREATED);
    }
  }

  @Event()
  async 'requests.updated'(ctx: Context<EntityChangedParams<Request>>) {
    const data = ctx.params.data as Request;
    const oldData = ctx.params.oldData as Request;

    const typesByStatus: any = {
      [RequestStatus.CREATED]: RequestHistoryTypes.CREATED,
      [RequestStatus.SUBMITTED]: RequestHistoryTypes.SUBMITTED,
      [RequestStatus.REJECTED]: RequestHistoryTypes.REJECTED,
      [RequestStatus.RETURNED]: RequestHistoryTypes.RETURNED,
      [RequestStatus.APPROVED]: RequestHistoryTypes.APPROVED,
      [RequestStatus.COMPLETED]: RequestHistoryTypes.COMPLETED,
    };

    if (data.status == typesByStatus[RequestStatus.SUBMITTED]) {
      await this.createRequestHistory(ctx, data, typesByStatus[data.status]);
    } else {
      if (data.status !== oldData.status) {
        await this.createRequestHistory(ctx, data, typesByStatus[data.status]);
      }
    }
  }

  @Method
  createRequestHistory(ctx: Context, request: Request, type: RequestHistoryTypes) {
    // get top ctx (api.service in most cases) to get raw params
    let topCtx = ctx;
    while (topCtx.options?.parentCtx) {
      topCtx = topCtx.options.parentCtx;
    }

    const { comment } = (topCtx.params as any)?.req?.body || {};

    return this.createEntity(ctx, {
      request: request.id,
      data: request.data,
      comment,
      type,
    });
  }
}
