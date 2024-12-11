'use strict';
import moleculer from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import { RestrictionType } from '../types';

@Service({
  name: 'options.selfControl',
})
export default class extends moleculer.Service {
  @Action({
    rest: 'GET /tree',
    auth: RestrictionType.PUBLIC,
  })
  async getTree() {
    return [
      {
        id: 1,
        name: 'Individuali rizikos veiksnių analizės ir svarbiųjų valdymo taškų (RVASVT) sistemaname',
        children: [
          { id: 2, name: 'Paskirtas atsakingas už savikontrolės sistemą asmuo' },
          { id: 3, name: 'Parengtas produkto aprašymas ir apibūdinimas' },
          {
            id: 4,
            name: 'Parengtos privalomos programos',
            children: [
              { id: 5, name: 'Infrastruktūra (pastatai, įranga)' },
              { id: 6, name: 'Valymas ir dezinfekcija' },
            ],
          },
        ],
      },
      {
        id: 7,
        name: 'Paremta Bendrijos savikontrolės vadovu (Europos Komisijos gairėmis paremtas dokumentas)',
        children: [{ id: 8, name: 'Paskirtas atsakingas už savikontrolės sistemą asmuo' }],
      },
    ];
  }

  @Action({
    rest: 'GET /leafIds',
    auth: RestrictionType.PUBLIC,
  })
  async getLeafIds() {
    return [1, 2, 3, 4, 5, 6, 8, 7];
  }
}
