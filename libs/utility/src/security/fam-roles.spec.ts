import { parseRole, rolesFromClaims, SCOPE_DISTRICT, SCOPE_FOREST_CLIENT, SCOPE_REGION, scopeValue } from './fam-roles';

describe('fam-roles', () => {
  describe('rolesFromClaims', () => {
    it('reads client_roles and drops FAM: sidecars', () => {
      expect(rolesFromClaims({
        client_roles: ['FOM_REVIEWER', 'FAM:EXPIRES:2026-09-30:FOM_REVIEWER'],
      })).toStrictEqual(['FOM_REVIEWER']);
    });

    it('falls back to resource_access for the azp client only', () => {
      expect(rolesFromClaims({
        azp: 'fom',
        resource_access: { fom: { roles: ['FOM_ADMIN'] }, other: { roles: ['X'] } },
      })).toStrictEqual(['FOM_ADMIN']);
    });

    it('returns empty for null, missing or malformed claims', () => {
      expect(rolesFromClaims(null)).toStrictEqual([]);
      expect(rolesFromClaims({})).toStrictEqual([]);
      expect(rolesFromClaims({ client_roles: 'FOM_ADMIN' })).toStrictEqual([]);
      expect(rolesFromClaims({ azp: 'fom', resource_access: { fom: 'nope' } })).toStrictEqual([]);
      expect(rolesFromClaims({ client_roles: [42, null, 'FOM_ADMIN'] })).toStrictEqual(['FOM_ADMIN']);
    });
  });

  describe('parseRole', () => {
    it.each([
      ['FOM_REVIEWER', 'FOM_REVIEWER', []],
      ['FOM_SUBMITTER_FOREST_CLIENT-00001018', 'FOM_SUBMITTER', [{ type: SCOPE_FOREST_CLIENT, value: '00001018' }]],
      ['CHR_FREP_EDITOR_DISTRICT-DCC', 'CHR_FREP_EDITOR', [{ type: SCOPE_DISTRICT, value: 'DCC' }]],
      ['FREP_EDITOR_REGION-KOOTENAY_BOUNDARY', 'FREP_EDITOR', [{ type: SCOPE_REGION, value: 'KOOTENAY_BOUNDARY' }]],
      ['FOM_SUBMITTER_DISTRICT-DCC_FOREST_CLIENT-00001012', 'FOM_SUBMITTER', [
        { type: SCOPE_DISTRICT, value: 'DCC' },
        { type: SCOPE_FOREST_CLIENT, value: '00001012' },
      ]],
      ['SOME-ROLE', 'SOME-ROLE', []],
      ['Submitter (SLR)_DISTRICT-DCC', 'Submitter (SLR)', [{ type: SCOPE_DISTRICT, value: 'DCC' }]],
      // A scope type with no base in front of it is not a scope.
      ['_FOREST_CLIENT-1', '_FOREST_CLIENT-1', []],
    ])('%s', (name, base, scopes) => {
      expect(parseRole(name)).toStrictEqual({ baseRole: base, scopes });
    });

    it('exposes a scope value by type', () => {
      const parsed = parseRole('FOM_SUBMITTER_DISTRICT-DCC_FOREST_CLIENT-00001012');
      expect(scopeValue(parsed, SCOPE_FOREST_CLIENT)).toBe('00001012');
      expect(scopeValue(parsed, SCOPE_REGION)).toBeUndefined();
    });
  });
});
