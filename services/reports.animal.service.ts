'use strict';

import { JSONPath } from 'jsonpath-plus';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { Request } from './requests.service';

export interface Form {
  name: string;
  formType: string;
  schema: any;
  uiSchema: any;
}
export interface Actions {
  id: number;
  code: string;
  name: string;
  risk: string;
  riskId: number;
}

export interface FormType {
  title: string;
  columns: Array<{
    name: string;
    title: string;
    path: string;
    mapper?: string;
  }>;
}

@Service({
  name: 'reports.animal',
})
export default class extends moleculer.Service {
  // virtualus servicesa reports.animal.service.ts
  @Action({
    rest: {
      method: 'GET',
      path: '/',
    },
  })
  async list(ctx: Context<{ query?: object }>) {
    const formType = 'animal';

    const result: { rows: Request[] } = await ctx.call('requests.list', {
      ...ctx.params,
      query: {
        ...(ctx.params.query || {}),
        formType,
      },
      populate: ['formConfig'],
    });

    const columnsByType: Record<string, FormType['columns']> = {};
    const activityList = await ctx.call<Actions[]>('options.activities.getActivities');

    const ft: FormType = await ctx.call('formTypes.formType', { formType });
    columnsByType[formType] = ft.columns;

    const rows = result.rows.map((r) => {
      const columns = columnsByType[r.formType].reduce<Record<string, any>>((acc, column) => {
        const value = JSONPath({ path: column.path, json: r.data });
        let responseValue = value;
        if (!column.mapper) {
          responseValue = value?.[0];
        } else if (column.mapper === 'sum') {
          responseValue = value.reduce(
            (acc: number, number: string | number) => (acc += Number(number) || 0),
            0,
          );
        } else if (column.mapper === 'actionName') {
          responseValue = value.map((v: any) => {
            const mappedValue = activityList.find((item) => item.code == v);
            return mappedValue?.name ?? '-';
          });
        }
        acc[column.name] = responseValue;
        return acc;
      }, {});

      return {
        ...r,
        ...columns,
        data: undefined,
      };
    });

    return { ...result, rows };
  }
}
