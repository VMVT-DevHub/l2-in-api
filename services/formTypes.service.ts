'use strict';

import { RestrictionType } from '@aplinkosministerija/moleculer-accounts';
import { readdirSync, readFileSync } from 'fs';
import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

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
  @Action({
    rest: 'GET /',
  })
  async formTypes(_ctx: Context) {
    const formTypes = readdirSync(this.settings.dir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const formType = dirent.name;
        const config = JSON.parse(
          readFileSync(`${this.settings.dir}/${formType}/config.json`, 'utf8'),
        );
        return { formType, title: config.title };
      });

    return formTypes;
  }

  @Action()
  getTree() {
    return readdirSync(this.settings.dir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .reduce((acc: any, formTypeDir: any) => {
        acc[formTypeDir.name] = readdirSync(`${this.settings.dir}/${formTypeDir.name}`, {
          withFileTypes: true,
        })
          .filter((dirent) => dirent.isDirectory())
          .reduce((acc: any, formDir) => {
            acc[formDir.name] = JSON.parse(
              readFileSync(
                `${this.settings.dir}/${formTypeDir.name}/${formDir.name}/config.json`,
                'utf8',
              ),
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
    const formType = ctx.params.formType;
    const config = JSON.parse(readFileSync(`${this.settings.dir}/${formType}/config.json`, 'utf8'));
    const forms = readdirSync(`${this.settings.dir}/${formType}`, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => {
        const form = dirent.name;
        const { title, description } = JSON.parse(
          readFileSync(`${this.settings.dir}/${formType}/${form}/config.json`, 'utf8'),
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
    const formType = ctx.params.formType;
    const form = ctx.params.form;

    const config = JSON.parse(
      readFileSync(`${this.settings.dir}/${formType}/${form}/config.json`, 'utf8'),
    );

    const schema = JSON.parse(
      readFileSync(`${this.settings.dir}/${formType}/${form}/schema.json`, 'utf8'),
    );

    const uiSchema = JSON.parse(
      readFileSync(`${this.settings.dir}/${formType}/${form}/uiSchema.json`, 'utf8'),
    );

    const setEnums = async (obj: any) => {
      if (obj?.fetchEnumFrom) {
        const enumOptions = await ctx.call(obj?.fetchEnumFrom);
        const options = await ctx.call(obj?.fetchOptionsFrom);

        obj.enum = enumOptions;
        obj.options = options;
        delete obj.fetchEnumFrom;
        delete obj.fetchOptionsFrom;
      }

      if (obj?.type === 'object') {
        for (const property in obj.properties) {
          await setEnums(obj.properties[property]);
        }
      } else if (obj?.type === 'array') {
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
