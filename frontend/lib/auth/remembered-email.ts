const REMEMBERED_EMAIL_KEY = "facilityops.rememberedEmail";

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getRememberedEmail(): string {
  return getStorage()?.getItem(REMEMBERED_EMAIL_KEY) ?? "";
}

export function setRememberedEmail(email: string): void {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return;
  }

  getStorage()?.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
}

export function clearRememberedEmail(): void {
  getStorage()?.removeItem(REMEMBERED_EMAIL_KEY);
}
