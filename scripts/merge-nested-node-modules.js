'use strict';
const { cpSync, existsSync, readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

for (const dir of ['api/node_modules', 'libs/node_modules']) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    cpSync(join(dir, name), join('node_modules', name), { recursive: true, force: true });
  }
}

const { version } = JSON.parse(readFileSync('node_modules/@nestjs/core/package.json', 'utf8'));
if (!version.startsWith('12.')) {
  throw new Error(`root @nestjs/core is ${version}, expected 12.x after merge`);
}
console.log('root @nestjs/core', version);
