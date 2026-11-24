/**
 * Builds the BC Gov SSO sign-out chain:
 *
 *   app -> Siteminder logoff.cgi -> Keycloak end-session -> app (/admin/logout)
 *
 * Why Siteminder first: FOM signs in BCeID Business users as well as IDIR, and
 * BCeID goes through Siteminder, which keeps its own session after Keycloak's
 * ends - the next "Log in" would walk straight back in without a password
 * prompt. The SSO team's documented fix is to chain through Siteminder's
 * logoff.cgi (sso-docs: "SiteMinder - Chained Logout"). It is harmless for IDIR:
 * `retnow=1` returns at once.
 *
 * `id_token_hint` must be read off the stored session BEFORE the local tokens are
 * cleared; without it Keycloak cannot attribute the logout to a session and the
 * realm session survives.
 *
 * Each nested URL is encoded exactly ONCE, where it is embedded in the enclosing
 * query string, so the Keycloak URL's own ?/& survive Siteminder's parsing.
 */

export interface LogoutChainConfig {
  /** Realm issuer, e.g. https://test.loginproxy.gov.bc.ca/auth/realms/standard. */
  issuerUri: string;
  /** FOM's CSS integration client id. */
  clientId: string;
  /** Absolute URL to land on when fully signed out; registered on the CSS integration. */
  postLogoutRedirectUri: string;
  /** The session's ID token; omitted only when the session is already gone. */
  idToken?: string;
}

/**
 * Siteminder's logoff endpoint for the realm in use: the production one for the
 * production realm, the test one for dev and test.
 */
export function siteminderLogoffUrl(issuerUri: string): string {
  let host = '';
  try {
    host = new URL(issuerUri).host;
  } catch {
    /* not a URL - treat as non-production */
  }
  return host === 'loginproxy.gov.bc.ca'
    ? 'https://logon7.gov.bc.ca/clp-cgi/logoff.cgi'
    : 'https://logontest7.gov.bc.ca/clp-cgi/logoff.cgi';
}

/** Keycloak's end-session URL. The path is fixed by Keycloak for every realm. */
export function buildKeycloakLogoutUrl(config: LogoutChainConfig): string {
  const url = new URL(`${config.issuerUri.replace(/\/+$/, '')}/protocol/openid-connect/logout`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('post_logout_redirect_uri', config.postLogoutRedirectUri);
  if (config.idToken) {
    url.searchParams.set('id_token_hint', config.idToken);
  }
  return url.toString();
}

/**
 * @returns the chain URL to navigate to, or null when issuer, client id or
 *   landing URL is missing - callers then clear the local session and go to the
 *   landing page rather than navigate to a malformed URL.
 */
export function buildLogoutChainUrl(config: LogoutChainConfig): string | null {
  if (!config.issuerUri || !config.clientId || !config.postLogoutRedirectUri) {
    return null;
  }
  try {
    const keycloakLogout = buildKeycloakLogoutUrl(config);
    return `${siteminderLogoffUrl(config.issuerUri)}?retnow=1&returl=${encodeURIComponent(keycloakLogout)}`;
  } catch {
    return null;
  }
}
