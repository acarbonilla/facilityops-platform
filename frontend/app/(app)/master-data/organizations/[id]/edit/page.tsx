"use client";

import { useParams } from "next/navigation";

import { OrganizationEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function OrganizationEditPage() {
  const params = useParams<{ id: string }>();

  return <OrganizationEditPageContent id={params.id} />;
}
