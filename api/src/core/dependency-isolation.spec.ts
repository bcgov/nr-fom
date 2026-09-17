import * as fs from 'fs';
import * as path from 'path';

describe('Dependency Isolation & Hygiene Guardrails', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  const readJson = (relativeFilePath: string) => {
    const fullPath = path.join(rootDir, relativeFilePath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  };

  describe('api/package.json (#1119, #1120, #1123)', () => {
    let pkg: any;

    beforeAll(() => {
      pkg = readJson('api/package.json');
    });

    it('demotes build & type tools to devDependencies (#1119)', () => {
      expect(pkg.dependencies['@nestjs/cli']).toBeUndefined();
      expect(pkg.dependencies['@types/multer']).toBeUndefined();
      expect(pkg.dependencies['@types/geojson']).toBeUndefined();

      expect(pkg.devDependencies['@nestjs/cli']).toBeDefined();
      expect(pkg.devDependencies['@types/multer']).toBeDefined();
      expect(pkg.devDependencies['@types/geojson']).toBeDefined();
    });

    it('purges @nestjs-modules/mailer and remeda from dependencies (#1120, #1123)', () => {
      expect(pkg.dependencies['@nestjs-modules/mailer']).toBeUndefined();
      expect(pkg.dependencies['remeda']).toBeUndefined();
    });

    it('retains direct nodemailer and lodash dependencies in api (#1120, #1123)', () => {
      expect(pkg.dependencies['nodemailer']).toBeDefined();
      expect(pkg.dependencies['lodash']).toBeDefined();
    });
  });

  describe('libs/package.json (#1121, #1134)', () => {
    let pkg: any;

    beforeAll(() => {
      pkg = readJson('libs/package.json');
    });

    it('purges dead NestJS dependencies from libs (#1121)', () => {
      expect(pkg.dependencies?.['@nestjs/common']).toBeUndefined();
      expect(pkg.dependencies?.['@nestjs/core']).toBeUndefined();
      expect(pkg.dependencies?.['@nestjs/testing']).toBeUndefined();
    });

    it('defines Angular as optional peerDependencies to prevent backend API build pollution (#1134)', () => {
      expect(pkg.dependencies?.['@angular/common']).toBeUndefined();
      expect(pkg.dependencies?.['@angular/core']).toBeUndefined();

      expect(pkg.peerDependencies?.['@angular/common']).toBeDefined();
      expect(pkg.peerDependencies?.['@angular/core']).toBeDefined();

      expect(pkg.peerDependenciesMeta?.['@angular/common']?.optional).toBe(true);
      expect(pkg.peerDependenciesMeta?.['@angular/core']?.optional).toBe(true);
    });
  });

  describe('admin and public package.json (#1129)', () => {
    const workspaces = ['admin', 'public'];

    workspaces.forEach((workspace) => {
      it(`moves ambient @types to devDependencies in ${workspace}/package.json`, () => {
        const pkg = readJson(`${workspace}/package.json`);

        expect(pkg.dependencies?.['@types/file-saver-es']).toBeUndefined();
        expect(pkg.dependencies?.['@types/luxon']).toBeUndefined();

        expect(pkg.devDependencies?.['@types/file-saver-es']).toBeDefined();
        expect(pkg.devDependencies?.['@types/luxon']).toBeDefined();
      });
    });
  });
});
