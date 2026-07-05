"use client";

import { useParams } from "next/navigation";

import { TenantEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function TenantEditPage() {
  const params = useParams<{ id: string }>();

  return <TenantEditPageContent id={params.id} />;
}
