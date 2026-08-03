# FO-082A — FacilityOps Public Landing Page

**Status:** COMPLETE AND MERGED to `main` via PR #51 (FO-082A-R2)  
**Original branch:** `feature/public-landing-page` (lost; tip recovered at `4fb72ad…`)  
**Date:** 2026-07-29 (implementation) / 2026-08-03 (recovery & merge)  
**Merge commit:** `3fe79e5c1de1ee8ef815bfc26be6db0e9e8ac034`  
**Starting SHA:** `e60b79b247be0c9fd615e19e6fbdf3a45edf6096`  
**Independent of:** FO-081 / FO-082 attachment work (`feature/business-module-attachments`)

## Recovery note

See `FO-082A-R1 - Public Landing Page Recovery.md` for dangling-commit inspection and selective restore. FO-082A-R2 finalized acceptance and merged PR #51.
## Summary

FO-082A replaces the Stage 1 foundation home page with a premium public landing experience for FacilityOps. The page is designed for customer presentations, demonstrations, and future production use.

## Architecture

| Area | Path |
| --- | --- |
| Route | `frontend/app/page.tsx` (`/`) |
| Shell | `features/landing/components/landing-page.tsx` |
| Nav | sticky client nav with mobile menu |
| Content config | `lib/landing/content.ts` |
| Applications catalog | `lib/landing/public-applications.ts` |
| Live Platform Preview | `features/landing/components/preview/*` |
| Preview demo data | `lib/landing/live-platform-preview.ts` |
| Fonts | Manrope (display) + Source Sans 3 (body) via `next/font` |

Unauthenticated by design. CTA targets `/login`. No middleware changes. Attachment branches untouched.

## Sections

1. Sticky navigation (Platform, Modules, Applications, About, Contact, Sign In)
2. Dark hero with brand-first headline and compact dashboard mock
3. **Live Platform Preview** (overlaps hero bottom; presentation dashboard shell)
4. Trust highlights
5. Platform modules
6. End-to-end workflow
7. Business benefits
8. Configurable applications catalog
9. Security controls (measured claims)
10. Future AI roadmap (explicitly labeled)
11. Final CTA
12. Footer with placeholders for privacy/contact/version

## Live Platform Preview

### Architecture

Reusable components under `features/landing/components/preview/`:

- `live-platform-preview.tsx` — section shell + browser frame
- `preview-sidebar.tsx` — compact decorative module nav
- `preview-metric-card.tsx` — summary metrics
- `preview-trend-chart.tsx` — SVG trend with accessible text summary
- `preview-activity-list.tsx` — recent activity
- `preview-work-queue.tsx` — sample queue (table + mobile cards)

Placed immediately after the hero inside a shared dark band, with negative top margin so the frame partially overlaps the hero.

### Static demonstration-data policy

All preview content comes from `LIVE_PLATFORM_PREVIEW` in `lib/landing/live-platform-preview.ts`.

- No API requests
- No real tenant, user, facility, asset, or attachment records
- Generic names only (Alex R., Jamie C., Facilities Team, Maintenance Team)
- Sample references such as FT-1048, WO-0321, INS-0215
- `PREVIEW_FORBIDDEN_PATTERNS` guards against tenant/user identifiers and emails in tests

### Responsive behavior

| Viewport | Behavior |
| --- | --- |
| Desktop | Full shell, sidebar, multi-column metrics/chart/activity/queue |
| Tablet | Reduced chrome; chart + activity + two-column insights |
| Mobile | Simplified preview: metrics + activity + stacked queue cards; secondary panels hidden; no horizontal overflow |

### Accessibility behavior

- Section heading: `live-platform-preview-heading`
- Chart marked `aria-hidden` with an `sr-only` text summary
- Status/priority shown as labeled badges (not color alone)
- Decorative chrome (window dots, search, bell, sidebar items) is non-interactive (`aria-hidden` / spans — not active buttons)
- `prefers-reduced-motion` disables landing fade-up motion

### Future AI labelling

The AI insight card is labelled **Future Capability** with an explicit disclaimer that it is a preview concept and not available in production today.

## Applications configuration

`PUBLIC_APPLICATIONS` supports:

- name, description, icon, status, href, external

Internal apps use normal routing. External apps open in a new tab.

## Accessibility and motion

- Semantic headings and landmarks
- Keyboard-operable nav and mobile menu (Escape closes)
- Visible focus styles
- `prefers-reduced-motion` disables landing fade animation

## Validation

| Check | Result |
| --- | --- |
| Landing tests | 16 passed (includes Live Platform Preview) |
| Frontend suite | 301 passed |
| ESLint | passed |
| TypeScript (`tsc --noEmit`) | passed |
| Production build | passed |

## Deferred

- Real logo SVG asset pack
- Production privacy/contact pages
- Screenshot capture for Open Graph image
- Attachment feature work (separate branch)
