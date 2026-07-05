const ACCESS_TOKEN_KEY = "facilityops.access_token";
const REFRESH_TOKEN_KEY = "facilityops.refresh_token";

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

// This local-development storage strategy may evolve for production security.
export function setTokens(access: string, refresh: string): void {
  const storage = getStorage();
  storage?.setItem(ACCESS_TOKEN_KEY, access);
  storage?.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  const storage = getStorage();
  storage?.removeItem(ACCESS_TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
}
