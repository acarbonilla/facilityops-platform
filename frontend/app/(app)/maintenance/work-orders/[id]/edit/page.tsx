"use client";

import { use } from "react";

import { MaintenanceEditPageContent } from "@/features/maintenance/components/maintenance-form-pages";

export default function EditMaintenanceWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <MaintenanceEditPageContent id={id} />;
}
