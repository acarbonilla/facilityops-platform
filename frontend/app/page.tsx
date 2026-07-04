import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Stage 1 — Foundation
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Frontend initialized successfully
        </p>
        <p className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Next.js + TypeScript + Tailwind CSS
        </p>
      </section>
    </main>
  );
}
