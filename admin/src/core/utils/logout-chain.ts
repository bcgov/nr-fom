/**
 * Builds the BC Gov federated logout chain, with Cognito firing LAST:
 *
 *   app -> Siteminder logoff.cgi -> Keycloak end-session -> Cognito /logout -> app
 *
 * Why this order, rather than Amplify's signOut() which hits Cognito first: putting
 * Cognito last means Keycloak's `post_logout_redirect_uri` is the *Cognito* /logout
 * URL - one stable, app-agnostic value - so this app's own URL only ever has to be
 * registered as a Cognito sign-out URL, never on the shared FAM-managed Keycloak
 * client. The browser still carries the Cognito session cookie when the chain reaches
 * Cognito, so that final hop clears it and returns to the app in one pass.
 *
 * Each nested URL is encoded exactly ONCE, where it is embedded in the enclosing
 * query string. Not twice, not zero times: without it `logoff.cgi` parses the inner
 * `?...&...` as its own query params and silently drops the next hop's redirect
 * target.
 */

/** Everything the chain needs, flattened out of the served AwsCognitoConfig. */
export interface FederatedLogoutConfig {
  /** Siteminder logoff.cgi base, without query string. */
  siteminderLogoutUrl: string;
  /** Keycloak end-session endpoint, without query string. */
  keycloakLogoutUrl: string;
  keycloakClientIdIdir: string;
  keycloakClientIdBceidBusiness: string;
  /** (awsCognitoConfig.oauth.domain). */
  cognitoDomain: string;
  /** This app's Cognito app-client id. */
  cognitoClientId: string;
  /** Absolute URL the user lands on when fully logged out; must be an allow-listed Cognito sign-out URL. */
  appReturnUrl: string;
}

/**
 * FAM registers one Keycloak client per IdP, and the end-session call must carry the
 * one matching the IdP the user signed in with - sending the wrong id leaves that
 * IdP's session alive.
 *
 * Matching is by substring rather than equality so it holds whether `custom:idp_name`
 * carries the bare IdP name (`idir`, which is what FAM maps today) or the Cognito
 * provider name (`DEV-IDIR` / `TEST-IDIR` / `PROD-IDIR`).
 *
 * Returns null for an unknown or absent IdP - the caller then falls back to a plain
 * Cognito sign-out rather than guessing a client id.
 */
const keycloakClientIdFor = (
  config: FederatedLogoutConfig,
  idpProvider?: string
): string | null => {
  const idp = idpProvider?.toLowerCase() ?? '';
  if (idp.includes('bceidbusiness')) {
    return config.keycloakClientIdBceidBusiness || null;
  }
  if (idp.includes('idir')) {
    return config.keycloakClientIdIdir || null;
  }
  return null;
};

/**
 * @returns the chain URL to navigate to, or null when the IdP is unknown or any
 *   required config value is missing. Callers must treat null as "not configured"
 *   and fall back to Amplify's signOut(), which is a Cognito-only sign-out - far
 *   better than navigating to a malformed URL.
 */
export function buildFederatedLogoutUrl(
  config: FederatedLogoutConfig,
  idpProvider?: string
): string | null {
  const keycloakClientId = keycloakClientIdFor(config, idpProvider);
  if (
    !config.siteminderLogoutUrl ||
    !config.keycloakLogoutUrl ||
    !keycloakClientId ||
    !config.cognitoDomain ||
    !config.cognitoClientId ||
    !config.appReturnUrl
  ) {
    return null;
  }

  // Innermost: Cognito clears its own session cookie, then returns to the app.
  const cognitoLogout =
    `https://${config.cognitoDomain}/logout` +
    `?client_id=${encodeURIComponent(config.cognitoClientId)}` +
    `&logout_uri=${encodeURIComponent(config.appReturnUrl)}`;

  // Keycloak clears its session, then returns to the Cognito logout URL. That Cognito
  // URL is the only value needing registration on the shared FAM Keycloak client's
  // post-logout allow-list - never this app's URL.
  const keycloakLogout =
    `${config.keycloakLogoutUrl}` +
    `?client_id=${encodeURIComponent(keycloakClientId)}` +
    `&post_logout_redirect_uri=${encodeURIComponent(cognitoLogout)}`;

  // Outermost: Siteminder logs off the IDIR / BCeID session. retnow=1 skips its
  // interstitial page.
  return `${config.siteminderLogoutUrl}?retnow=1&returl=${encodeURIComponent(keycloakLogout)}`;
}
