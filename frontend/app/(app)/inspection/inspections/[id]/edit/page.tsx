"use client";

import { use } from "react";

import { InspectionEditPageContent } from "@/features/inspection/components/inspection-form-pages";

export default function EditInspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <InspectionEditPageContent id={id} />;
}
