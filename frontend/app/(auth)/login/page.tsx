"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import {
  clearRememberedEmail,
  getRememberedEmail,
  setRememberedEmail,
} from "@/lib/auth/remembered-email";
import { APP_NAME } from "@/lib/constants";
import type { LoginCredentials } from "@/types/auth";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

interface LoginFormValues extends LoginCredentials {
  rememberMe: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  useEffect(() => {
    const rememberedEmail = getRememberedEmail();

    if (!rememberedEmail) {
      return;
    }

    setValue("email", rememberedEmail);
    setValue("rememberMe", true);
  }, [setValue]);

  async function onSubmit(values: LoginFormValues) {
    clearErrors();
    setSubmitError(null);

    const validation = loginSchema.safeParse({
      email: values.email,
      password: values.password,
    });
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") {
          setError(field, { type: "validate", message: issue.message });
        }
      }
      return;
    }

    try {
      await login(validation.data);

      if (values.rememberMe) {
        setRememberedEmail(validation.data.email);
      } else {
        clearRememberedEmail();
      }

      router.replace("/dashboard");
    } catch {
      setSubmitError("Unable to sign in. Check your email and password and try again.");
    }
  }

  const isBusy = isSubmitting || isAuthLoading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            {APP_NAME}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use your FacilityOps account to continue.
          </p>
        </div>

        <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="email"
              inputMode="email"
              type="email"
              {...register("email")}
            />
            {errors.email ? (
              <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="password"
              type="password"
              {...register("password")}
            />
            {errors.password ? (
              <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-2 focus:ring-blue-100"
              type="checkbox"
              {...register("rememberMe", {
                onChange: (event) => {
                  if (!event.target.checked) {
                    clearRememberedEmail();
                  }
                },
              })}
            />
            <span>
              <span className="block font-medium text-slate-900">Remember Me</span>
              <span className="block text-slate-600">Remember my email on this device.</span>
            </span>
          </label>

          {submitError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {submitError}
            </div>
          ) : null}

          <button
            className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            type="submit"
          >
            {isBusy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
