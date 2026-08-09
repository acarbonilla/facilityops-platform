import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Paperclip,
  Settings,
  Shield,
  Ticket,
  UserRound,
  Users,
  Wrench,
  Briefcase,
  BarChart3,
  Database,
} from "lucide-react";

const NAV_ICON_BY_HREF: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/my-requests": ClipboardList,
  "/fm-tickets": Ticket,
  "/maintenance": Wrench,
  "/projects": FolderKanban,
  "/my-work": Briefcase,
  "/inspection/inspections": ClipboardCheck,
  "/reporting": BarChart3,
  "/attachments": Paperclip,
  "/master-data": Database,
  "/admin": Shield,
  "/admin/organization": Building2,
  "/admin/assets": Database,
  "/admin/users": Users,
  "/admin/roles": Shield,
  "/admin/permissions": Shield,
  "/settings": Settings,
  "/profile": UserRound,
};

export function getNavigationIcon(href: string): LucideIcon {
  if (NAV_ICON_BY_HREF[href]) {
    return NAV_ICON_BY_HREF[href];
  }
  if (href.startsWith("/master-data/")) {
    return Database;
  }
  if (href.startsWith("/admin/")) {
    return Shield;
  }
  if (href.startsWith("/reporting")) {
    return BarChart3;
  }
  if (href.startsWith("/maintenance")) {
    return Wrench;
  }
  if (href.startsWith("/fm-tickets")) {
    return Ticket;
  }
  if (href.startsWith("/projects")) {
    return FolderKanban;
  }
  if (href.startsWith("/my-work")) {
    return Briefcase;
  }
  return LayoutDashboard;
}
