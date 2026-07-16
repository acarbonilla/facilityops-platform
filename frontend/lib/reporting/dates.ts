export const REPORTING_DEFAULT_RANGE_DAYS = 90;
export const REPORTING_MAX_RANGE_DAYS = 180;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateInput(value: string): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function toLocalStartOfDayIso(dateInput: string): string | null {
  const parsed = parseLocalDateInput(dateInput);
  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed.toISOString();
}

export function toLocalEndOfDayIso(dateInput: string): string | null {
  const parsed = parseLocalDateInput(dateInput);
  if (!parsed) {
    return null;
  }

  parsed.setHours(23, 59, 59, 999);
  return parsed.toISOString();
}

export function getCalendarDaySpan(dateFrom: string, dateTo: string): number | null {
  const from = parseLocalDateInput(dateFrom);
  const to = parseLocalDateInput(dateTo);
  if (!from || !to) {
    return null;
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function getDefaultReportingDateRange(
  reference: Date = new Date(),
): { dateFrom: string; dateTo: string } {
  const dateTo = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - REPORTING_DEFAULT_RANGE_DAYS);

  return {
    dateFrom: formatDateInputValue(dateFrom),
    dateTo: formatDateInputValue(dateTo),
  };
}

export type ReportingDateValidationError =
  | "blank"
  | "malformed"
  | "reversed"
  | "exceeds_max";

export function validateReportingDateRange(
  dateFrom: string,
  dateTo: string,
): ReportingDateValidationError | null {
  if (!dateFrom.trim() || !dateTo.trim()) {
    return "blank";
  }

  const span = getCalendarDaySpan(dateFrom, dateTo);
  if (span === null) {
    return "malformed";
  }

  if (span < 0) {
    return "reversed";
  }

  if (span > REPORTING_MAX_RANGE_DAYS) {
    return "exceeds_max";
  }

  return null;
}

/**
 * Build ISO-8601 bounds for the Reporting API.
 *
 * Date From → local start of day.
 * Date To → local end of day, clamped so the backend timedelta span never
 * exceeds 180 days when the selected calendar span is exactly 180.
 */
export function toReportingApiDateBounds(
  dateFrom: string,
  dateTo: string,
): { date_from: string; date_to: string } | null {
  if (validateReportingDateRange(dateFrom, dateTo)) {
    return null;
  }

  const fromIso = toLocalStartOfDayIso(dateFrom);
  const endOfToIso = toLocalEndOfDayIso(dateTo);
  if (!fromIso || !endOfToIso) {
    return null;
  }

  const fromMs = new Date(fromIso).getTime();
  const maxToMs = fromMs + REPORTING_MAX_RANGE_DAYS * 86_400_000;
  const endOfToMs = new Date(endOfToIso).getTime();
  const dateToIso =
    endOfToMs > maxToMs ? new Date(maxToMs).toISOString() : endOfToIso;

  return {
    date_from: fromIso,
    date_to: dateToIso,
  };
}
