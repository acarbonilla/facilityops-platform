const FM_TICKETS_PREFIX = "/fm-tickets";
const MY_REQUESTS_PREFIX = "/my-requests";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FmTicketRouteKind =
  | "list"
  | "create"
  | "detail"
  | "edit"
  | "other"
  | "unrelated";

export function classifyFmTicketPathname(pathname: string): FmTicketRouteKind {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (normalized === FM_TICKETS_PREFIX) {
    return "list";
  }

  if (!normalized.startsWith(`${FM_TICKETS_PREFIX}/`)) {
    return "unrelated";
  }

  const remainder = normalized.slice(FM_TICKETS_PREFIX.length + 1);
  if (remainder === "new") {
    return "create";
  }

  const [id, action] = remainder.split("/");
  if (id && UUID_PATTERN.test(id)) {
    if (!action) {
      return "detail";
    }
    if (action === "edit") {
      return "edit";
    }
  }

  return "other";
}

export function extractFmTicketIdFromPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (!normalized.startsWith(`${FM_TICKETS_PREFIX}/`)) {
    return null;
  }

  const remainder = normalized.slice(FM_TICKETS_PREFIX.length + 1);
  const [id] = remainder.split("/");
  if (id && UUID_PATTERN.test(id)) {
    return id;
  }

  return null;
}

/**
 * Map operational FM Ticket URLs to My Requests routes for Employee-only users.
 * Returns null when no safe redirect exists (leave generic not-found behavior).
 */
export function resolveEmployeeFmTicketRedirect(
  pathname: string,
  isRequesterMode: boolean,
): string | null {
  if (!isRequesterMode) {
    return null;
  }

  const kind = classifyFmTicketPathname(pathname);
  switch (kind) {
    case "list":
      return MY_REQUESTS_PREFIX;
    case "create":
      return `${MY_REQUESTS_PREFIX}/new`;
    case "detail": {
      const id = extractFmTicketIdFromPathname(pathname);
      return id ? `${MY_REQUESTS_PREFIX}/${id}` : MY_REQUESTS_PREFIX;
    }
    case "edit": {
      const id = extractFmTicketIdFromPathname(pathname);
      return id ? `${MY_REQUESTS_PREFIX}/${id}` : MY_REQUESTS_PREFIX;
    }
    case "other":
      return MY_REQUESTS_PREFIX;
    default:
      return null;
  }
}

export function isMyRequestsPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === MY_REQUESTS_PREFIX ||
    normalized.startsWith(`${MY_REQUESTS_PREFIX}/`)
  );
}
