import { ApiError, type ApiErrorResponse } from "./types";

import { getAccessToken } from "@/lib/auth/token-storage";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

type ApiClientQueryValue = string | number | boolean;
type ApiClientQueryItem = ApiClientQueryValue | null | undefined;

export interface ApiClientOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  accessToken?: string;
  query?: Record<
    string,
    | ApiClientQueryItem
    | ApiClientQueryItem[]
  >;
}

function resolveApiUrl(
  endpoint: string,
  query?: ApiClientOptions["query"],
): string {
  if (!API_BASE_URL) {
    throw new ApiError("The frontend API URL is not configured.");
  }

  const url = new URL(
    `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`,
  );

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) {
        continue;
      }

      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (item === null || item === undefined) {
          continue;
        }
        url.searchParams.append(key, String(item));
      }
    }
  }

  return url.toString();
}

export function normalizeErrorResponse(value: unknown): ApiErrorResponse | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.detail === "string"
        ? record.detail
        : undefined;
  const dependencies = Array.isArray(record.dependencies)
    ? record.dependencies.filter((item): item is string => typeof item === "string")
    : undefined;
  const hierarchyErrors =
    typeof record.errors === "object" &&
    record.errors !== null &&
    !Array.isArray(record.errors) &&
    Object.values(record.errors).every((item) => typeof item === "string")
      ? (record.errors as Record<string, string>)
      : undefined;
  const nestedValidationErrors =
    typeof record.errors === "object" &&
    record.errors !== null &&
    !Array.isArray(record.errors) &&
    Object.values(record.errors).every(
      (item) =>
        Array.isArray(item) &&
        item.every((message) => typeof message === "string"),
    )
      ? (record.errors as Record<string, string[]>)
      : undefined;

  if (message && (dependencies || hierarchyErrors || nestedValidationErrors)) {
    return {
      message,
      ...(dependencies ? { dependencies } : {}),
      ...(nestedValidationErrors ? { errors: nestedValidationErrors } : {}),
      ...(hierarchyErrors ? { hierarchyErrors } : {}),
    };
  }

  if (typeof record.message === "string") {
    return { message: record.message };
  }

  if (typeof record.detail === "string") {
    return { message: record.detail };
  }

  const validationEntries = Object.entries(value).filter(([, entryValue]) => {
    if (Array.isArray(entryValue)) {
      return entryValue.every((item) => typeof item === "string");
    }

    return typeof entryValue === "string";
  });

  if (validationEntries.length > 0) {
    const errors = Object.fromEntries(
      validationEntries.map(([key, entryValue]) => [
        key,
        Array.isArray(entryValue) ? entryValue : [entryValue],
      ]),
    );
    const priorityMessage =
      errors.non_field_errors?.[0] ??
      validationEntries
        .flatMap(([, entryValue]) =>
          Array.isArray(entryValue) ? entryValue : [entryValue],
        )
        .find(Boolean);

    return {
      message: priorityMessage ?? "The backend rejected one or more fields.",
      errors,
    };
  }

  return undefined;
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { accessToken, body, headers, query, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  const resolvedAccessToken = accessToken ?? getAccessToken();
  if (resolvedAccessToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedAccessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(endpoint, query), {
      ...requestOptions,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Unable to connect to the backend service.");
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  let payload: unknown;
  if (isJson && response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(
        "The backend returned an invalid JSON response.",
        response.status,
      );
    }
  }

  if (!response.ok) {
    const details = normalizeErrorResponse(payload);
    if (response.status === 401) {
      throw new ApiError(
        "Authentication is required or the session has expired.",
        response.status,
        details,
      );
    }
    throw new ApiError(
      details?.message ?? `API request failed with status ${response.status}.`,
      response.status,
      details,
    );
  }

  return payload as T;
}
