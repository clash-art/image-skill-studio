import type { Metadata } from "next";

import { StudioImageHome } from "@/components/studio-image-home";
import { getRequestSiteLocale } from "@/lib/site-locale-server";
import { studioImageMetadata } from "@/lib/studio-page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return studioImageMetadata(await getRequestSiteLocale());
}

export default async function StudioImagePage() {
  return <StudioImageHome locale={await getRequestSiteLocale()} />;
}
