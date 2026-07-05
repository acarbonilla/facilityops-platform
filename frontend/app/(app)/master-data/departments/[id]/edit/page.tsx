"use client";

import { useParams } from "next/navigation";

import { DepartmentEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function DepartmentEditPage() {
  const params = useParams<{ id: string }>();

  return <DepartmentEditPageContent id={params.id} />;
}
