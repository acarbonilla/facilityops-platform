"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { AppShell } from "@/components/layout/app-shell";
import { APP_NAME } from "@/lib/constants";
import { API_BASE_URL } from "@/services/api/client";
import { getBackendHealth } from "@/services/api/health";

export default function Home() {
  const healthQuery = useQuery({
    queryKey: ["backend-health"],
    queryFn: getBackendHealth,
  });

  return (
    <AppShell>
      <section>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Stage 1 — Foundation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {APP_NAME}
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Frontend initialized successfully
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Backend connectivity
          </h2>
          <p className="mt-1 break-all text-sm text-slate-500">
            API base URL: {API_BASE_URL || "Not configured"}
          </p>
        </div>

        {healthQuery.isPending ? (
          <LoadingState
            title="Checking backend connection"
            message="Contacting the FacilityOps backend health endpoint."
          />
        ) : null}

        {healthQuery.isError ? (
          <ErrorState
            title="Backend unavailable"
            message="The frontend is running, but the backend health endpoint could not be reached. Confirm the API URL and backend server status."
            action={
              <button
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                onClick={() => healthQuery.refetch()}
                type="button"
              >
                Retry connection
              </button>
            }
          />
        ) : null}

        {healthQuery.isSuccess ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-950">Backend connected</p>
            <p className="mt-1 text-sm text-emerald-800">
              {healthQuery.data.service} reported status “{healthQuery.data.status}”.
            </p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
