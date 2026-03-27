'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonFields, CommonPopulates, RestrictionType, Table } from '../types';

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
      schema: 'vko',
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
      result: {
        type: 'string',
        columnName: 'sprenResult',
      },
      resultId: {
        type: 'number',
        columnName: 'sprenResultId',
      },
      reqId: {
        type: 'number',
        columnName: 'sprenReqId',
      },
      vkoId: {
        type: 'number',
        columnName: 'sprenVkoId',
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
        type: 'string',
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
      actionAdr: {
        type: 'string',
        columnName: 'sprenVklAdr',
      },
      actionAdrAob: {
        type: 'number',
        columnName: 'sprenVklAdrAob',
      },
      actionAdrSwg: {
        type: 'number',
        columnName: 'sprenVklAdrSwg',
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
        columnName: 'sprenCreatedUser',
      },
      creatorDep: {
        type: 'string',
        columnName: 'sprenCreatedDep',
      },
      decider: {
        type: 'string',
        columnName: 'sprenNusprendeUser',
      },
      deciderDep: {
        type: 'string',
        columnName: 'sprenNusprendeDep',
      },
      reason: {
        type: 'string',
        columnName: 'sprenReason',
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
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    auth: RestrictionType.PUBLIC,
    rest: 'GET /all',
  })
  async list(ctx: Context) {
    const rows = await this.findEntities(ctx);

    return rows.map((r: any) => ({
      id: r.id,
      type: r.decisionTitle,
      typeId: r.decisionTitleId,
      actionPlaceTitle: r.actionPlaceTitle,
      address: r.actionAdr,
      date: r.createdAt,
      action: {
        id: r.actionId,
        title: r.actionTitle,
      },
      decider: r.decider,
      status: r.status,
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
      result: {
        id: r.resultId,
        title: r.result,
      },
      action: {
        id: r.actionId,
        title: r.actionTitle,
        placeTitle: r.actionPlaceTitle,
        address: r.actionAdr,
        adrAob: r.actionAdrAob,
        adrSwg: r.actionAdrSwg,
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
      creator: {
        name: r.creator,
        department: r.creatorDep,
      },
      decider: {
        name: r.decider,
        department: r.deciderDep,
      },
      reqId: r.reqId,
      vkoId: r.vkoId,
      reason: r.reason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      modifUser: r.modifUser,
    };
  }
}
