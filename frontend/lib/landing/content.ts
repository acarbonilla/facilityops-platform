/** Landing page content configuration for FO-082A. */

export const LANDING_BRAND = {
  name: "FacilityOps",
  tagline: "Smarter Facility Operations.",
  taglineSecondary: "One Connected Platform.",
  description:
    "Connect FM ticketing, maintenance, 5S inspections, notifications, and secure evidence in one enterprise-ready workspace built for operational excellence.",
} as const;

export const LANDING_NAV = [
  { id: "platform", label: "Platform", href: "#platform" },
  { id: "modules", label: "Modules", href: "#modules" },
  { id: "applications", label: "Applications", href: "#applications" },
  { id: "about", label: "About", href: "#security" },
  { id: "contact", label: "Contact", href: "#contact" },
] as const;

export const LANDING_TRUST_ITEMS = [
  {
    id: "secure",
    title: "Secure",
    description: "Permission-aware access with protected operational data.",
  },
  {
    id: "multi-tenant",
    title: "Multi-tenant",
    description: "Tenant isolation designed for multi-organization deployments.",
  },
  {
    id: "ai-ready",
    title: "AI Ready",
    description: "Architecture prepared for assisted operational intelligence.",
  },
  {
    id: "audit",
    title: "Audit Trail",
    description: "Traceable history for critical workflow actions.",
  },
  {
    id: "workflow",
    title: "Fast Workflow",
    description: "Clear assignment and status paths from request to close.",
  },
  {
    id: "cloud",
    title: "Cloud Ready",
    description: "Modern web delivery for teams across sites and shifts.",
  },
] as const;

export const LANDING_MODULES = [
  {
    id: "fm-ticketing",
    title: "FM Ticketing",
    description:
      "Capture, assign, and track facility requests with requester-safe visibility.",
    icon: "ticket",
  },
  {
    id: "maintenance",
    title: "Maintenance Work Orders",
    description:
      "Coordinate technicians, assignments, and completion evidence in one flow.",
    icon: "wrench",
  },
  {
    id: "inspection",
    title: "5S Inspection",
    description:
      "Run structured inspections, findings, and corrective actions with clarity.",
    icon: "clipboard",
  },
  {
    id: "notifications",
    title: "Notifications",
    description:
      "Keep stakeholders informed with role-aware operational alerts.",
    icon: "bell",
  },
  {
    id: "attachments",
    title: "Secure Attachments",
    description:
      "Store and share evidence through authenticated, tenant-scoped controls.",
    icon: "paperclip",
  },
  {
    id: "reporting",
    title: "Reports & Analytics",
    description:
      "See operational posture across tickets, work orders, and inspections.",
    icon: "chart",
  },
  {
    id: "admin",
    title: "Administration",
    description:
      "Manage users, roles, master data, and organizational structure.",
    icon: "settings",
  },
  {
    id: "ai-assistant",
    title: "Future AI Assistant",
    description:
      "Roadmapped assistance for triage, suggestions, and analysis.",
    icon: "spark",
  },
] as const;

export const LANDING_WORKFLOW = [
  { id: "employee", label: "Employee" },
  { id: "ticket", label: "FM Ticket" },
  { id: "assignment", label: "Assignment" },
  { id: "maintenance", label: "Maintenance" },
  { id: "inspection", label: "Inspection" },
  { id: "completion", label: "Completion" },
  { id: "analytics", label: "Analytics" },
] as const;

export const LANDING_BENEFITS = [
  {
    id: "centralized",
    title: "Centralized Operations",
    description:
      "Bring requests, work, and inspections into one governed platform.",
  },
  {
    id: "visibility",
    title: "Better Visibility",
    description:
      "Give managers and teams shared status across sites and workflows.",
  },
  {
    id: "downtime",
    title: "Reduced Downtime",
    description:
      "Move faster from reported issues to assigned and completed work.",
  },
  {
    id: "response",
    title: "Faster Response",
    description:
      "Clear ownership and notifications reduce handoff delay.",
  },
  {
    id: "records",
    title: "Digital Records",
    description:
      "Keep evidence, history, and outcomes available for review.",
  },
  {
    id: "excellence",
    title: "Operational Excellence",
    description:
      "Standardize facility workflows without losing local accountability.",
  },
] as const;

export const LANDING_SECURITY = [
  {
    id: "rbac",
    title: "Role-based Access",
    description: "Capabilities follow seeded roles and permission codes.",
  },
  {
    id: "attachments",
    title: "Secure Attachments",
    description: "Authenticated download paths with no public media URLs.",
  },
  {
    id: "tenant",
    title: "Tenant Isolation",
    description: "Operational data remains scoped to the active tenant.",
  },
  {
    id: "audit",
    title: "Audit History",
    description: "Important actions retain actor and ownership context.",
  },
  {
    id: "permissions",
    title: "Permission Controls",
    description: "Frontend guidance is backed by server-side enforcement.",
  },
  {
    id: "validation",
    title: "Workflow Validation",
    description: "Status and ownership checks protect terminal states.",
  },
] as const;

export const LANDING_FUTURE_AI = [
  {
    id: "ticket-assistant",
    title: "AI Ticket Assistant",
    description: "Assisted triage and drafting support for facility requests.",
  },
  {
    id: "maintenance-suggestions",
    title: "AI Maintenance Suggestions",
    description: "Guidance for prioritization and technician planning.",
  },
  {
    id: "inspection-analysis",
    title: "AI Inspection Analysis",
    description: "Support for reviewing findings and evidence patterns.",
  },
  {
    id: "reports",
    title: "AI Reports",
    description: "Narrative summaries over operational aggregates.",
  },
  {
    id: "recommendations",
    title: "AI Recommendations",
    description: "Suggested next actions grounded in workflow context.",
  },
] as const;

export const LANDING_HERO_STATS = [
  { id: "tickets", label: "Active Tickets", value: "24", trend: "+3 today" },
  { id: "maintenance", label: "Maintenance", value: "12", trend: "4 in progress" },
  { id: "score", label: "5S Score", value: "92%", trend: "Within target" },
  { id: "notifications", label: "Notifications", value: "7", trend: "2 unread" },
] as const;
