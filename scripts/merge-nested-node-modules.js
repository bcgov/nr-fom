'use strict';
// The OpenAPI generator CLI drags @nestjs/axios@4 (peer Nest 11) into the root
// node_modules, so npm cannot hoist Nest 12 and nests it under api/ and libs/.
// Two physical copies of @nestjs/core mean two ApplicationConfig classes, and
// root packages such as nestjs-pino then fail to resolve against the copy
// NestFactory used. Collapse to the single-tree layout the runtime image uses.
const { cpSync, existsSync, readdirSync, readFileSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const nested = ['api/node_modules', 'libs/node_modules'].filter(existsSync);

for (const dir of nested) {
  for (const name of readdirSync(dir)) {
    cpSync(join(dir, name), join('node_modules', name), { recursive: true, force: true });
  }
}
for (const dir of nested) {
  rmSync(dir, { recursive: true, force: true });
}

const { version } = JSON.parse(readFileSync('node_modules/@nestjs/core/package.json', 'utf8'));
if (!version.startsWith('12.')) {
  throw new Error(`root @nestjs/core is ${version}, expected 12.x after merge`);
}
for (const dir of nested) {
  if (existsSync(dir)) throw new Error(`${dir} still present; Nest would load twice`);
}
console.log(`merged ${nested.join(', ')} into node_modules; @nestjs/core ${version}`);
