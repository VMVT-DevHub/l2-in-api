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

export interface CertificateSearchQuery {
  requestId?: string;
  importer?: string;
  manufacturerName?: string;
  kpnCode?: string;
  productName?: string;
}

export const hasCertificateSearch = ({
  requestId,
  importer,
  manufacturerName,
  kpnCode,
  productName,
}: CertificateSearchQuery) =>
  !!requestId || !!importer || !!manufacturerName || !!kpnCode || !!productName;

const norm = (v: any) => (v == null ? '' : String(v)).toLowerCase();

const containsCI = (haystack: any, needle: string) =>
  needle ? norm(haystack).includes(needle.toLowerCase()) : true;

const getArray = (arr: any): any[] => {
  return Array.isArray(arr) ? arr : [];
};

const getPrekes = (data: any): any[] => getArray(data?.prekes);

const getGyvunai = (data: any): any[] => getArray(data?.gyvunai);

const getImporterCandidates = (data: any): string[] => {
  const candidates: any[] = [];
  candidates.push(data?.gavejas?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.gavejas?.['paskirties-vieta']?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.gavejas?.paskirties_vieta?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.siunta?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.siunta?.siuntejas?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.siunta?.gavejas?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.siunta?.gavejas?.paskirties_vieta?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.siunta?.gavejas?.['paskirties-vieta']?.asmuo?.['imones-pavadinimas']);
  candidates.push(data?.importuotojas?.['imones-pavadinimas']);
  candidates.push(data?.importuotojas?.name);
  return candidates.filter(Boolean).map(String);
};

const getManufacturerCandidates = (product: any): string[] => {
  const candidates: any[] = [];
  candidates.push(product?.['gamintojo-pavadinimas']);
  candidates.push(product?.gamintojas?.['gamintojo-pavadinimas']);
  candidates.push(product?.gamintojas?.['imones-pavadinimas']);
  return candidates.filter(Boolean).map(String);
};

const getKpnCandidates = (item: any): string[] => {
  const candidates: any[] = [];
  candidates.push(item?.['kpn-kodas']);
  candidates.push(item?.kodas?.reiksme);
  candidates.push(item?.kodas?.['tevine-reiksme']);
  candidates.push(typeof item?.kodas === 'string' ? item.kodas : undefined);
  return candidates.filter(Boolean).map(String);
};

export const filterCertificateRows = <T extends { id: string | number; data?: any }>(
  rows: T[],
  { requestId, importer, manufacturerName, kpnCode, productName }: CertificateSearchQuery,
): T[] => {
  const kpnDigits = (kpnCode ?? '').replace(/\D/g, '');
  const kpnIsExact = /^\d{8}$/.test(kpnDigits);

  return rows.filter((r) => {
    if (requestId) {
      const idNum = Number(requestId);
      if (!Number.isNaN(idNum) && Number(r.id) !== idNum) return false;
    }

    const data = r.data;

    if (importer) {
      const candidates = getImporterCandidates(data);
      const importerHit = candidates.some((c) => containsCI(c, importer));
      if (!importerHit) return false;
    }

    const prekes = getPrekes(data);
    const gyvunai = getGyvunai(data);

    if (kpnDigits) {
      const kpnHit = [...prekes, ...gyvunai].some((item) =>
        getKpnCandidates(item).some((candidate) => {
          const value = candidate.replace(/\D/g, '');
          return kpnIsExact ? value === kpnDigits : value.startsWith(kpnDigits);
        }),
      );
      if (!kpnHit) return false;
    }

    if (manufacturerName) {
      const manHit = prekes.some((p) =>
        getManufacturerCandidates(p).some((c) => containsCI(c, manufacturerName)),
      );
      if (!manHit) return false;
    }

    if (productName) {
      const prodHit =
        prekes.some((p) => containsCI(p?.pavadinimas, productName)) ||
        gyvunai.some(
          (g) => containsCI(g?.rusis, productName) || containsCI(g?.['rusis-kita'], productName),
        );
      if (!prodHit) return false;
    }

    return true;
  });
};

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

    const searchQuery = {
      requestId,
      importer,
      manufacturerName,
      kpnCode: kpnCodeRaw,
      productName,
    };

    const hasSearch = hasCertificateSearch(searchQuery);

    const baseQuery = {
      ...safeQuery,
      formType,
    };

    // Search currently filters in memory over at most 10k visible certificate rows.
    // If a single entity can exceed that, move this to DB-backed JSONB or indexed derived fields.
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

    const filteredRows = hasSearch ? filterCertificateRows(result.rows, searchQuery) : result.rows;

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
            const animalKiekis = v?.kiekis || undefined;
            const kiekis = v?.['neto-kiekis-matas']?.kiekis || '';
            const matas = v?.['neto-kiekis-matas']?.matas || '';

            if (animalKiekis) {
              return `${animalKiekis}`;
            }
            //ugly solution but cleanest way for transition while changing structure
            if (!kiekis || !matas) {
              const oldKiekis = v?.['kiekis-matas']?.kiekis || '';
              const oldMatas = v?.['kiekis-matas']?.matas || '';
              return `${oldKiekis} ${oldMatas}`;
            }

            return `${kiekis} ${matas} (neto)`;
          });
        }
        acc[column.name] = responseValue;
        return acc;
      }, {});

      return {
        ...r,
        ...columns,
        data: undefined as undefined,
      };
    });

    return {
      ...result,
      totalPages: finalTotalPages,
      rows,
    };
  }
}
