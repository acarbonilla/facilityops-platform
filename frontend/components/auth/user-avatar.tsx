"use client";

import { getUserInitials } from "@/lib/auth/user-display";
import type { AuthUser } from "@/types/auth";

export interface UserAvatarProps {
  user: AuthUser | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
} as const;

export function UserAvatar({ user, size = "md" }: UserAvatarProps) {
  const initials = getUserInitials(user);

  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex items-center justify-center rounded-full bg-slate-900 font-semibold text-white",
        SIZE_CLASSES[size],
      ].join(" ")}
    >
      {initials}
    </span>
  );
}
