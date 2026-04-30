'use strict';

import $RefParser from '@apidevtools/json-schema-ref-parser';
import { RestrictionType } from '@aplinkosministerija/moleculer-accounts';
import { readdirSync, readFileSync } from 'fs';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { MetaSession } from '../types';

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
  name: 'formTypes',
  settings: {
    dir: './forms',
    auth: RestrictionType.PUBLIC,
  },
})
export default class extends moleculer.Service {
  private getFormsDir(ctx?: Context<any, MetaSession>) {
    const defaultDir = this.settings.dir as string;
    const vksDir = (process.env.VKS_FORMS_DIR || `${defaultDir}/vks`) as string;

    if (ctx?.meta?.appVariant === 'vks') {
      try {
        readdirSync(vksDir, { withFileTypes: true });
        return vksDir;
      } catch {
        this.logger.warn(
          `VKS variant requested but forms dir "${vksDir}" does not exist. Falling back to "${defaultDir}".`,
        );
      }
    }

    return defaultDir;
  }

  @Action({
    rest: 'GET /',
  })
  async formTypes(ctx: Context<any, MetaSession>) {
    const formsDir = this.getFormsDir(ctx);
    const formTypes = readdirSync(formsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const formType = dirent.name;
        const config = JSON.parse(readFileSync(`${formsDir}/${formType}/config.json`, 'utf8'));
        return { formType, title: config.title };
      });

    return formTypes;
  }

  @Action()
  getTree(ctx: Context<any, MetaSession>) {
    const formsDir = this.getFormsDir(ctx);
    return readdirSync(formsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .reduce((acc: any, formTypeDir: any) => {
        acc[formTypeDir.name] = readdirSync(`${formsDir}/${formTypeDir.name}`, {
          withFileTypes: true,
        })
          .filter((dirent) => dirent.isDirectory())
          .reduce((acc: any, formDir) => {
            acc[formDir.name] = JSON.parse(
              readFileSync(`${formsDir}/${formTypeDir.name}/${formDir.name}/config.json`, 'utf8'),
            );
            return acc;
          }, {});

        return acc;
      }, {});
  }

  @Action({
    rest: 'GET /:formType',
    params: {
      formType: 'string',
    },
  })
  async formType(ctx: Context<{ formType: string }>) {
    const formsDir = this.getFormsDir(ctx);
    const formType = ctx.params.formType;
    const config = JSON.parse(readFileSync(`${formsDir}/${formType}/config.json`, 'utf8'));

    let formNames: string[];

    if (config.forms) {
      formNames = config.forms;
    } else {
      formNames = readdirSync(`${formsDir}/${formType}`, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    }

    const forms = formNames.map((form) => {
      const { title, description } = JSON.parse(
        readFileSync(`${formsDir}/${formType}/${form}/config.json`, 'utf8'),
      );

      return { form, formType, title, description };
    });

    return { ...config, forms };
  }

  @Action({
    rest: 'GET /:formType/:form',
    params: {
      formType: 'string',
      form: 'string',
    },
  })
  async form(ctx: Context<{ formType: string; form: string }>) {
    const formsDir = this.getFormsDir(ctx);
    const formType = ctx.params.formType;
    const form = ctx.params.form;

    const config = JSON.parse(readFileSync(`${formsDir}/${formType}/${form}/config.json`, 'utf8'));

    const schema = JSON.parse(readFileSync(`${formsDir}/${formType}/${form}/schema.json`, 'utf8'));

    await $RefParser.dereference(schema);

    const uiSchema = JSON.parse(
      readFileSync(`${formsDir}/${formType}/${form}/uiSchema.json`, 'utf8'),
    );

    await $RefParser.dereference(uiSchema);

    const setEnums = async (obj: any) => {
      if (obj?.fetchEnumFrom) {
        const enumOptions = await ctx.call(obj.fetchEnumFrom);

        if (Array.isArray(enumOptions) && enumOptions.length > 0) {
          obj.enum = enumOptions;
        } else {
          delete obj.enum;
          this.logger.warn(
            `Empty enum options for ${obj.title || 'unknown field'} from ${obj.fetchEnumFrom}`,
          );
        }

        delete obj.fetchEnumFrom;
      }

      if (obj?.type === 'object' && obj?.properties) {
        for (const property in obj.properties) {
          await setEnums(obj.properties[property]);
        }
      } else if (obj?.type === 'array' && obj?.items) {
        await setEnums(obj.items);
      }

      if (obj?.definitions) {
        for (const property in obj.definitions) {
          await setEnums(obj.definitions[property]);
        }
      }
    };
    await setEnums(schema);

    return { form, formType, title: config.title, schema: schema, uiSchema };
  }
}
