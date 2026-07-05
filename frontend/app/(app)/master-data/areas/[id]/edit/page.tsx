"use client";

import { useParams } from "next/navigation";

import { AreaEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function AreaEditPage() {
  const params = useParams<{ id: string }>();

  return <AreaEditPageContent id={params.id} />;
}
