import type {
  UserManagementCapabilities,
  UserManagementEndpointDiscovery,
} from "@/types/users";

export const USER_MANAGEMENT_ENDPOINT_DISCOVERY: UserManagementEndpointDiscovery = {
  list: null,
  detail: null,
  create: null,
  update: null,
  userRoles: null,
  assignRole: null,
  removeRole: null,
};

export const USER_MANAGEMENT_CAPABILITIES: UserManagementCapabilities = {
  list: false,
  detail: false,
  create: false,
  update: false,
  userRoles: false,
  assignRole: false,
  removeRole: false,
};

export function getUserManagementEndpointDiscovery(): UserManagementEndpointDiscovery {
  return USER_MANAGEMENT_ENDPOINT_DISCOVERY;
}

export function getUserManagementCapabilities(): UserManagementCapabilities {
  return USER_MANAGEMENT_CAPABILITIES;
}
