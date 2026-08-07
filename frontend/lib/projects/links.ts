import { ApiError } from "@/services/api/types";
import type {
  ProjectLinkedProjectSummary,
  ProjectOperationalLink,
  ProjectOperationalLinkCreatePayload,
  ProjectOperationalLinkEditFormValues,
  ProjectOperationalLinkFormValues,
  ProjectOperationalLinkListFilters,
  ProjectOperationalLinkListParams,
  ProjectOperationalLinkRelationship,
  ProjectOperationalLinkType,
  ProjectOperationalLinkUpdatePayload,
} from "@/types/projects";

import { formatProjectLabel } from "./display";

export const PROJECT_LINK_TYPE_LABELS: Record<
  ProjectOperationalLinkType,
  string
> = {
  fm_ticket: "FM Ticket",
  maintenance_work_order: "Maintenance Work Order",
  inspection: "Inspection",
};

export const PROJECT_LINK_RELATIONSHIP_LABELS: Record<
  ProjectOperationalLinkRelationship,
  string
> = {
  related: "Related",
  source: "Source",
  execution: "Execution",
  corrective_action: "Corrective Action",
  evidence: "Evidence",
  follow_up: "Follow Up",
};

export const PROJECT_LINK_TYPES: ProjectOperationalLinkType[] = [
  "fm_ticket",
  "maintenance_work_order",
  "inspection",
];

export const PROJECT_LINK_RELATIONSHIPS: ProjectOperationalLinkRelationship[] =
  [
    "related",
    "source",
    "execution",
    "corrective_action",
    "evidence",
    "follow_up",
  ];

export const DEFAULT_PROJECT_LINK_LIST_FILTERS: ProjectOperationalLinkListFilters =
  {
    search: "",
    linkType: "",
    relationship: "",
    accessibility: "",
    pageSize: 20,
  };

export function formatProjectLinkTypeLabel(
  linkType: ProjectOperationalLinkType | string,
): string {
  if (linkType in PROJECT_LINK_TYPE_LABELS) {
    return PROJECT_LINK_TYPE_LABELS[linkType as ProjectOperationalLinkType];
  }
  return formatProjectLabel(linkType);
}

export function formatProjectLinkRelationshipLabel(
  relationship: ProjectOperationalLinkRelationship | string,
): string {
  if (relationship in PROJECT_LINK_RELATIONSHIP_LABELS) {
    return PROJECT_LINK_RELATIONSHIP_LABELS[
      relationship as ProjectOperationalLinkRelationship
    ];
  }
  return formatProjectLabel(relationship);
}

export function serializeProjectLinkListParams(
  filters: ProjectOperationalLinkListFilters,
  page: number,
): ProjectOperationalLinkListParams {
  return {
    page,
    page_size: filters.pageSize,
  };
}

export function filterProjectLinks(
  links: ProjectOperationalLink[],
  filters: ProjectOperationalLinkListFilters,
  debouncedSearch?: string,
): ProjectOperationalLink[] {
  const search = (debouncedSearch ?? filters.search).trim().toLowerCase();

  return links.filter((link) => {
    if (filters.linkType && link.link_type !== filters.linkType) {
      return false;
    }
    if (filters.relationship && link.relationship !== filters.relationship) {
      return false;
    }
    if (filters.accessibility === "accessible" && !link.target_accessible) {
      return false;
    }
    if (filters.accessibility === "restricted" && link.target_accessible) {
      return false;
    }
    if (!search) {
      return true;
    }

    const haystack = [
      link.target_number,
      link.target_title,
      link.target_status,
      link.notes,
      formatProjectLinkTypeLabel(link.link_type),
      formatProjectLinkRelationshipLabel(link.relationship),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function summarizeProjectLinksByType(links: ProjectOperationalLink[]): {
  type: ProjectOperationalLinkType;
  label: string;
  count: number;
}[] {
  return PROJECT_LINK_TYPES.map((type) => ({
    type,
    label: formatProjectLinkTypeLabel(type),
    count: links.filter((link) => link.link_type === type).length,
  }));
}

export function filterLinksForProjectTask(
  links: ProjectOperationalLink[],
  taskId: string,
): ProjectOperationalLink[] {
  return links.filter((link) => link.project_task_id === taskId);
}

export function getProjectLinkTargetHref(
  link: ProjectOperationalLink,
): string | null {
  if (!link.target_accessible || !link.target_id) {
    return null;
  }
  if (link.link_type === "fm_ticket") {
    return `/fm-tickets/${link.target_id}`;
  }
  if (link.link_type === "maintenance_work_order") {
    return `/maintenance/work-orders/${link.target_id}`;
  }
  if (link.link_type === "inspection") {
    return `/inspection/inspections/${link.target_id}`;
  }
  return null;
}

export function formatProjectLinkTargetLabel(
  link: ProjectOperationalLink,
): string {
  if (!link.target_accessible) {
    return "Restricted target";
  }
  const number = link.target_number?.trim();
  const title = link.target_title?.trim();
  if (number && title) {
    return `${number} — ${title}`;
  }
  return number || title || "Linked record";
}

export function formatProjectLinkAccessibilityLabel(
  accessible: boolean,
): string {
  return accessible ? "Accessible" : "Restricted";
}

export function buildProjectLinkFormDefaults(): ProjectOperationalLinkFormValues {
  return {
    link_type: "",
    target_id: "",
    relationship: "related",
    notes: "",
    project_task: "",
  };
}

export function mapProjectLinkToEditFormValues(
  link: ProjectOperationalLink,
): ProjectOperationalLinkEditFormValues {
  return {
    relationship: link.relationship,
    notes: link.notes ?? "",
    project_task: link.project_task_id ?? "",
  };
}

export function validateProjectLinkFormValues(
  values: ProjectOperationalLinkFormValues,
): {
  link_type?: string;
  target_id?: string;
} {
  const errors: { link_type?: string; target_id?: string } = {};

  if (!values.link_type) {
    errors.link_type = "Link type is required.";
  }
  if (!values.target_id.trim()) {
    errors.target_id = "Select a record to link.";
  }

  return errors;
}

export function mapProjectLinkFormValuesToCreatePayload(
  values: ProjectOperationalLinkFormValues,
): ProjectOperationalLinkCreatePayload {
  const linkType = values.link_type as ProjectOperationalLinkType;
  const payload: ProjectOperationalLinkCreatePayload = {
    link_type: linkType,
    relationship: values.relationship,
    notes: values.notes.trim(),
    project_task: values.project_task.trim() || null,
  };

  if (linkType === "fm_ticket") {
    payload.fm_ticket = values.target_id.trim();
  } else if (linkType === "maintenance_work_order") {
    payload.maintenance_work_order = values.target_id.trim();
  } else if (linkType === "inspection") {
    payload.inspection = values.target_id.trim();
  }

  return payload;
}

export function mapProjectLinkEditFormValuesToUpdatePayload(
  values: ProjectOperationalLinkEditFormValues,
): ProjectOperationalLinkUpdatePayload {
  return {
    relationship: values.relationship,
    notes: values.notes.trim(),
    project_task: values.project_task.trim() || null,
  };
}

export function hasLinkedProjects(
  linkedProjects?: ProjectLinkedProjectSummary[] | null,
): boolean {
  return Boolean(linkedProjects && linkedProjects.length > 0);
}

export function canOpenLinkedProject(
  hasPermission: (code: string) => boolean,
): boolean {
  return (
    hasPermission("projects.view") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.links.view") ||
    hasPermission("projects.links.manage")
  );
}

const PROJECT_LINK_FORM_API_FIELD_LABELS: Record<string, string> = {
  link_type: "Link type",
  fm_ticket: "FM ticket",
  maintenance_work_order: "Work order",
  inspection: "Inspection",
  relationship: "Relationship",
  notes: "Notes",
  project_task: "Project task",
  type: "Type",
  non_field_errors: "Form",
};

export function formatProjectLinkApiFieldLabel(field: string): string {
  return (
    PROJECT_LINK_FORM_API_FIELD_LABELS[field] ??
    formatProjectLabel(field, field)
  );
}

export function formatProjectLinkValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatProjectLinkApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatProjectLinkError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to manage this link.";
    }
    if (error.status === 404) {
      return "The requested link could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading link data.";
    }

    const validationMessages = formatProjectLinkValidationMessages(
      error.details?.errors ?? {},
    );
    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getProjectLinkListLayoutClasses() {
  return {
    tableWrapper: "hidden md:block",
    cardsWrapper: "space-y-3 md:hidden",
  };
}

export function canViewProjectLinks(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.links.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.links.manage")
  );
}

export function canManageProjectLinks(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.links.manage") ||
    hasPermission("projects.manage")
  );
}
