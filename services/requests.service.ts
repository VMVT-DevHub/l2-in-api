'use strict';

import addFormats from 'ajv-formats';
import moleculer, { Context } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import DbConnection from '../mixins/database.mixin';

import Ajv from 'ajv';
import {
  COMMON_DEFAULT_SCOPES,
  COMMON_FIELDS,
  COMMON_SCOPES,
  CommonFields,
  CommonPopulates,
  FieldHookCallback,
  Table,
} from '../types';
import { VISIBLE_TO_CREATOR_OR_ADMIN_SCOPE } from '../utils/scopes';
import { UserAuthMeta } from './api.service';
import { Form } from './formTypes.service';
import { Tenant } from './tenants.service';
import { User } from './users.service';

export enum RequestStatus {
  DRAFT = 'DRAFT', // juodrastis
  CREATED = 'CREATED', // pateikta
  SUBMITTED = 'SUBMITTED', // pakartotinai pateikta
  APPROVED = 'APPROVED', // patvirtinta
  REJECTED = 'REJECTED', // atmesta
  RETURNED = 'RETURNED', // grazinta taisyti
}

interface Fields extends CommonFields {
  id: number;
  status: RequestStatus;
  formType: string;
  form: string;
  tenant: Tenant['id'];
  data: any;
}

interface Populates extends CommonPopulates {
  tenant: Tenant;
}

export type Request<
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Table<Fields, Populates, P, F>;

const populatePermissions = (field: string) => {
  return function (ctx: Context<{}, UserAuthMeta>, _values: any, requests: any[]) {
    const { profile, user } = ctx?.meta?.session;
    return requests.map((r: any) => {
      const editingPermissions = this.hasPermissionToEdit(r, user, profile);
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
          console.log(items);
          const tree: any = await ctx.call('formTypes.getTree');
          return items.map((item) => {
            return tree[item.formType][item.form];
          });
        },
      },

      tenant: {
        type: 'number',
        columnName: 'tenantId',
        populate: 'tenants.resolve',
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
    profile?: Tenant,
  ): {
    edit: boolean;
    validate: boolean;
  } {
    const invalid = { edit: false, validate: false };

    const tenant = request.tenant || request.tenantId;

    if (
      !request?.id ||
      [RequestStatus.APPROVED, RequestStatus.REJECTED].includes(request?.status)
    ) {
      return invalid;
    }

    if (!user?.id) {
      return {
        edit: true,
        validate: true,
      };
    }

    const isCreatedByUser = !tenant && user && user.id === request.createdBy;
    const isCreatedByTenant = profile && profile.id === tenant;

    if (isCreatedByTenant || isCreatedByUser) {
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
    if ([RequestStatus.DRAFT, RequestStatus.REJECTED, RequestStatus.RETURNED].includes(status))
      return true;

    const formSchema: Form = await ctx.call('formTypes.form', { form, formType });

    const ajv = new Ajv({
      allErrors: true,
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
    const { user, profile } = ctx.meta.session;
    if (!value || !user?.id) return true;

    const error = `Cannot set status with value ${value}`;
    if (!entity?.id) {
      return [RequestStatus.CREATED, RequestStatus.DRAFT].includes(value) || error;
    }

    const editingPermissions = this.hasPermissionToEdit(entity, user, profile);

    if (editingPermissions.edit) {
      // TODO: disable other statuses to be converted to drafts
      return (
        [RequestStatus.SUBMITTED, RequestStatus.CREATED, RequestStatus.DRAFT].includes(value) ||
        error
      );
    } else if (editingPermissions.validate) {
      return (
        [RequestStatus.REJECTED, RequestStatus.RETURNED, RequestStatus.APPROVED].includes(value) ||
        error
      );
    }

    return error;
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
