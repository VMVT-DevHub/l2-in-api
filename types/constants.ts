import Moleculer, { Errors } from 'moleculer';
import { User } from '../services/users.service';
import { FieldHookCallback } from './';

export enum RestrictionType {
  PUBLIC = 'PUBLIC',
  SESSION = 'SESSION',
}

export type Table<
  Fields = {},
  Populates = {},
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Pick<Omit<Fields, P> & Pick<Populates, P>, Extract<P | Exclude<keyof Fields, P>, F>>;

export interface CommonFields {
  id: number | string;
  createdBy: User['id'];
  createdAt: Date;
  updatedBy: User['id'];
  updatedAt: Date;
  deletedBy: User['id'];
  detetedAt: Date;
}

export interface CommonPopulates {
  createdBy: User;
  updatedBy: User;
  deletedBy: User;
}

export const COMMON_FIELDS = {
  createdBy: {
    type: 'number',
    readonly: true,
    onCreate: ({ ctx }: FieldHookCallback) => ctx?.meta?.session?.user?.id,
    populate: {
      action: 'users.resolve',
      params: {
        scope: false,
      },
    },
  },
  createdAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onCreate: () => new Date(),
  },
  updatedBy: {
    type: 'number',
    readonly: true,
    hidden: 'byDefault',
    onCreate: ({ ctx }: FieldHookCallback) => ctx?.meta?.session?.user?.id,
    populate: {
      action: 'users.resolve',
      params: {
        scope: false,
      },
    },
  },
  updatedAt: {
    type: 'date',
    columnType: 'datetime',
    hidden: 'byDefault',
    readonly: true,
    onUpdate: () => new Date(),
  },
  deletedBy: {
    type: 'number',
    readonly: true,
    onRemove: ({ ctx }: FieldHookCallback) => ctx?.meta?.session?.user?.id,
    populate: {
      action: 'users.resolve',
      params: {
        scope: false,
      },
    },
  },
  deletedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onRemove: () => new Date(),
  },
};

export const COMMON_SCOPES = {
  notDeleted: {
    deletedAt: { $exists: false },
  },
};

export function throwUnauthorizedError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `Unauthorized.`, 401, 'UNAUTHORIZED');
}

export function throwNotFoundError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `Not found.`, 404, 'NOT_FOUND');
}

export function throwNoRightsError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `No rights.`, 401, 'NO_RIGHTS');
}

export function throwValidationError(message?: string, data?: any): Errors.MoleculerError {
  throw new Moleculer.Errors.ValidationError(message || `Not valid.`, 'VALIDATION_ERROR', data);
}

export function throwBadRequestError(message?: string, data?: any): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerServerError(
    message || `Bad request.`,
    400,
    'BAD_REQUEST',
    IS_PRODUCTION ? undefined : data,
  );
}

export function throwUploadError(status?: number, message?: string) {
  throw new Moleculer.Errors.MoleculerServerError(
    message || `Failed to upload file, status: ${status}`,
    status || 500,
    'UPLOAD_ERROR',
    { status },
  );
}

export const COMMON_DEFAULT_SCOPES = ['notDeleted'];

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
