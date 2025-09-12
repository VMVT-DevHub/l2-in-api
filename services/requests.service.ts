'use strict';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  FieldHookCallback,
  MetaSession,
  Table,
} from '../types';
import { VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE } from '../utils/scopes';
import { Form } from './formTypes.service';
import { User } from './users.service';

export enum RequestStatus {
  DRAFT = 'DRAFT', // juodrastis
  CREATED = 'CREATED', // pateikta
  SUBMITTED = 'SUBMITTED', // pakartotinai pateikta
  APPROVED = 'APPROVED', // patvirtinta
  REJECTED = 'REJECTED', // atmesta
  RETURNED = 'RETURNED', // grazinta taisyti
  COMPLETED = 'COMPLETED', // isduotas
}

interface Fields extends CommonFields {
  id: number;
  status: RequestStatus;
  formType: string;
  form: string;
  companyCode: string;
  data: any;
}

interface Populates extends CommonPopulates {}

export type Request<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

const populatePermissions = (field: string) => {
  return function (ctx: Context<{}, MetaSession>, _values: any, requests: any[]) {
    const session = ctx.meta.session;
    const user = session?.user;

    return requests.map((r: any) => {
      const editingPermissions = this.hasPermissionToEdit(r, user, session.activeOrgCode ?? null);
      return !!editingPermissions[field];
    });
  };
};

@Service({
  name: 'requests',

  mixins: [
    DbConnection({
      collection: 'requests',
      entityChangedOldEntity: true,
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

      status: {
        type: 'string',
        enum: Object.values(RequestStatus),
        default: RequestStatus.DRAFT,
        validate: 'validateStatus',
      },

      formType: {
        type: 'string',
        required: true,
      },

      form: {
        type: 'string',
        required: true,
      },

      formConfig: {
        virtual: true,
        type: 'object',
        async populate(ctx: Context, _values: any[], items: any[]) {
          const tree: any = await ctx.call('formTypes.getTree');
          return items.map((item) => {
            return tree[item.formType][item.form];
          });
        },
      },

      companyCode: {
        type: 'string',
        columnName: 'company_code',
        columnType: 'bigint',
        immutable: true,
        set: 'setCompanyCode',
      },

      canEdit: {
        type: 'boolean',
        virtual: true,
        populate: populatePermissions('edit'),
      },

      canValidate: {
        type: 'boolean',
        virtual: true,
        populate: populatePermissions('validate'),
      },

      data: {
        type: 'object',
        required: true,
        validate: 'validateData',
      },

      ...COMMON_FIELDS,
    },
    scopes: {
      ...COMMON_SCOPES,
      ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE.scopes,
    },
    defaultScopes: [...COMMON_DEFAULT_SCOPES, ...VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE.names],
  },
})
export default class extends moleculer.Service {
  @Method
  hasPermissionToEdit(
    request: any,
    user?: User,
    activeOrgCode?: string | null,
  ): { edit: boolean; validate: boolean } {
    const invalid = { edit: false, validate: false };

    if (
      !request?.id ||
      [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.COMPLETED].includes(
        request?.status,
      )
    ) {
      return invalid;
    }

    if (!user?.id) {
      return invalid;
    }

    const reqCompany: string | null = request?.companyCode ?? null;
    const isSelfRow = reqCompany == null && request?.createdBy === user.id;

    const actor = activeOrgCode ?? null;
    const isActorOrgMatch =
      reqCompany != null && actor != null && String(reqCompany) === String(actor);

    if (isSelfRow || isActorOrgMatch) {
      return {
        validate: false,
        edit: [RequestStatus.RETURNED, RequestStatus.DRAFT].includes(request.status),
      };
    }

    return invalid;
  }

  @Method
  async validateData({ ctx, value, entity: request }: FieldHookCallback<Request>) {
    const status: RequestStatus = ctx.params?.status || request?.status;
    const form = ctx.params?.form || request?.form;
    const formType = ctx.params?.formType || request?.formType;

    // do not validate if Draft, and admin actions
    if (
      [
        RequestStatus.DRAFT,
        RequestStatus.REJECTED,
        RequestStatus.RETURNED,
        RequestStatus.COMPLETED,
        RequestStatus.APPROVED,
      ].includes(status)
    )
      return true;

    const formSchema: Form = await ctx.call('formTypes.form', { form, formType });

    const ajv = new Ajv({
      allErrors: true,
      strict: false,
    });
    addFormats(ajv);

    const validate = ajv.compile(formSchema.schema);

    const valid = validate(value);

    if (!valid) {
      if (validate.errors?.[0].message) {
        this.logger.error('Validation errors', validate.errors);
        return `${validate.errors[0].instancePath} ${validate.errors[0].message}`;
      }

      return 'Validation failed';
    }

    return true;
  }

  @Method
  validateStatus({ ctx, value, entity }: FieldHookCallback) {
    const s = ctx.meta.session;
    if (!value || !s?.user?.id) return true;

    const error = `Cannot set status with value ${value}`;

    if (!entity?.id) {
      return [RequestStatus.CREATED, RequestStatus.DRAFT].includes(value) || error;
    }

    const canEdit = this.hasPermissionToEdit(entity, s.user, s.activeOrgCode ?? null).edit;

    if (!canEdit) return error;

    const allowed: Record<string, RequestStatus[]> = {
      [RequestStatus.DRAFT]: [RequestStatus.DRAFT, RequestStatus.CREATED],
      [RequestStatus.RETURNED]: [RequestStatus.SUBMITTED],
    };

    return allowed?.[entity.status]?.includes(value) || error;
  }

  @Method
  setCompanyCode({ ctx, value, entity }: FieldHookCallback<Request>): string | null {
    if (entity?.id) return entity.companyCode ?? null;

    const session = (ctx.meta.session ?? {}) as {
      activeOrgCode?: string | null;
      companyCode?: string | null;
    };

    const companyCode = value ?? session.activeOrgCode ?? null;
    if (companyCode == null) return null;

    const str = String(companyCode).trim();

    return /^\d+$/.test(str) ? str : null;
  }

  @Action({
    rest: 'GET /:id/history',
    params: {
      id: {
        type: 'number',
        convert: true,
      },
    },
  })
  async getHistory(
    ctx: Context<{
      id: number;
      type?: string;
      page?: number;
      pageSize?: number;
    }>,
  ) {
    return ctx.call(`requests.histories.list`, {
      sort: '-createdAt',
      query: {
        request: ctx.params.id,
      },
      page: ctx.params.page,
      pageSize: ctx.params.pageSize,
      populate: 'createdBy',
    });
  }
}
