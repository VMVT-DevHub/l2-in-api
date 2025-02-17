'use strict';
import moleculer from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { RestrictionType } from '../types';

@Service({
  name: 'options.pkp',
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /all',
    auth: RestrictionType.PUBLIC,
  })
  async find() {
    return [
      { name: 'Kenos PKP' },
      { name: 'Kybartų automobilių kelių PKP' },
      { name: 'Kybartų geležinkelio stoties PKP' },
      { name: 'Malkų įlankos PKP' },
      { name: 'Medininkų PKP' },
      { name: 'Molo PKP' },
      { name: 'Pilies PKP' },
      { name: 'Šalčininkų PKP' },
      { name: 'Vilniaus oro uosto PKP' },
    ];
  }
}
