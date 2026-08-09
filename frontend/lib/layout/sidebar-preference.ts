/** FO-116 desktop sidebar preference (localStorage only). */

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "facilityops.sidebar.collapsed";

export function readSidebarCollapsedPreference(): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeSidebarCollapsedPreference(collapsed: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed ? "true" : "false",
    );
  } catch {
    // Preference persistence is best-effort only.
  }
}
