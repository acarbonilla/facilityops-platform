export const API_ENDPOINTS = {
  health: "/health/",
  auth: {
    login: "/auth/login/",
    refresh: "/auth/refresh/",
    logout: "/auth/logout/",
    me: "/auth/me/",
  },
  accessControl: {
    mePermissions: "/access-control/me/permissions/",
  },
} as const;
