import type { ProjectService as ProjectServiceType } from '@api-modules/project/project.service';
import { WorkflowStateEnum } from '@api-modules/project/workflow-state-code.entity';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { LoggerModule } from 'nestjs-pino';
import { resolve } from 'path';
import { agent } from 'supertest';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as ormConfigMain from '../migrations/ormconfig-migration-main';

/**
 * Guards for the daily work-flow-state-change batch, the only thing that moves
 * FOMs PUBLISHED -> COMMENT_OPEN and COMMENT_OPEN -> COMMENT_CLOSED. The public
 * site's "Commenting Open" list shows only COMMENT_OPEN FOMs, so if the batch
 * does not run, newly opened FOMs never appear there (#1223, fixed by #1234).
 *
 * Needs a PostgreSQL database (the repo's compose `db` service) and a
 * `nest build`; run it with `npm run test-batch`. In OpenShift the API
 * Deployment's startup migrates the database; the batch itself does not, so
 * this file migrates it first.
 */

const API_DIR = resolve(__dirname, '../..');
const CRONJOB_SUFFIX = '-work-flow-state-change-batch';

// The CronJob points at its OpenShift database; point those at the test
// database instead. Applied only to names the CronJob itself sets.
const DB_CONNECTION_ENV = ['DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];

const template = readFileSync(resolve(API_DIR, 'openshift.deploy.yml'), 'utf8');

/** Template parameter defaults (`parameters:` items with a `value:`). */
function templateParameters(): Map<string, string> {
  const section = template.substring(template.indexOf('\nparameters:'), template.indexOf('\nobjects:'));
  const params = new Map<string, string>();
  for (const item of section.split(/\n  - (?=name:)/).slice(1)) {
    const name = /^name: (\S+)/.exec(item)?.[1];
    const value = /\n    value: "?([^"\n]*)"?/.exec(item)?.[1];
    if (name && value !== undefined) {
      params.set(name, value);
    }
  }
  return params;
}

/** The body of the CronJob whose metadata name ends with CRONJOB_SUFFIX. */
function cronJobBody(): string {
  const objects = template
    .substring(template.indexOf('\nobjects:'))
    .split(/\n  - (?=\w+:)/)
    .slice(1);
  const matches = objects.filter(
    (body) => /(^|\n)\s*kind: CronJob\n/.test(body) && new RegExp(`\\n      name: \\S+${CRONJOB_SUFFIX}\\n`).test(body),
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one CronJob named *${CRONJOB_SUFFIX} in openshift.deploy.yml, found ${matches.length}`);
  }
  return matches[0];
}

interface TemplateEnv {
  name: string;
  value?: string;
  secretKey?: string;
}

/** The container's `env:` list: literal `value:` or `valueFrom.secretKeyRef.key`. */
function cronJobEnv(body: string): TemplateEnv[] {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^\s+env:$/.test(line));
  if (start < 0) {
    throw new Error('CronJob container has no env block');
  }
  const indent = (line: string) => line.length - line.trimStart().length;
  const envIndent = indent(lines[start]);
  const end = lines.findIndex((line, i) => i > start && line.trim() !== '' && indent(line) <= envIndent);
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .split(/\n?\s+- (?=name:)/)
    .filter((item) => item.startsWith('name:'))
    .map((item) => ({
      name: /^name: (\S+)/.exec(item)[1],
      value: /\n\s+value: "?([^"\n]*)"?/.exec(item)?.[1],
      secretKey: /secretKeyRef:\n\s+key: (\S+)/.exec(item)?.[1],
    }));
}

/** `args: ["..."]` on the CronJob container. */
function cronJobArgs(body: string): string[] {
  const args = /\n\s+args: (\[.*\])/.exec(body)?.[1];
  if (!args) {
    throw new Error('CronJob container has no args');
  }
  return JSON.parse(args);
}

/** ENTRYPOINT of the api image (exec form). The image's /app is api/ after `nest build`. */
function imageEntrypoint(): string[] {
  const dockerfile = readFileSync(resolve(API_DIR, 'Dockerfile'), 'utf8');
  const entrypoint = /^ENTRYPOINT (\[.*\])\s*$/m.exec(dockerfile)?.[1];
  if (!entrypoint) {
    throw new Error('api/Dockerfile has no exec-form ENTRYPOINT');
  }
  return JSON.parse(entrypoint);
}

function resolveParameters(value: string, params: Map<string, string>, envName: string): string {
  return value.replace(/\$\{\{?(\w+)\}?\}/g, (_match, param: string) => {
    if (!params.has(param)) {
      throw new Error(`${envName} uses template parameter ${param}, which has no default value`);
    }
    return params.get(param);
  });
}

/** The env the CronJob container gets, with test values for secrets and the DB connection. */
function batchEnv(entries: TemplateEnv[]): NodeJS.ProcessEnv {
  const params = templateParameters();
  const env: NodeJS.ProcessEnv = {};
  for (const entry of entries) {
    if (DB_CONNECTION_ENV.includes(entry.name)) {
      const testValue = process.env[entry.name];
      if (testValue === undefined) {
        throw new Error(`${entry.name} must be set to the test database for this test`);
      }
      env[entry.name] = testValue;
    } else if (entry.value !== undefined) {
      env[entry.name] = resolveParameters(entry.value, params, entry.name);
    } else if (entry.secretKey) {
      env[entry.name] = `batch-boot-test-${entry.secretKey}`;
    } else {
      throw new Error(`${entry.name} has neither a value nor a secretKeyRef key`);
    }
  }
  return env;
}

/**
 * Runs `fn` with console output captured rather than printed, and returns what
 * was printed. On failure the captured output is added to the error.
 */
async function captureConsole(fn: () => Promise<void>): Promise<string[]> {
  const printed: string[] = [];
  const spies = (['log', 'info', 'warn', 'error'] as const).map((level) =>
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      printed.push(args.map(String).join(' '));
    }),
  );
  try {
    await fn();
  } catch (error) {
    throw new Error(`${error}\nConsole output:\n${printed.join('\n')}`);
  } finally {
    spies.forEach((spy) => spy.mockRestore());
  }
  return printed;
}

beforeAll(async () => {
  await captureConsole(async () => {
    const dataSource = new DataSource(ormConfigMain as DataSourceOptions);
    await dataSource.initialize();
    try {
      await dataSource.runMigrations({ transaction: 'each' });
    } finally {
      await dataSource.destroy();
    }
  });
}, 120_000);

describe('work-flow-state-change-batch CronJob boot', () => {
  const body = cronJobBody();
  const entries = cronJobEnv(body);
  const [command, ...entrypointArgs] = imageEntrypoint();

  it('reads the CronJob env from the template', () => {
    expect(entries.map((e) => e.name)).toEqual(expect.arrayContaining(DB_CONNECTION_ENV));
    expect(new Set(entries.map((e) => e.name)).size).toBe(entries.length);
  });

  it('exits 0 with only the CronJob env', () => {
    const script = resolve(API_DIR, entrypointArgs[entrypointArgs.length - 1]);
    if (!existsSync(script)) {
      throw new Error(`${script} not found; run \`nest build\` first`);
    }
    // No inherited env: the container gets the image's PATH plus the CronJob env, nothing else.
    const result = spawnSync(command, [...entrypointArgs, ...cronJobArgs(body)], {
      cwd: API_DIR,
      env: { PATH: process.env.PATH, ...batchEnv(entries) },
      encoding: 'utf8',
      timeout: 120_000,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) {
      throw new Error(
        `Batch exited with status ${result.status} (signal ${result.signal}). Last output:\n${output.slice(-4000)}`,
      );
    }
    expect(output).toContain('Completed batch process for date-based workflow state changes');
  }, 150_000);
});

const SEED_PREFIX = 'batch-clock-test';
const BC_TODAY = '2026-11-06';
const BC_TOMORROW = '2026-11-07';

// Only Date is faked; real timers keep the database driver working.
const REAL_TIMERS = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
  'clearInterval', 'setTimeout', 'clearTimeout',
] as const;

// Both instants fall on BC_TODAY in America/Vancouver.
const CLOCKS: [string, string][] = [
  ['at the CronJob time, 08:30 UTC', '2026-11-06T08:30:00Z'],
  ['late evening in BC, when the UTC date is already tomorrow', '2026-11-07T06:30:00Z'],
];

interface Seed {
  name: string;
  state: WorkflowStateEnum;
  openDate: string;
  closedDate: string;
}

const SEEDS: Seed[] = [
  { name: `${SEED_PREFIX} opens today`, state: WorkflowStateEnum.PUBLISHED, openDate: BC_TODAY, closedDate: '2026-12-06' },
  { name: `${SEED_PREFIX} opens tomorrow`, state: WorkflowStateEnum.PUBLISHED, openDate: BC_TOMORROW, closedDate: '2026-12-07' },
  { name: `${SEED_PREFIX} closes today`, state: WorkflowStateEnum.COMMENT_OPEN, openDate: '2026-10-07', closedDate: BC_TODAY },
  { name: `${SEED_PREFIX} closes tomorrow`, state: WorkflowStateEnum.COMMENT_OPEN, openDate: '2026-10-08', closedDate: BC_TOMORROW },
];

// Startup notices for services this test runs without (object storage, SMTP, Cognito).
const EXPECTED_STARTUP_CONSOLE = [
  'Object storage credentials not provided.',
  'SMTP_SERVER is not set; emails will not be sent.',
  'jwksUri',
];

describe('batchDateBasedWorkflowStateChange with a fixed clock', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let ProjectService: typeof ProjectServiceType;

  beforeAll(async () => {
    const startupConsole = await captureConsole(async () => {
      ({ ProjectService } = await import('@api-modules/project/project.service'));
      const { AppModule } = await import('../app/app.module');
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule, LoggerModule.forRoot({ pinoHttp: { level: 'warn' } })],
      }).compile();
      app = moduleFixture.createNestApplication();
      await app.init();
    });
    expect(startupConsole.filter((line) => !EXPECTED_STARTUP_CONSOLE.some((notice) => line.startsWith(notice)))).toEqual([]);
    dataSource = app.get(DataSource);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.query(`DELETE FROM app_fom.project WHERE name LIKE $1`, [`${SEED_PREFIX}%`]);
    await app?.close();
  });

  describe.each(CLOCKS)('%s', (_label, instant) => {
    const ids = new Map<string, number>();

    beforeAll(async () => {
      await dataSource.query(`DELETE FROM app_fom.project WHERE name LIKE $1`, [`${SEED_PREFIX}%`]);
      const [{ forest_client_number }] = await dataSource.query(
        `SELECT forest_client_number FROM app_fom.forest_client ORDER BY forest_client_number LIMIT 1`,
      );
      const [{ district_id }] = await dataSource.query(
        `SELECT district_id FROM app_fom.district ORDER BY district_id LIMIT 1`,
      );
      for (const seed of SEEDS) {
        const [{ project_id }] = await dataSource.query(
          `INSERT INTO app_fom.project (name, description, fsp_id, district_id, forest_client_number,
             workflow_state_code, commenting_open_date, commenting_closed_date, create_user)
           VALUES ($1, $1, 1, $2, $3, $4, $5, $6, $7) RETURNING project_id`,
          [seed.name, district_id, forest_client_number, seed.state, seed.openDate, seed.closedDate, SEED_PREFIX],
        );
        ids.set(seed.name, project_id);
      }

      jest.useFakeTimers({ now: new Date(instant), doNotFake: [...REAL_TIMERS] });
      try {
        await app.get(ProjectService).batchDateBasedWorkflowStateChange();
        // The API resets this cache shortly after the batch each day (ProjectService.resetCache).
        await app.get(ProjectService).resetCache();
      } finally {
        jest.useRealTimers();
      }
    }, 60_000);

    const stateOf = async (name: string): Promise<string> =>
      (await dataSource.query(`SELECT workflow_state_code FROM app_fom.project WHERE project_id = $1`, [ids.get(name)]))[0]
        .workflow_state_code;

    // The public site's Commenting Open filter.
    const commentingOpenIds = async (): Promise<number[]> => {
      const res = await agent(app.getHttpServer())
        .get('/project/publicSummary')
        .query({ includeCommentOpen: 'true', includePostCommentOpen: 'false' })
        .expect(200);
      return res.body.map((p: { id: number }) => p.id);
    };

    it('opens a PUBLISHED FOM whose commenting open date is today in BC, and lists it as Commenting Open', async () => {
      expect(await stateOf(`${SEED_PREFIX} opens today`)).toBe(WorkflowStateEnum.COMMENT_OPEN);
      expect(await commentingOpenIds()).toContain(ids.get(`${SEED_PREFIX} opens today`));
    });

    it('leaves a PUBLISHED FOM opening tomorrow in BC unpublished to the public', async () => {
      expect(await stateOf(`${SEED_PREFIX} opens tomorrow`)).toBe(WorkflowStateEnum.PUBLISHED);
      expect(await commentingOpenIds()).not.toContain(ids.get(`${SEED_PREFIX} opens tomorrow`));
    });

    it('closes a COMMENT_OPEN FOM whose commenting closed date is today in BC, and drops it from Commenting Open', async () => {
      expect(await stateOf(`${SEED_PREFIX} closes today`)).toBe(WorkflowStateEnum.COMMENT_CLOSED);
      expect(await commentingOpenIds()).not.toContain(ids.get(`${SEED_PREFIX} closes today`));
    });

    it('keeps a COMMENT_OPEN FOM closing tomorrow in BC on Commenting Open', async () => {
      expect(await stateOf(`${SEED_PREFIX} closes tomorrow`)).toBe(WorkflowStateEnum.COMMENT_OPEN);
      expect(await commentingOpenIds()).toContain(ids.get(`${SEED_PREFIX} closes tomorrow`));
    });
  });
});
