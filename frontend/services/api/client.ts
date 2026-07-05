import { ApiError, type ApiErrorResponse } from "./types";

import { getAccessToken } from "@/lib/auth/token-storage";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type ApiClientQueryValue = string | number | boolean;

export interface ApiClientOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  accessToken?: string;
  query?: Record<
    string,
    | ApiClientQueryValue
    | ApiClientQueryValue[]
    | null
    | undefined
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
        url.searchParams.append(key, String(item));
      }
    }
  }

  return url.toString();
}

function normalizeErrorResponse(value: unknown): ApiErrorResponse | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if ("message" in value && typeof value.message === "string") {
    return value as ApiErrorResponse;
  }

  if ("detail" in value && typeof value.detail === "string") {
    return { message: value.detail };
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
