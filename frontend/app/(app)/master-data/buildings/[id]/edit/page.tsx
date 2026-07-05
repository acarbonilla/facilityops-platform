"use client";

import { useParams } from "next/navigation";

import { BuildingEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function BuildingEditPage() {
  const params = useParams<{ id: string }>();

  return <BuildingEditPageContent id={params.id} />;
}
