import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          FacilityOps Platform
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Stage 1 Foundation
        </h1>
        <p className="mt-3 text-base text-slate-600">
          The application shell is available. Continue to the sign-in screen to
          access the authenticated workspace.
        </p>
        <div className="mt-6">
          <Link
            className="inline-flex rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            href="/login"
          >
            Go to login
          </Link>
        </div>
      </section>
    </main>
  );
}
