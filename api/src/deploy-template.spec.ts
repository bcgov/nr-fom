import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Every workload in api/openshift.deploy.yml boots the full AppModule - the
 * Deployment serves the API, the CronJobs run the batches through the same
 * main.ts - so each needs the env vars that providers refuse to start without.
 *
 * Regression: #1223 made PublicCommentService fail closed on a missing
 * DATA_ENCRYPTION_KEY, which only the Deployment received. Both batch CronJobs
 * then crashed at startup, so FOMs stopped moving PUBLISHED -> COMMENT_OPEN and
 * COMMENT_OPEN -> COMMENT_CLOSED, and newly opened FOMs vanished from the public
 * site.
 */
const REQUIRED_ENV = ['DATA_ENCRYPTION_KEY', 'DB_HOST', 'DB_PASSWORD'];

const template = readFileSync(resolve(__dirname, '../openshift.deploy.yml'), 'utf8');

/**
 * The template's objects: the top-level `objects:` list items. Items open with
 * either `- apiVersion:` or `- kind:`, so split on any two-space list item.
 */
const objects = template
  .substring(template.indexOf('\nobjects:'))
  .split(/\n  - (?=\w+:)/)
  .slice(1)
  .map((body) => '\n    ' + body);

const workloads = objects
  .map((body) => ({
    kind: /\n    kind: (\w+)/.exec(body)?.[1],
    name: /\n    metadata:[\s\S]*?\n      name: (\S+)/.exec(body)?.[1],
    body,
  }))
  .filter((o) => o.kind === 'Deployment' || o.kind === 'CronJob');

describe('api/openshift.deploy.yml', () => {
  it('has the API Deployment and both batch CronJobs', () => {
    expect(workloads.map((w) => w.kind).sort()).toEqual(['CronJob', 'CronJob', 'Deployment']);
  });

  describe.each(workloads.map((w) => [`${w.kind} ${w.name}`, w.body]))('%s', (_label, body) => {
    it.each(REQUIRED_ENV)('sets %s', (envName) => {
      expect(body).toMatch(new RegExp(`\\n\\s+- name: ${envName}\\n`));
    });
  });
});
