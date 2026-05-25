'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  CommonFields,
  CommonPopulates,
  RestrictionType,
  SCOPE_VKO_DECISIONS,
  Table,
} from '../types';
import { VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE_VKO } from '../utils/scopes';

const schema = process.env.VKS_DB_SCHEMA || 'vks';
// temporary, until gytis adds 'vks' to test db

interface Fields extends CommonFields {
  id: string;
  name: string;
  actionId: string;
  actionTitle: string;
  date: Date;
}

interface Populates extends CommonPopulates {}

export type TransportType<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'decisions',
  mixins: [
    DbConnection({
      collection: 'sprendimai',
      schema: schema,
      createActions: {
        create: false,
        update: false,
        remove: false,
        createMany: false,
        removeAllEntities: false,
      },
      rest: null,
    }),
  ],
  settings: {
    fields: {
      id: {
        type: 'number',
        primaryKey: true,
        secure: true,
        columnName: 'id',
      },
      type: {
        type: 'string',
        columnName: 'sprenTipas',
      },
      typeId: {
        type: 'number',
        columnName: 'sprenTipasId',
      },
      status: {
        type: 'string',
        columnName: 'sprenStatus',
      },
      statusId: {
        type: 'number',
        columnName: 'sprenStatusId',
      },
      subType: {
        type: 'string',
        columnName: 'sprenSubTipas',
      },
      subTypeId: {
        type: 'number',
        columnName: 'sprenSubTipasId',
      },
      reqId: {
        type: 'number',
        columnName: 'sprenReqId',
      },
      vkoId: {
        type: 'number',
        columnName: 'sprenVkoId',
      },
      vksId: {
        type: 'number',
        columnName: 'sprenVksId',
      },
      parentId: {
        type: 'number',
        columnName: 'sprenParentId',
      },
      decisionTitle: {
        type: 'string',
        columnName: 'sprenPrasymoPavad',
      },
      decisionTitleId: {
        type: 'number',
        columnName: 'sprenPrasymoPavadId',
      },
      parentTitle: {
        type: 'string',
        columnName: 'sprenParentPavad',
      },
      actionPlaceTitle: {
        type: 'string',
        columnName: 'sprenVklPavad',
      },
      actionId: {
        type: 'number',
        columnName: 'sprenVklVeiklaId',
      },
      actionTitle: {
        type: 'string',
        columnName: 'sprenVklVeiklaPavad',
      },
      actionAddress: {
        type: 'string',
        columnName: 'sprenVklAdr',
      },
      actionAddressAob: {
        type: 'number',
        columnName: 'sprenVklAdrAob',
      },
      actionAddressWgs: {
        type: 'string',
        columnName: 'sprenVklAdrWgs',
      },
      date: {
        type: 'date',
        columnName: 'sprenDokData',
      },
      docNo: {
        type: 'string',
        columnName: 'sprenDokNr',
      },
      regNo: {
        type: 'string',
        columnName: 'sprenRegNr',
      },
      creator: {
        type: 'string',
        columnName: 'sprenManagerName',
      },
      creatorDep: {
        type: 'string',
        columnName: 'sprenCreatedDep',
      },
      decider: {
        type: 'string',
        columnName: 'sprenCreatedUserName',
      },
      deciderDep: {
        type: 'string',
        columnName: 'sprenNusprendeDep',
      },
      createdAt: {
        type: 'date',
        columnName: 'sprenCreatedAt',
      },
      updatedAt: {
        type: 'date',
        columnName: 'sprenUpdatedAt',
      },
      modifUser: {
        type: 'string',
        columnName: 'sprenModifUser',
      },
      manager: {
        type: 'string',
        columnName: 'sprenManagerName',
      },
      createdUserName: {
        type: 'string',
        columnName: 'sprenCreatedUserName',
      },
      modifUserName: {
        type: 'string',
        columnName: 'sprenModifUserName',
      },
      inCreatedBy: {
        type: 'number',
        columnName: 'sprenInCreatedBy',
      },
      reqDate: {
        type: 'date',
        columnName: 'sprenReqDate',
      },
      delete: {
        type: 'boolean',
        columnName: 'sprenDelete',
      },
      legal: {
        type: 'string',
        columnName: 'sprenLegal',
      },
      refusal: {
        type: 'string',
        columnName: 'sprenRefusal',
      },
      managerDep: {
        type: 'string',
        columnName: 'sprenManagerDep',
      },
    },
    scopes: {
      ...SCOPE_VKO_DECISIONS,
      ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE_VKO.scopes,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES, ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE_VKO.names],
  },
})
export default class extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /all',
  })
  async getAll(
    ctx: Context<
      any,
      {
        session?: { activeOrgCode?: string | null; companyCode?: string | null };
        query?: object;
        page?: number;
        pageSize?: number;
        sort?: string[];
      }
    >,
  ) {
    const page = Number(ctx.params.page ?? 1) || 1;
    const pageSize = Number(ctx.params.pageSize ?? 10) || 10;

    const session = (ctx.meta.session ?? {}) as {
      activeOrgCode?: string | null;
      companyCode?: string | null;
    };

    const result: { rows: Request[] } = await ctx.call('decisions.list', {
      query: {
        ...(ctx.params.query || {}),
        parentId: session.activeOrgCode,
      },
      page,
      pageSize,
      sort: ctx.params.sort,
    });

    return result.rows.map((r: any) => ({
      id: r.id,
      decisionTitle: r.decisionTitle,
      decisionTitleId: r.decisionTitleId,
      actionPlaceTitle: r.actionPlaceTitle,
      address: r.actionAddress,
      date: r.createdAt,
      action: {
        id: r.actionId,
        title: r.actionTitle,
      },
      decider: r.decider,
      statusId: r.statusId,
    }));
  }

  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /:id',
  })
  async get(ctx: Context<{ id: number }>) {
    const rows = await this.findEntities(ctx, {
      query: {
        id: ctx?.params?.id,
      },
    });

    const r = rows[0];

    if (!r) return null;

    return {
      id: r.id,
      type: {
        id: r.typeId,
        title: r.type,
      },
      status: {
        id: r.statusId,
        title: r.status,
      },
      subType: {
        id: r.subTypeId,
        title: r.subType,
      },
      action: {
        id: r.actionId,
        title: r.actionTitle,
        placeTitle: r.actionPlaceTitle,
        address: r.actionAddress,
        adrAob: r.actionAddressAob,
        adrSwg: r.actionAddressWgs,
      },
      parent: {
        id: r.parentId,
        title: r.parentTitle,
      },
      decision: {
        title: r.decisionTitle,
        titleId: r.decisionTitleId,
        date: r.date,
        docNo: r.docNo,
        regNo: r.regNo,
      },
      users: {
        decider: r.decider,
        deciderDep: r.deciderDep,
        manager: r.manager,
        managerDep: r.managerDep,
      },
      decider: {
        name: r.decider,
        department: r.deciderDep,
      },
      reqId: r.reqId,
      reqDate: r.reqDate,
      vksId: r.vkoId ?? r.vksId,
      refusal: r.refusal,
      legal: r.legal,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /address/:id',
  })
  async getAddress(ctx: Context<{ id: string }>) {
    const rows = await this.findEntities(ctx, {
      query: {
        regNo: ctx?.params?.id,
      },
    });

    const r = rows[0];

    if (!r) return null;

    try {
      return await ctx.call('addresses.findDist', { id: r.actionAddressAob, full: true });
    } catch {
      return;
    }
  }
}
