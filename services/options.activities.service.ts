import moleculer from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

@Service({
  name: 'options.activities',
})
export default class AddressesService extends moleculer.Service {
  private baseUrl!: string;

  created() {
    this.baseUrl = 'https://registrai.vmvt.lt';
  }

  @Action({
    name: 'getActivities',
    rest: 'GET /okis',
  })
  async getActivities() {
    const url = `${this.baseUrl}/okis/lists/veiklos`;

    const result: any = await this.broker.call('http.get', {
      url,
      opt: { responseType: 'json' },
    });

    return result;
  }

  @Action({
    name: 'getIDs',
    rest: 'GET /okis/ids',
  })
  async getIDs() {
    const url = `${this.baseUrl}/okis/lists/veiklos`;

    const result: any = await this.broker.call('http.get', {
      url,
      opt: { responseType: 'json' },
    });

    return result.map((item: any) => item.code);
  }
}
