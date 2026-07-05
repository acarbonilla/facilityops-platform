"use client";

import { useParams } from "next/navigation";

import { AssetEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function AssetEditPage() {
  const params = useParams<{ id: string }>();

  return <AssetEditPageContent id={params.id} />;
}
