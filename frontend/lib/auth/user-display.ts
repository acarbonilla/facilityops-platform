import type { AuthUser } from "@/types/auth";

export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) {
    return "My account";
  }

  const fullName = [user.first_name, user.last_name]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || user.email;
}

export function getUserInitials(user: AuthUser | null): string {
  if (!user) {
    return "U";
  }

  const initials = [user.first_name, user.last_name]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (initials) {
    return initials;
  }

  return user.email.trim().charAt(0).toUpperCase() || "U";
}
