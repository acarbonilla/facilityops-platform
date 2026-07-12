import { z } from "zod";

import type { RoleFormMode } from "@/types/rbac";

const ROLE_CODE_PATTERN = /^[A-Za-z0-9_\s-]+$/;

export function createRoleFormSchema(mode: RoleFormMode) {
  return z.object({
    name: z.string().trim().min(1, "Role name is required."),
    code:
      mode !== "edit"
        ? z
            .string()
            .trim()
            .min(1, "Role code is required.")
            .regex(
              ROLE_CODE_PATTERN,
              "Use letters, numbers, spaces, underscores, or hyphens.",
            )
        : z.string(),
    description: z.string(),
  });
}
