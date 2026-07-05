"use client";

import { useParams } from "next/navigation";

import { FloorEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function FloorEditPage() {
  const params = useParams<{ id: string }>();

  return <FloorEditPageContent id={params.id} />;
}
