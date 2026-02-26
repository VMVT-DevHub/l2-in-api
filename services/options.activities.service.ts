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

  private sortResponse = (items: any) => {
    return items.sort((a: { code: string }, b: { code: string }) => {
      const aNum = Number(a.code);
      const bNum = Number(b.code);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }

      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  };

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

    return this.sortResponse(result);
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

    return this.sortResponse(result).map((item: any) => item.code);
  }
}
