export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface HealthCheckResponse {
  status: "ok" | string;
  service: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ApiErrorResponse;

  constructor(
    message: string,
    status = 0,
    details?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details?.code;
    this.details = details;
  }
}
