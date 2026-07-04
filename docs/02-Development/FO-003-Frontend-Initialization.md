# FO-003: Frontend Initialization — Next.js + TypeScript + Tailwind

## Purpose

Establish the FacilityOps frontend foundation without authentication, backend integration, dashboard functionality, or business pages.

## Frontend Structure

The frontend uses the Next.js App Router with root-level `app`, `components`, `features`, `hooks`, `lib`, `services`, `styles`, `types`, `utils`, and `public` directories. TypeScript imports use the `@/*` alias.

## Packages Installed

- Next.js, React, and React DOM
- TypeScript and React/Node type definitions
- Tailwind CSS, PostCSS, and Autoprefixer
- ESLint and eslint-config-next
- TanStack Query, React Hook Form, Zod, clsx, tailwind-merge, and lucide-react

The approved future libraries are installed but are not integrated into features yet.

## Environment Variables

`NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_API_URL` are documented in `frontend/.env.example`. No real environment file or secret was created.

## Commands to Run

From `frontend/`:

```powershell
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000` to view the foundation page.

## Validation Checklist

- Dependency installation completes.
- ESLint and production build pass.
- The development server starts.
- The foundation page contains all required initialization text.
- The backend remains unchanged.

## Known Limitations

The frontend has no authentication, providers, forms, schemas, backend calls, business pages, dashboard, or production deployment configuration. The local Node.js release should be upgraded to a current supported maintenance release.

## Next Task Recommendation

Upgrade and standardize the Node.js runtime, review the npm audit findings, then proceed with the next approved foundation task.
