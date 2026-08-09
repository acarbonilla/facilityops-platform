"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { useAppShell } from "@/hooks/use-app-shell";
import { useFilteredNavigation } from "@/hooks/use-filtered-navigation";
import { APP_NAME } from "@/lib/constants";
import { getNavigationIcon } from "@/lib/layout/navigation-icons";
import type { NavigationItem } from "@/types/rbac";

function isNavActive(pathname: string, item: NavigationItem): boolean {
  return item.matchStrategy === "exact"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavigationList({
  collapsed,
  items,
  onNavigate,
  permissionsLoading,
  emptyEmployee,
  isAuthenticated,
  permissionsError,
}: {
  collapsed: boolean;
  items: NavigationItem[];
  onNavigate?: () => void;
  permissionsLoading: boolean;
  emptyEmployee: boolean;
  isAuthenticated: boolean;
  permissionsError: unknown;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col">
      {permissionsLoading ? (
        <p className="px-3 py-2 text-sm text-slate-400">
          Loading navigation access...
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
          {items.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = getNavigationIcon(item.href);
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={[
                    "group relative flex items-center gap-3 rounded-md text-sm transition",
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                    active
                      ? "bg-slate-800 text-white shadow-[inset_3px_0_0_0_#38bdf8]"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                  ].join(" ")}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon aria-hidden className="h-5 w-5 shrink-0" />
                  {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                  {collapsed ? (
                    <span
                      className="pointer-events-none absolute left-full z-20 ml-2 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-visible:block"
                      role="tooltip"
                    >
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mx-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-4 text-sm text-slate-400">
          <p className="font-medium text-slate-200">
            {isAuthenticated ? "No routes available" : "Navigation locked"}
          </p>
          {!collapsed ? (
            <p className="mt-1">
              {isAuthenticated
                ? emptyEmployee
                  ? "My Requests will appear once request access is confirmed."
                  : "This account does not currently expose any permission-based sections."
                : "Sign in to load the application navigation."}
            </p>
          ) : null}
        </div>
      )}

      {permissionsError && !collapsed ? (
        <p className="mt-2 px-3 text-xs text-amber-300">
          Permission-based items are hidden until permissions can be loaded again.
        </p>
      ) : null}
    </nav>
  );
}

function DesktopSidebar() {
  const {
    desktopCollapsed,
    toggleDesktopCollapsed,
    preferenceReady,
  } = useAppShell();
  const {
    items,
    permissionsLoading,
    permissionsError,
    isEmployeeRequesterMode,
    isAuthenticated,
  } = useFilteredNavigation();

  // Avoid hydration flash: render expanded width until preference is ready.
  const collapsed = preferenceReady ? desktopCollapsed : false;

  return (
    <aside
      className={[
        "relative hidden min-h-0 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 md:flex",
        "motion-safe:transition-[width] motion-safe:duration-200 motion-reduce:transition-none",
        collapsed ? "w-[4.5rem]" : "w-60",
      ].join(" ")}
      id="facilityops-desktop-sidebar"
    >
      <div
        className={[
          "flex items-center border-b border-slate-800 px-3 py-4",
          collapsed ? "justify-center" : "justify-between gap-2",
        ].join(" ")}
      >
        {collapsed ? (
          <span className="text-sm font-semibold tracking-wide text-white" title={APP_NAME}>
            FO
          </span>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{APP_NAME}</p>
            <p className="truncate text-xs text-slate-400">Operations workspace</p>
          </div>
        )}
      </div>

      <NavigationList
        collapsed={collapsed}
        emptyEmployee={isEmployeeRequesterMode}
        isAuthenticated={isAuthenticated}
        items={items}
        permissionsError={permissionsError}
        permissionsLoading={permissionsLoading}
      />

      <div className="border-t border-slate-800 p-2">
        <button
          aria-controls="facilityops-desktop-sidebar"
          aria-expanded={!collapsed}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
          onClick={toggleDesktopCollapsed}
          type="button"
        >
          {collapsed ? (
            <>
              <ChevronRight aria-hidden className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
            </>
          ) : (
            <>
              <ChevronLeft aria-hidden className="h-4 w-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function MobileNavigationDrawer() {
  const { mobileNavOpen, closeMobileNav } = useAppShell();
  const {
    items,
    permissionsLoading,
    permissionsError,
    isEmployeeRequesterMode,
    isAuthenticated,
  } = useFilteredNavigation();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileNav();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen, closeMobileNav]);

  if (!mobileNavOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        aria-label="Close navigation backdrop"
        className="absolute inset-0 bg-slate-950/60"
        onClick={closeMobileNav}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-slate-950 text-slate-300 shadow-xl"
        id="facilityops-mobile-navigation"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-white" id={titleId}>
              {APP_NAME}
            </p>
            <p className="text-xs text-slate-400">Operations workspace</p>
          </div>
          <button
            ref={closeButtonRef}
            aria-label="Close navigation"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-white"
            onClick={closeMobileNav}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <NavigationList
          collapsed={false}
          emptyEmployee={isEmployeeRequesterMode}
          isAuthenticated={isAuthenticated}
          items={items}
          onNavigate={closeMobileNav}
          permissionsError={permissionsError}
          permissionsLoading={permissionsLoading}
        />
      </aside>
    </div>
  );
}

export function MobileNavTrigger() {
  const { openMobileNav, mobileNavOpen } = useAppShell();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current && !mobileNavOpen) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = mobileNavOpen;
  }, [mobileNavOpen]);

  return (
    <button
      ref={triggerRef}
      aria-controls="facilityops-mobile-navigation"
      aria-expanded={mobileNavOpen}
      aria-label="Open navigation"
      className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
      onClick={openMobileNav}
      type="button"
    >
      <Menu aria-hidden className="h-5 w-5" />
    </button>
  );
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileNavigationDrawer />
    </>
  );
}
