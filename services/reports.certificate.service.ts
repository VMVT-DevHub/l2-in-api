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
  name: 'reports.certificate',
})
export default class extends moleculer.Service {
  @Action({
    rest: {
      method: 'GET',
      path: '/',
    },
  })
  async list(
    ctx: Context<{
      query?: {
        requestId?: string;
        importer?: string;
        manufacturerName?: string;
        kpnCode?: string;
        productName?: string;
        [key: string]: any;
      };
      page?: number;
      pageSize?: number;
      sort?: string[];
    }>,
  ) {
    const formType = 'certificate';

    const page = Number(ctx.params.page ?? 1) || 1;
    const pageSize = Number(ctx.params.pageSize ?? 10) || 10;

    const incomingQuery = (ctx.params.query ?? {}) as Record<string, any>;

    const {
      requestId: requestIdRaw,
      importer: importerRaw,
      manufacturerName: manufacturerNameRaw,
      kpnCode: kpnCodeRawRaw,
      productName: productNameRaw,
      ...safeQuery
    } = incomingQuery;

    const requestId = (requestIdRaw ?? '').toString().trim();
    const importer = (importerRaw ?? '').toString().trim();
    const manufacturerName = (manufacturerNameRaw ?? '').toString().trim();
    const kpnCodeRaw = (kpnCodeRawRaw ?? '').toString().trim();
    const productName = (productNameRaw ?? '').toString().trim();

    const hasSearch =
      !!requestId || !!importer || !!manufacturerName || !!kpnCodeRaw || !!productName;

    const baseQuery = {
      ...safeQuery,
      formType,
    };

    const effectivePage = hasSearch ? 1 : page;
    const effectivePageSize = hasSearch ? 10000 : pageSize;

    const result: { rows: Request[]; totalPages?: number } = await ctx.call('requests.list', {
      ...ctx.params,
      page: effectivePage,
      pageSize: effectivePageSize,
      query: baseQuery,
      populate: ['formConfig'],
    });

    const ft: FormType = await ctx.call('formTypes.formType', { formType });
    const columnsByType: Record<string, FormType['columns']> = {
      [formType]: ft.columns,
    };

    const norm = (v: any) => (v == null ? '' : String(v)).toLowerCase();
    const containsCI = (haystack: any, needle: string) =>
      needle ? norm(haystack).includes(needle.toLowerCase()) : true;

    const getPrekes = (data: any): any[] => {
      const arr = data?.prekes;
      return Array.isArray(arr) ? arr : [];
    };

    // Not sure which one
    const getImporterCandidates = (data: any): string[] => {
      const candidates: any[] = [];
      console.log(data);
      candidates.push(data?.siunta?.asmuo?.['imones-pavadinimas']);
      candidates.push(data?.siunta?.siuntejas?.asmuo?.['imones-pavadinimas']);
      candidates.push(data?.siunta?.gavejas?.asmuo?.['imones-pavadinimas']);
      candidates.push(data?.siunta?.gavejas?.paskirties_vieta?.asmuo?.['imones-pavadinimas']);
      candidates.push(data?.siunta?.gavejas?.['paskirties-vieta']?.asmuo?.['imones-pavadinimas']);
      candidates.push(data?.importuotojas?.['imones-pavadinimas']);
      candidates.push(data?.importuotojas?.name);
      return candidates.filter(Boolean).map(String);
    };

    const kpnDigits = kpnCodeRaw.replace(/\D/g, '');
    const kpnIsExact = /^\d{8}$/.test(kpnDigits);

    const filteredRows = hasSearch
      ? result.rows.filter((r) => {
          if (requestId) {
            const idNum = Number(requestId);
            if (!Number.isNaN(idNum) && Number(r.id) !== idNum) return false;
          }

          const data = (r as any).data;

          if (importer) {
            const candidates = getImporterCandidates(data);
            const importerHit = candidates.some((c) => containsCI(c, importer));
            if (!importerHit) return false;
          }

          const prekes = getPrekes(data);

          if (kpnDigits) {
            const kpnHit = prekes.some((p) => {
              const v = String(p?.['kpn-kodas'] ?? '');
              return kpnIsExact ? v === kpnDigits : v.startsWith(kpnDigits);
            });
            if (!kpnHit) return false;
          }

          if (manufacturerName) {
            const manHit = prekes.some((p) =>
              containsCI(p?.['gamintojo-pavadinimas'], manufacturerName),
            );
            if (!manHit) return false;
          }

          if (productName) {
            const prodHit = prekes.some((p) => containsCI(p?.pavadinimas, productName));
            if (!prodHit) return false;
          }

          return true;
        })
      : result.rows;

    const finalTotalPages = hasSearch
      ? Math.max(1, Math.ceil(filteredRows.length / pageSize))
      : result.totalPages ?? 1;

    const pagedRows = hasSearch
      ? filteredRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
      : filteredRows;

    const rows = pagedRows.map((r) => {
      const columns = columnsByType[r.formType].reduce<Record<string, any>>((acc, column) => {
        const value = JSONPath({ path: column.path, json: (r as any).data });
        let responseValue = value;
        if (!column.mapper) {
          responseValue = value?.[0];
        } else if (column.mapper === 'sum') {
          responseValue = value.reduce(
            (acc: number, number: string | number) => (acc += Number(number) || 0),
            0,
          );
        } else if (column.mapper === 'kiekisMatas') {
          responseValue = value.map((v: any) => {
            const kiekis = v?.['kiekis-matas']?.kiekis;
            const matas = v?.['kiekis-matas']?.matas;
            return `${kiekis} ${matas}`;
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

    return {
      ...result,
      totalPages: finalTotalPages,
      rows,
    };
  }
}
