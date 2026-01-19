import moleculer from 'moleculer';
import { Action, Service } from 'moleculer-decorators';

@Service({
  name: 'options.activities',
})
export default class AddressesService extends moleculer.Service {
  private baseUrl!: string;

  created() {
    this.baseUrl = process.env.REGISTRAI_BASE_URL || 'https://registrai.test.vmvt.lt';
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
}
