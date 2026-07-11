import { z } from "zod";

import type { UserFormMode } from "@/types/users";

export function createUserFormSchema(mode: UserFormMode) {
  return z
    .object({
      email: z.email("Enter a valid email address."),
      first_name: z.string().trim(),
      last_name: z.string().trim(),
      tenant: z.string(),
      organization: z.string(),
      password:
        mode === "create"
          ? z.string().min(1, "Password is required.")
          : z.string(),
      confirm_password:
        mode === "create"
          ? z.string().min(1, "Confirm password is required.")
          : z.string(),
      is_active: z.boolean(),
      is_staff: z.boolean(),
    })
    .refine((values) => values.password === values.confirm_password, {
      message: "Passwords do not match.",
      path: ["confirm_password"],
    });
}
