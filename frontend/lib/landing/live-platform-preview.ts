/** Static demonstration data for the Live Platform Preview (FO-082A).
 * Presentation-only — no API calls, no tenant or operational records.
 */

export const LIVE_PLATFORM_PREVIEW = {
  title: "Live Platform Preview",
  eyebrow: "Product Tour",
  description:
    "A conceptual FacilityOps workspace built for presentations. Sample records only — no live tenant or operational data.",
  demoBadge: "Demonstration data",
  shell: {
    brand: "FacilityOps",
    workspace: "Operations Workspace",
    searchPlaceholder: "Search tickets, work orders…",
    userInitials: "AR",
    userLabel: "Alex R.",
    notificationCount: 3,
  },
  sidebar: [
    { id: "dashboard", label: "Dashboard", active: true },
    { id: "tickets", label: "FM Tickets", active: false },
    { id: "maintenance", label: "Maintenance", active: false },
    { id: "inspections", label: "5S Inspection", active: false },
    { id: "notifications", label: "Notifications", active: false },
    { id: "reports", label: "Reports", active: false },
  ],
  metrics: [
    {
      id: "open-tickets",
      label: "Open FM Tickets",
      value: "18",
      delta: "+2 today",
      tone: "sky" as const,
    },
    {
      id: "active-wo",
      label: "Active Work Orders",
      value: "11",
      delta: "4 in progress",
      tone: "teal" as const,
    },
    {
      id: "pending-inspections",
      label: "Pending Inspections",
      value: "6",
      delta: "2 due soon",
      tone: "amber" as const,
    },
    {
      id: "sla",
      label: "SLA Performance",
      value: "96%",
      delta: "Within target",
      tone: "emerald" as const,
    },
  ],
  trend: {
    title: "Weekly resolution trend",
    summary:
      "Resolved work increased from 12 to 21 items over the past seven days, with steady day-over-day improvement.",
    points: [12, 14, 13, 16, 18, 19, 21],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  activity: [
    {
      id: "act-1",
      type: "Ticket created",
      detail: "FT-1048 — Air-conditioning concern",
      actor: "Jamie C.",
      time: "8m ago",
    },
    {
      id: "act-2",
      type: "Work order assigned",
      detail: "WO-0321 — Inspect AHU vibration",
      actor: "Maintenance Team",
      time: "24m ago",
    },
    {
      id: "act-3",
      type: "Inspection completed",
      detail: "INS-0215 — Production Area 5S Review",
      actor: "Facilities Team",
      time: "1h ago",
    },
    {
      id: "act-4",
      type: "Attachment uploaded",
      detail: "Evidence photo added to FT-1048",
      actor: "Alex R.",
      time: "2h ago",
    },
  ],
  workQueue: [
    {
      id: "wq-1",
      reference: "FT-1048",
      title: "Air-conditioning concern",
      priority: "High",
      status: "In review",
      assignee: "Jamie C.",
      due: "Today",
    },
    {
      id: "wq-2",
      reference: "WO-0321",
      title: "Inspect AHU vibration",
      priority: "Medium",
      status: "Assigned",
      assignee: "Maintenance Team",
      due: "Tomorrow",
    },
    {
      id: "wq-3",
      reference: "INS-0215",
      title: "Production Area 5S Review",
      priority: "Low",
      status: "Completed",
      assignee: "Facilities Team",
      due: "Done",
    },
    {
      id: "wq-4",
      reference: "FT-1051",
      title: "Lighting flicker in corridor",
      priority: "Medium",
      status: "Open",
      assignee: "Alex R.",
      due: "Thu",
    },
  ],
  moduleInsights: [
    {
      id: "mi-tickets",
      title: "FM Ticketing",
      value: "18 open",
      note: "3 awaiting assignment",
    },
    {
      id: "mi-maintenance",
      title: "Maintenance",
      value: "11 active",
      note: "2 due within 24h",
    },
    {
      id: "mi-inspection",
      title: "5S Inspection",
      value: "6 pending",
      note: "Average score 91%",
    },
    {
      id: "mi-notifications",
      title: "Notifications",
      value: "7 unread",
      note: "Role-aware delivery",
    },
  ],
  aiInsight: {
    label: "Future Capability",
    title: "AI-ready insight",
    text: "Three recurring equipment issues detected this month.",
    disclaimer: "Preview concept only — not available in production today.",
  },
} as const;

/** Patterns that must never appear in preview copy (tenant / PII guards). */
export const PREVIEW_FORBIDDEN_PATTERNS = [
  /\btenant[_-]?id\b/i,
  /\buser[_-]?id\b/i,
  /\buuid\b/i,
  /@[\w.-]+\.\w+/,
  /\b\d{3}-\d{2}-\d{4}\b/,
] as const;
