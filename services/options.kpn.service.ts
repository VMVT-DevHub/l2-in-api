'use strict';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import { CommonPopulates, RestrictionType, Table } from '../types';

interface Fields {
  id: string;
  l1: string;
  l1Name: string;
  l2: string;
  l2Name: string;
  l3: string;
  l3Name: string;
  l4: string;
  l4Name: string;
  [key: string]: any;
}

interface Populates extends CommonPopulates {}

export type KPN<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

@Service({
  name: 'options.kpn',
  mixins: [
    DbConnection({
      collection: 'kpnKodai',
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
        type: 'string',
        primaryKey: true,
        secure: true,
      },
      l1: {
        type: 'string',
        columnName: 'l1',
      },
      l1Name: {
        type: 'string',
        columnName: 'l1Name',
      },
      l2: {
        type: 'string',
        columnName: 'l2',
      },
      l2Name: {
        type: 'string',
        columnName: 'l2Name',
      },
      l3: {
        type: 'string',
        columnName: 'l3',
      },
      l3Name: {
        type: 'string',
        columnName: 'l3Name',
      },
      l4: {
        type: 'string',
        columnName: 'l4',
      },
      l4Name: {
        type: 'string',
        columnName: 'l4Name',
      },
    },
  },
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /tree',
    auth: RestrictionType.PUBLIC,
  })
  async getTree(ctx: Context) {
    const result: KPN[] = await this.findEntities(ctx);

    return this.formatTree(result, 1, false);
  }

  @Action({
    rest: 'GET /animalsTree',
    auth: RestrictionType.PUBLIC,
  })
  async getAnimalsTree(ctx: Context) {
    const result: KPN[] = await this.findEntities(ctx);

    const filteredResults = result.filter((item: any) => item.l1 === '01000000');

    return this.formatTree(filteredResults, 2, false);
  }

  @Action({
    rest: 'GET /leafIds',
    auth: RestrictionType.PUBLIC,
  })
  async getLeafIds(ctx: Context) {
    const result: KPN[] = await this.findEntities(ctx);
    const leafMap: { [key: string]: boolean } = {};
    const formatFlatIds = (data: KPN[], depth: number) => {
      const idMap: { [key: string]: boolean } = {};
      for (const item of data) {
        const currentId = item[`l${depth}`];

        if (!currentId || idMap[currentId]) continue;

        idMap[currentId] = true;

        const children = data.filter(
          (child: any) => child[`l${depth}`] === currentId && child[`l${depth + 1}`],
        );

        if (children.length) {
          formatFlatIds(children, depth + 1);
        } else {
          leafMap[currentId] = true;
        }
      }
    };

    formatFlatIds(result, 1);

    return Object.keys(leafMap);
  }

  @Method
  formatTree(data: KPN[], depth: number, parentSelectable = true) {
    const group: any = {};

    for (const item of data) {
      const currentId = item[`l${depth}`];
      if (group[currentId] || !currentId) continue;

      group[currentId] = {
        id: currentId,
        name:
          item[`l${depth}Name`].charAt(0).toUpperCase() +
          item[`l${depth}Name`].slice(1).toLowerCase(),
      };

      const children = data.filter(
        (item: any) => item[`l${depth}`] === currentId && item[`l${depth + 1}`],
      );

      if (children.length) {
        group[currentId].selectable = parentSelectable;
        group[currentId].children = this.formatTree(children, depth + 1, parentSelectable);
      } else {
        group[currentId].isLeaf = true;
      }
    }

    return Object.values(group);
  }

  @Action()
  async seedDB() {
    await this.seedCsv('kpn', [
      'id',
      'l1',
      'l1Name',
      'l2',
      'l2Name',
      'l3',
      'l3Name',
      'l4',
      'l4Name',
    ]);
  }
}
