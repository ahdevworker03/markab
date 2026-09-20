let accessToken: string | null = null;
const LEGACY_AUTH_STORAGE_KEYS = [
  "vrap.accessToken",
  "vrap.refreshToken",
  "vrap.accessTokenExpiresAt",
  "auth-token",
];

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export function removeLegacyAuthStorage(): void {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of LEGACY_AUTH_STORAGE_KEYS) storage.removeItem(key);
  }
}
