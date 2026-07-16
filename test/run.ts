import fs from 'node:fs';
import path from 'node:path';

const testDir = __dirname;

const getSpecFiles = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) return getSpecFiles(entryPath);
      if (entry.isFile() && entry.name.endsWith('.spec.ts')) return [entryPath];

      return [];
    })
    .sort();

for (const file of getSpecFiles(testDir)) {
  require(file);
}
