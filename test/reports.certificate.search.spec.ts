import assert from 'node:assert/strict';
import { filterCertificateRows } from '../services/reports.certificate.service';

const rows = [
  {
    id: 101,
    data: {
      gavejas: {
        asmuo: {
          'imones-pavadinimas': 'Baltic Importer',
        },
      },
      prekes: [
        {
          'kpn-kodas': '12345678',
          pavadinimas: 'Milk powder',
          'gamintojo-pavadinimas': 'Dairy Producer',
        },
      ],
    },
  },
  {
    id: 202,
    data: {
      gavejas: {
        'paskirties-vieta': {
          asmuo: {
            'imones-pavadinimas': 'Animal Importer',
          },
        },
      },
      gyvunai: [
        {
          kodas: {
            reiksme: '01022999',
          },
          rusis: 'Cattle',
          asmuo: {
            'imones-pavadinimas': 'Animal Holder',
          },
        },
      ],
    },
  },
  {
    id: 303,
    data: {
      gavejas: {
        asmuo: {
          'imones-pavadinimas': 'Unrelated Importer',
        },
      },
      prekes: [
        {
          'kpn-kodas': '87654321',
          pavadinimas: 'Fish meal',
          'gamintojo-pavadinimas': 'Fish Producer',
        },
      ],
    },
  },
];

const ids = (items: typeof rows) => items.map((item) => item.id);

assert.deepEqual(ids(filterCertificateRows(rows, { requestId: '101' })), [101]);
assert.deepEqual(ids(filterCertificateRows(rows, { importer: 'animal importer' })), [202]);
assert.deepEqual(ids(filterCertificateRows(rows, { productName: 'milk' })), [101]);
assert.deepEqual(ids(filterCertificateRows(rows, { productName: 'cattle' })), [202]);
assert.deepEqual(ids(filterCertificateRows(rows, { kpnCode: '12345678' })), [101]);
assert.deepEqual(ids(filterCertificateRows(rows, { kpnCode: '01022999' })), [202]);
assert.deepEqual(ids(filterCertificateRows(rows, { manufacturerName: 'dairy' })), [101]);
assert.deepEqual(ids(filterCertificateRows(rows, { manufacturerName: 'holder' })), []);
assert.deepEqual(
  ids(
    filterCertificateRows(rows, {
      importer: 'baltic',
      productName: 'milk',
      kpnCode: '1234',
      manufacturerName: 'producer',
    }),
  ),
  [101],
);
