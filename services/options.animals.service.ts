import moleculer, { Context } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

@Service({
  name: 'options.animals',
})
export default class AddressesService extends moleculer.Service {
  private baseUrl!: string;

  created() {
    this.baseUrl = process.env.REGISTRAI_BASE_URL || 'https://registrai.test.vmvt.lt';
  }

  @Action({
    name: 'getRoot',
    rest: 'GET /root',
  })
  async getRoot(ctx: Context) {
    const url = `${this.baseUrl}/grk/terms?code=root`;

    const result: any = await this.broker.call('http.get', {
      url,
      opt: { responseType: 'json' },
    });

    return result;
  }

  @Action({
    name: 'getGroup',
    rest: 'GET /animal',
    params: {
      code: 'string',
    },
  })
  async getGroup(ctx: Context<{ code: string }>) {
    const { code } = ctx.params;

    const url = `${this.baseUrl}/grk/terms?code=${code}`;

    const result: any = await this.broker.call('http.get', {
      url,
      opt: { responseType: 'json' },
    });

    return result;
  }

  @Action({
    name: 'getGroupBySearch',
    rest: 'GET /search',
    params: {
      q: 'string',
    },
  })
  async getGroupBySearch(ctx: Context<{ q: string }>) {
    const { q } = ctx.params;

    const url = `${this.baseUrl}/grk/search?q=${q}`;

    const result: any = await this.broker.call('http.get', {
      url,
      opt: { responseType: 'json' },
    });

    return result;
  }
}
