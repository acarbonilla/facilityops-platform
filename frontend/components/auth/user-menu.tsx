"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import { getUserDisplayName } from "@/lib/auth/user-display";

import { UserAvatar } from "./user-avatar";

export function UserMenu() {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsLoggingOut(true);
    setIsOpen(false);
    await logout();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <UserAvatar size="sm" user={user} />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-medium text-slate-900">
            {getUserDisplayName(user)}
          </p>
          <p className="truncate text-xs text-slate-500">
            {user?.email ?? "Authenticated account"}
          </p>
        </div>
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
          role="menu"
        >
          <div className="rounded-lg bg-slate-50 px-3 py-3">
            <p className="truncate text-sm font-medium text-slate-900">
              {getUserDisplayName(user)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {user?.email ?? "Authenticated account"}
            </p>
          </div>

          <div className="mt-2 space-y-1">
            <Link
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              href="/profile"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              Profile
            </Link>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
