/**
 * Builds the employee acceptance URL from the running app's own origin and base path,
 * matching the existing /accept-invitation?token= route. The token is never stored.
 */
export function buildInvitationUrl(token: string): string {
  const url = new URL(
    `${import.meta.env.BASE_URL}accept-invitation`,
    window.location.origin,
  );
  url.searchParams.set("token", token);
  return url.toString();
}
