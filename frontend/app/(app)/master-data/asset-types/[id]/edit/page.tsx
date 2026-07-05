"use client";

import { useParams } from "next/navigation";

import { AssetTypeEditPageContent } from "@/features/master-data/components/master-data-form-pages";

export default function AssetTypeEditPage() {
  const params = useParams<{ id: string }>();

  return <AssetTypeEditPageContent id={params.id} />;
}
